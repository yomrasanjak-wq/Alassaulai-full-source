// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayRoutePlanner } from "./DayRoutePlanner";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("DayRoutePlanner", () => {
  it("adds, reorders and removes itinerary stops", () => {
    render(<DayRoutePlanner />);
    const select = screen.getByLabelText("أضف محطة إلى جولتك");
    fireEvent.change(select, { target: { value: "meydan" } });
    fireEvent.click(screen.getByRole("button", { name: /أضف/ }));
    fireEvent.change(select, { target: { value: "ganita" } });
    fireEvent.click(screen.getByRole("button", { name: /أضف/ }));
    expect(screen.getByText("2 / 8")).toBeTruthy();
    const moveUp = screen.getByRole("button", { name: "تقديم شاطئ قانيتا" });
    fireEvent.click(moveUp);
    const rows = screen.getByRole("list").querySelectorAll("li");
    expect(rows[0].textContent).toContain("شاطئ قانيتا");
    fireEvent.click(screen.getByRole("button", { name: "حذف شاطئ قانيتا" }));
    expect(screen.getByText("1 / 8")).toBeTruthy();
  });

  it("opens a multi-stop directions link and starts from entered origin", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DayRoutePlanner />);
    fireEvent.change(screen.getByLabelText("نقطة الانطلاق"), { target: { value: "Yomra" } });
    const select = screen.getByLabelText("أضف محطة إلى جولتك");
    fireEvent.change(select, { target: { value: "meydan" } });
    fireEvent.click(screen.getByRole("button", { name: /أضف/ }));
    fireEvent.change(select, { target: { value: "ganita" } });
    fireEvent.click(screen.getByRole("button", { name: /أضف/ }));
    fireEvent.click(screen.getByRole("button", { name: /ابدأ الرحلة/ }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toContain("origin=Yomra");
    expect(open.mock.calls[0][0]).toContain("waypoints=");
    expect(open.mock.calls[0][0]).toContain("destination=");
  });
});
