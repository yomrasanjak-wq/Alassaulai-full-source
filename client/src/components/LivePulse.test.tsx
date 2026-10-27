// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LivePulse } from "./LivePulse";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LivePulse", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("open-meteo")) {
        return Promise.resolve(new Response(JSON.stringify({ current: { temperature_2m: 18, weather_code: 2 } }), { status: 200 }));
      }
      if (url.includes("open.er-api")) {
        return Promise.resolve(new Response(JSON.stringify({ rates: { SAR: 3.75, TRY: 37.5, EUR: 0.92 } }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ rates: { TRY: 0.096 } }), { status: 200 }));
    }));
  });

  it("renders the Arabic live dashboard and refreshes weather and exchange values", async () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);

    expect(screen.getByText("تحديث حي")).toBeTruthy();
    expect(screen.getByText("الترجمة الفورية")).toBeTruthy();
    expect(screen.getByText("التاريخ اليوم")).toBeTruthy();
    expect(screen.getByText("الوقت العالمي")).toBeTruthy();
    expect(screen.getByText("طقس طرابزون الآن")).toBeTruthy();
    expect(screen.getByText("سعر الصرف")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByText(/18°/).length).toBeGreaterThan(0);
      expect(screen.getByText(/1 ريال سعودي = 0\.096 ليرة تركية/)).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("renders a month calendar with previous and next month controls", () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);

    expect(screen.getByRole("button", { name: "الشهر السابق" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "الشهر التالي" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "الشهر التالي" }));
    expect(screen.getByRole("button", { name: "الشهر السابق" })).toBeTruthy();
  });

  it("places Saturday October 3, 2026 under Saturday in the RTL calendar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 3, 12, 0, 0));
    try {
      const { container } = render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);
      const today = container.querySelector(".calendar-day-today");
      expect(today?.textContent).toBe("3");
      expect(Array.from(today?.parentElement?.children ?? []).indexOf(today as Element)).toBe(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an honest unavailable state when a live source fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("unavailable", { status: 503 }))));
    render(<LivePulse language="EN" onPlanRoute={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText("Source is currently unavailable")).toHaveLength(2);
    });
  });

  it("opens Currency Plus and converts between selectable currencies", async () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/سعر الصرف/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "محوّل العملات" }));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "محوّل العملات" })).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/1 SAR =/)).toBeTruthy());
    expect(screen.getByText(/١٠ TRY/)).toBeTruthy();
  });

  it("opens the centered translation popover when the translation card is pressed", () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "الترجمة الفورية" }));

    expect(screen.getByRole("dialog", { name: "الترجمة الفورية" })).toBeTruthy();
    expect(screen.getAllByText("Türkçe").length).toBeGreaterThan(0);
    const input = screen.getByPlaceholderText("اكتب النص هنا…");
    expect(input).toBeTruthy();
    expect(screen.getByRole("button", { name: /ترجم الآن/ })).toBeTruthy();
    const turkishButtons = screen.getAllByRole("button", { name: /Türkçe/ });
    fireEvent.click(turkishButtons[turkishButtons.length - 1]);
    fireEvent.change(input, { target: { value: "السلام عليكم ورحمةالله وبركاته" } });
    fireEvent.click(screen.getByRole("button", { name: /ترجم الآن/ }));
    expect(screen.getByText("Selamün aleyküm ve rahmetullahi ve berekatühü")).toBeTruthy();
  });

  it("offers the official Google Translate link with the selected languages and text", () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "الترجمة الفورية" }));
    fireEvent.change(screen.getByPlaceholderText("اكتب النص هنا…"), { target: { value: "السلام عليكم" } });
    const link = screen.getByRole("link", { name: "فتح ترجمة Google" }) as HTMLAnchorElement;
    expect(link.target).toBe("_blank");
    expect(link.href).toContain("translate.google.com/");
    expect(link.href).toContain("sl=ar");
    expect(link.href).toContain("tl=tr");
    expect(link.href).toContain(encodeURIComponent("السلام عليكم"));
  });

  it("translates Good morning to Turkish without echoing the input", async () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "الترجمة الفورية" }));
    const input = screen.getByPlaceholderText("اكتب النص هنا…");
    fireEvent.change(input, { target: { value: "صباح الخير" } });
    await waitFor(() => expect(screen.getByText("Günaydın")).toBeTruthy());
    expect(screen.queryByText(/صباح الخير  →/)).toBeNull();
  });

  it("translates the Turkish phrase shown in the mobile translator", async () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "الترجمة الفورية" }));
    const input = screen.getByPlaceholderText("اكتب النص هنا…");
    const sourceButtons = screen.getAllByRole("button", { name: /Türkçe/ });
    fireEvent.click(sourceButtons[0]);
    const arabicButtons = screen.getAllByRole("button", { name: /العربية/ });
    fireEvent.click(arabicButtons[arabicButtons.length - 1]);
    fireEvent.change(input, { target: { value: "çok güzel" } });
    await waitFor(() => expect(screen.getByText("جميل جداً")).toBeTruthy());
  });

  it("translates the Arabic school sentence into Turkish", async () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "الترجمة الفورية" }));
    const input = screen.getByPlaceholderText("اكتب النص هنا…");
    fireEvent.change(input, { target: { value: "انا اريد الذهاب الى المدرسه" } });
    await waitFor(() => expect(screen.getByText("Okula gitmek istiyorum")).toBeTruthy());
  });

  it("translates the Arabic help sentence into English and locks the page behind the dialog", async () => {
    render(<LivePulse language="AR" onPlanRoute={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "الترجمة الفورية" }));
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    const input = screen.getByPlaceholderText("اكتب النص هنا…");
    const englishButtons = screen.getAllByRole("button", { name: /English/ });
    fireEvent.click(englishButtons[englishButtons.length - 1]);
    fireEvent.change(input, { target: { value: "هل تستطيع مساعدتي؟" } });
    await waitFor(() => expect(screen.getByText("Can you help me?")).toBeTruthy());
  });
});
