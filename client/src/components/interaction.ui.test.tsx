// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mutateAsyncMock, auxiliaryMutationMock } = vi.hoisted(() => ({ mutateAsyncMock: vi.fn(), auxiliaryMutationMock: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      me: { useQuery: () => ({ data: { id: 1, openId: "owner", role: "admin", name: "Owner" }, isLoading: false, refetch: vi.fn() }) },
      visitorCount: { useQuery: () => ({ data: 0, isLoading: false, refetch: vi.fn() }) },
      logout: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock }) },
    },
    ai: {
      chat: {
        useMutation: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
      },
    },
    control: {
      submit: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) },
      list: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      update: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) },
    },
    media: { list: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) }, upload: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) }, update: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) }, delete: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) } },
    discovery: { list: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) }, upload: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) }, update: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) }, delete: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) } },
    guestbook: { list: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) }, save: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) }, delete: { useMutation: () => ({ mutateAsync: auxiliaryMutationMock, isPending: false }) } },
  },
}));
vi.mock("@/components/Map", () => ({ MapView: ({ className }: { className?: string }) => <div data-testid={className === "north-map-canvas" ? "north-map-view" : "route-map-view"} /> }));

afterEach(() => cleanup());
beforeEach(() => { mutateAsyncMock.mockReset(); auxiliaryMutationMock.mockReset(); auxiliaryMutationMock.mockResolvedValue({ success: true, id: 1, item: { name: "file", url: "https://example.com/file", mimeType: "image/jpeg" } }); });
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, writable: true, value: vi.fn() });
import { ChatComposer } from "./ChatComposer";
import { AssistantReply } from "./AssistantReply";
import { VoiceSelector } from "./VoiceSelector";
import { LiveStatusView } from "./LiveStatusView";
import Home from "../pages/Home";
import { InteractiveNorthMap } from "./InteractiveNorthMap";
import { parseRouteRequest } from "@shared/routeRequest";

function chatProps(overrides: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  return {
    value: "",
    onChange: vi.fn(),
    onSend: vi.fn(),
    onVoice: vi.fn(),
    isListening: false,
    voiceSupported: true,
    isLoading: false,
    placeholder: "اكتب سؤالك",
    onImageSelected: vi.fn(),
    ...overrides,
  };
}

describe("Interactive North map destination matching", () => {
  it("resolves the city directory name for Trabzon Meydan to its verified map pin", () => {
    render(<InteractiveNorthMap destinationRequest={{ name: "ميدان طرابزون والأسواق", city: "طرابزون", query: "Meydan Trabzon Turkey" }} />);
    expect(screen.getByRole("region", { name: "تفاصيل ميدان طرابزون" })).toBeTruthy();
    expect(screen.getAllByText("ميدان طرابزون").length).toBeGreaterThan(0);
  });

  it("resolves the Kaşüstü gallery label to the existing waterfront pin", () => {
    render(<InteractiveNorthMap destinationRequest={{ name: "ممشى كاشوستو البحري الجديد", city: "يومرا", query: "Kaşüstü Cumhuriyet Parkı deniz manzaralı yürüyüş yolu" }} />);
    expect(screen.getByRole("region", { name: "تفاصيل واجهة كاشستوس البحرية" })).toBeTruthy();
  });

  it("resolves Yomra highlands in the Yomra city filter", () => {
    render(<InteractiveNorthMap destinationRequest={{ name: "مرتفعات يومرا", city: "يومرا", query: "Yomra Yaylası Trabzon" }} />);
    expect(screen.getByRole("region", { name: "تفاصيل مرتفعات يومرا" })).toBeTruthy();
  });

  it("does not pin the Hamsikoy and Zigana combination to Hamsikoy alone", () => {
    render(<InteractiveNorthMap destinationRequest={{ name: "هامسي كوي وزيقانا", city: "طرابزون", query: "Hamsiköy Zigana Trabzon" }} />);
    expect(screen.queryByRole("region", { name: "تفاصيل همسي كوي" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "ابحث في الخريطة" }) as HTMLInputElement).value).toBe("هامسي كوي وزيقانا");
  });

  it("does not pin the Firtina Valley and Zilkale combination to the valley alone", () => {
    render(<InteractiveNorthMap destinationRequest={{ name: "وادي فيرتينا وزيل قلعة", city: "ريزا", query: "Fırtına Vadisi Zilkale Rize" }} />);
    expect(screen.queryByRole("region", { name: /تفاصيل وادي فرتينا/ })).toBeNull();
    expect((screen.getByRole("textbox", { name: "ابحث في الخريطة" }) as HTMLInputElement).value).toBe("وادي فيرتينا وزيل قلعة");
  });

  it("keeps the airplane restaurant as a search when no verified restaurant pin exists", () => {
    render(<InteractiveNorthMap destinationRequest={{ name: "مطعم الطائرة", city: "يومرا", query: "Terminal Pide Uçak Cafe Restaurant Yomra" }} />);
    expect(screen.queryByRole("region", { name: /تفاصيل/ })).toBeNull();
    expect((screen.getByRole("textbox", { name: "ابحث في الخريطة" }) as HTMLInputElement).value).toBe("مطعم الطائرة");
  });

  it("does not replace the Asmasu waterfall with a generic Araklı waterfall pin", () => {
    render(<InteractiveNorthMap destinationRequest={{ name: "شلال أراكلي الكبير", city: "أراكلي", query: "Araklı Asmasu Şelalesi Trabzon" }} />);
    expect(screen.queryByRole("region", { name: "تفاصيل شلالات أراكلي" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "ابحث في الخريطة" }) as HTMLInputElement).value).toBe("شلال أراكلي الكبير");
  });
});

describe("Home voice-to-chat flow", () => {
  class FakeSpeechRecognition {
    static current: FakeSpeechRecognition | undefined;
    lang = "";
    continuous = false;
    interimResults = false;
    onstart?: () => void;
    onerror?: (event: { error?: string }) => void;
    onresult?: (event: { results: ArrayLike<{ [key: number]: { transcript?: string }; isFinal?: boolean }> }) => void;
    onend?: () => void;

    constructor() {
      FakeSpeechRecognition.current = this;
    }

    start() {
      this.onstart?.();
    }

    stop() {
      this.onend?.();
    }
  }

  it("sends the complete Arabic transcript and renders the assistant answer", async () => {
    mutateAsyncMock.mockResolvedValue({ text: "طرابزون مدينة جميلة، ويمكنني ترتيب برنامج يومي لك." });
    const previousRecognition = (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: FakeSpeechRecognition });

    try {
      render(<Home />);
      expect(document.querySelectorAll(".assistant-button-avatar img")).toHaveLength(2);
      fireEvent.click(screen.getByRole("button", { name: "chat" }));
      expect(screen.getByRole("img", { name: "روبوت ALASSAUL الرسمي" })).toBeTruthy();
      expect(screen.getByText(/المتحدث الرسمي/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "voice" }));
      const recognition = FakeSpeechRecognition.current;
      expect(recognition?.lang).toBe("ar-SA");
      expect(recognition?.continuous).toBe(true);
      expect(recognition?.interimResults).toBe(true);
      recognition?.onresult?.({
        results: [{ 0: { transcript: "ما أفضل برنامج في طرابزون؟" }, isFinal: false }],
      });
      expect(mutateAsyncMock).not.toHaveBeenCalled();
      recognition?.onresult?.({
        results: [{ 0: { transcript: "ما أفضل برنامج في طرابزون؟" }, isFinal: true }],
      });
      // Speech engines may repeat the same full results list across events; do not append it twice.
      recognition?.onresult?.({
        results: [{ 0: { transcript: "ما أفضل برنامج في طرابزون؟" }, isFinal: true }],
      });
      expect(mutateAsyncMock).not.toHaveBeenCalled();
      recognition?.stop();

      await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledOnce());
      const request = mutateAsyncMock.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      expect(request.messages.at(-1)).toEqual({ role: "user", content: "ما أفضل برنامج في طرابزون؟" });
      await waitFor(() => expect(screen.getByText("طرابزون مدينة جميلة، ويمكنني ترتيب برنامج يومي لك.")).toBeTruthy());
    } finally {
      Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: previousRecognition });
      FakeSpeechRecognition.current = undefined;
    }
  });

  it("shows a provider failure as an error notification rather than a success", async () => {
    const failureMessage = "تعذر الاتصال بمزود الذكاء الاصطناعي؛ أعد المحاولة لاحقاً.";
    mutateAsyncMock.mockResolvedValue({ text: failureMessage, errorCode: "unavailable" });
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "chat" }));
    fireEvent.change(screen.getByRole("textbox", { name: "سؤال المساعد" }), { target: { value: "سؤال اختبار جديد" } });
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }));
    await waitFor(() => expect(screen.getByText("تعذر الحصول على إجابة من النموذج")).toBeTruthy());
    expect(screen.queryByText("وصل رد المساعد")).toBeNull();
    expect(screen.getAllByText(failureMessage).length).toBeGreaterThan(0);
  });
});

describe("City card imagery", () => {
  it("shows a dedicated image for every city that was missing artwork", () => {
    render(<Home />);
    for (const cityName of ["سامسون", "أوردو", "جيرسون", "أنقرة", "إسطنبول", "جورجيا"]) {
      fireEvent.click(screen.getAllByRole("button", { name: new RegExp(cityName) }).find((button) => button.classList.contains("city-tab"))!);
      expect(screen.getAllByAltText(cityName).length).toBeGreaterThan(0);
    }
  });

  it("shows the expanded Istanbul collection in the city file", () => {
    render(<Home />);
    fireEvent.click(screen.getAllByRole("button", { name: /إسطنبول/ }).find((button) => button.classList.contains("city-tab"))!);
    for (const place of ["جامع السلطان أحمد", "برج غلطة", "قصر دولما بهجة", "السوق المصري", "حديقة أميرغان", "بولونيزكوي", "أكواريوم إسطنبول"]) {
      expect(screen.getAllByText(place).length).toBeGreaterThan(0);
    }
  });

  it("opens a selected destination on the in-app map and offers a return to the directory", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /اكتشف وجهتك/ }));
    expect(screen.getByRole("dialog", { name: "اكتشف الشمال التركي" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /افتح صفحة المدينة/ }));
    fireEvent.click(screen.getByRole("button", { name: "عرض أوزنجول على خريطة ALASSAUL" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "تفاصيل أوزنجول" })).toBeTruthy());
    expect(screen.getByRole("button", { name: /العودة لاختيار وجهة أخرى/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /العودة لاختيار وجهة أخرى/ }));
    expect(screen.getByText("طرابزون · الوجهات")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /اختيار وجهة الخريطة رقم/ }).length).toBeGreaterThan(1);
  });

  it("shows the documented Botanik Park and Cazilar Deresi photo-book covers", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "افتح دفتر صور الشمال التركي" }));
    fireEvent.click(screen.getByRole("button", { name: "الصفحة التالية" }));
    expect((document.querySelector(".photo-book-page img") as HTMLImageElement).src).toBe("https://www.trabzon.bel.tr/img/SehriKesfet/SosyalTesis/botanik.jpg");
    expect(screen.getByText("Trabzon Büyükşehir Belediyesi")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "يومرا وكاشوستو" }));
    for (let page = 0; page < 3; page += 1) {
      fireEvent.click(screen.getByRole("button", { name: "الصفحة التالية" }));
    }
    expect((document.querySelector(".photo-book-page img") as HTMLImageElement).src).toContain("/upload/Foto/7C3B3139A4ECAD41403C0E3BFF9CE55D_159420192241668_d5yshowlekpwgpjum9rs.jpg");
    expect(screen.getByText("Yomra Belediyesi")).toBeTruthy();
  });

  it("opens the map when the visitor taps a photo-book image", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "افتح دفتر صور الشمال التركي" }));
    fireEvent.click(screen.getByRole("button", { name: "أوزنجول والمرتفعات" }));
    fireEvent.click(screen.getByRole("button", { name: "اعرض أوزنجول على خريطة ALASSAUL" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "تفاصيل أوزنجول" })).toBeTruthy());
  });

  it("shows individually named camera previews with official links and one Uzungol camera", () => {
    render(<Home />);

    const expectedGroups = [
      ["مجموعة أوردو", "altinordu.bel.tr/sehir-kameralari"],
      ["مجموعة طرابزون", "trabzon.bel.tr/Web/SehirKameralari"],
      ["كاميرا يومرا – منظر عام", "trabzon.bel.tr/Web/SehirKameralari#camera-3073"],
      ["كاميرا أوزنجول", "trabzon.bel.tr/Web/SehirKameralari#camera-3049"],
      ["كاميرا ميدان طرابزون", "trabzon.bel.tr/Web/SehirKameralari#camera-3055"],
      ["كاميرا ديغيرمندره", "trabzon.bel.tr/Web/SehirKameralari#camera-3047"],
      ["مجموعة سامسون", "mobil.samsun.bel.tr/canliizle.html"],
      ["مجموعة إسطنبول", "ibb.istanbul"],
      ["كاميرا ميدان تقسيم", "istanbuluseyret.ibb.istanbul/tr/turistik-kamera/taksim-meydan"],
      ["كاميرا كاديكوي", "istanbuluseyret.ibb.istanbul/tr/turistik-kamera/kadikoy"],
      ["كاميرا إمينونو", "istanbuluseyret.ibb.istanbul/tr/turistik-kamera/eminonu"],
      ["كاميرا أناضولو حصاري", "istanbuluseyret.ibb.istanbul/tr/turistik-kamera/anadolu-hisari"],
      ["كاميرا تلة تشامليجا", "istanbuluseyret.ibb.istanbul/tr/turistik-kamera/buyuk-camlica"],
      ["كاميرا أوسكودار", "istanbuluseyret.ibb.istanbul/tr/turistik-kamera/uskudar"],
      ["مجموعة ريزا وآيدر", "camlihemsin.bel.tr"],
    ] as const;

    for (const [name, href] of expectedGroups) {
      const link = screen.getByRole("link", { name: `فتح المصدر الرسمي لـ ${name}` }) as HTMLAnchorElement;
      expect(link.href).toContain(href);
    }

    expect(screen.getAllByText(/CAMERA GROUP \/ 0/)).toHaveLength(15);
    const cameraCardText = Array.from(document.querySelectorAll(".camera-card")).map((card) => card.textContent ?? "").join(" ");
    expect(cameraCardText).not.toContain("ألتِن أوردو — أكشاتِبه");
    expect(cameraCardText).not.toContain("ألتِن أوردو — ساحل طاشباشي");
    expect(cameraCardText).not.toContain("أكياظي بارك");
    expect(screen.queryByText("بث مؤكد")).toBeNull();
    expect(document.querySelectorAll(".camera-card .status-pill")).toHaveLength(15);
    expect(Array.from(document.querySelectorAll("a")).filter((anchor) => anchor.href.includes("trabzon.bel.tr/Web/SehirKameralari#camera-3049")).length).toBe(1);
    expect((screen.getByRole("link", { name: "فتح المصدر الرسمي لـ كاميرا ميدان طرابزون" }).querySelector("img") as HTMLImageElement).src).toContain("/img/kameralar/3055.webp");
    expect((screen.getByRole("link", { name: "فتح المصدر الرسمي لـ كاميرا يومرا – منظر عام" }).querySelector("img") as HTMLImageElement).src).toContain("/img/kameralar/3073.webp");
    expect((screen.getByRole("link", { name: "فتح المصدر الرسمي لـ كاميرا ديغيرمندره" }).querySelector("img") as HTMLImageElement).src).toContain("/img/kameralar/3047.webp");
    expect(screen.getByText(/صور واضحة لكل كمرة/)).toBeTruthy();
  });

  it("shows every requested Trabzon destination category", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /افتح صفحة المدينة/ }));
    for (const category of ["قرى ومرتفعات", "تاريخ وثقافة", "تسوق وأسواق", "مقاهٍ ومطاعم", "حدائق وشواطئ", "تلفريك وثلج", "أنشطة ومغامرات"]) {
      expect(screen.getByRole("heading", { name: category, level: 4 })).toBeTruthy();
    }
    expect(screen.getAllByRole("button", { name: "عرض همشِكوي على خريطة ALASSAUL" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "عرض حاجي مصطفى فوق همشِكوي على خريطة ALASSAUL" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "عرض أكبر وأحدث زحليقة في يومرا على خريطة ALASSAUL" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "عرض ركوب الخيل في طرابزون على خريطة ALASSAUL" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "عرض كارتينغ طرابزون على خريطة ALASSAUL" }).length).toBeGreaterThan(0);
    for (const placeName of ["مغارة تشال", "كاياباشا", "بحيرة سيراجول", "أطول زحليقة سيراجول", "الطيران الشراعي في سيراجول", "شاطئ قانيتا", "شاطئ يلنجك", "شارع العرب في بليتلي", "همشِكوي وممشى القرية", "سانتا خراباط", "سلطان مراد", "مول جواهر طرابزون", "ممشى كاشستوس", "مرسى القوارب في يومرا", "حديقة يومرا", "أكبر وأحدث زحليقة في يومرا", "ممشى أكشابات", "تاريخ أكشابات ومعالمها", "حاجي مصطفى فوق همشِكوي", "سوق موللوز", "مسجد غلبهار خاتون (خانتون)", "أكواريوم طرابزون", "سوق القلعة القديم / بدستان", "الحديقة النباتية", "حديقة الفورم", "حديقة الفورميرجي"]) {
      expect(screen.getAllByRole("button", { name: `عرض ${placeName} على خريطة ALASSAUL` }).length).toBeGreaterThan(0);
    }
  });
});

describe("ChatComposer UI", () => {
  it("offers a camera/image attachment control", () => {
    const props = chatProps();
    render(<ChatComposer {...props} />);
    const input = screen.getByLabelText("التقاط صورة أو اختيار صورة") as HTMLInputElement;
    expect(input.accept).toBe("image/*");
    expect(input.getAttribute("capture")).toBe("environment");
    const file = new File(["fake-image"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onImageSelected).toHaveBeenCalledWith(file);
  });
  it("sends text and disables voice when the browser lacks support", () => {
    const props = chatProps({ value: "ما أفضل مدينة؟", voiceSupported: false });
    render(<ChatComposer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }));
    expect(props.onSend).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "voice" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("exposes the microphone and loading state when supported", () => {
    const props = chatProps({ isLoading: true });
    render(<ChatComposer {...props} />);
    expect((screen.getByRole("button", { name: "voice" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "إرسال" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("AssistantReply UI", () => {
  it("starts Arabic speech automatically and exposes a stop action while speaking", () => {
    const originalSpeechSynthesis = window.speechSynthesis;
    const originalUtterance = (globalThis as typeof globalThis & { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    const cancel = vi.fn();
    const speak = vi.fn((utterance: { onstart?: () => void }) => utterance.onstart?.());
    class MockUtterance {
      lang = "";
      rate = 1;
      onstart?: () => void;
      onend?: () => void;
      onerror?: () => void;
      constructor(public text: string) {}
    }

    const maleVoice = { lang: "ar-SA", name: "Arabic Male" } as SpeechSynthesisVoice;
    const femaleVoice = { lang: "ar-SA", name: "Arabic Female" } as SpeechSynthesisVoice;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel, resume: vi.fn(), speak, getVoices: () => [femaleVoice, maleVoice], speaking: true, pending: false, paused: false } });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: MockUtterance });

    try {
      const renderStartedAt = performance.now();
      render(<AssistantReply text="وعليكم السلام ورحمة الله وبركاته" language="AR" voiceGender="male" />);
      const renderToSpeakMs = performance.now() - renderStartedAt;
      expect(renderToSpeakMs).toBeLessThan(250);
      expect(speak).toHaveBeenCalledOnce();
      const spoken = speak.mock.calls[0]?.[0] as MockUtterance & { voice?: SpeechSynthesisVoice; pitch?: number; rate?: number };
      expect(spoken.lang).toBe("ar-SA");
      expect(spoken.rate).toBe(0.96);
      expect(spoken.pitch).toBe(0.88);
      expect(spoken.voice?.name).toBe("Arabic Male");
      expect(screen.getByRole("button", { name: "إيقاف الرد الصوتي" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "إيقاف الرد الصوتي" }));
      expect(cancel).toHaveBeenCalledTimes(2);
    } finally {
      Object.defineProperty(window, "speechSynthesis", { configurable: true, value: originalSpeechSynthesis });
      Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: originalUtterance });
    }
  });

  it("waits for voiceschanged before speaking when the browser initially returns no voices", () => {
    const originalSpeechSynthesis = window.speechSynthesis;
    const originalUtterance = (globalThis as typeof globalThis & { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    const speak = vi.fn();
    const listeners: Array<() => void> = [];
    let availableVoices: SpeechSynthesisVoice[] = [];
    class DelayedUtterance {
      voice?: SpeechSynthesisVoice;
      lang = "";
      rate = 1;
      pitch = 1;
      onstart?: () => void;
      onend?: () => void;
      onerror?: () => void;
      constructor(public text: string) {}
    }
    const maleVoice = { lang: "ar-SA", name: "Arabic Male" } as SpeechSynthesisVoice;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel: vi.fn(), resume: vi.fn(), speak, getVoices: () => availableVoices, addEventListener: (_name: string, listener: () => void) => listeners.push(listener), removeEventListener: vi.fn() } });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: DelayedUtterance });
    try {
      render(<AssistantReply text="السلام عليكم" language="AR" voiceGender="male" />);
      expect(speak).not.toHaveBeenCalled();
      availableVoices = [maleVoice];
      listeners[0]?.();
      expect(speak).toHaveBeenCalledOnce();
      expect((speak.mock.calls[0]?.[0] as DelayedUtterance).voice?.name).toBe("Arabic Male");
    } finally {
      Object.defineProperty(window, "speechSynthesis", { configurable: true, value: originalSpeechSynthesis });
      Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: originalUtterance });
    }
  });

  it("uses a neutral Arabic fallback when no Arabic male voice is available", () => {
    const originalSpeechSynthesis = window.speechSynthesis;
    const originalUtterance = (globalThis as typeof globalThis & { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    const speak = vi.fn();
    class FallbackUtterance {
      voice?: SpeechSynthesisVoice;
      lang = "";
      rate = 1;
      pitch = 1;
      onstart?: () => void;
      onend?: () => void;
      onerror?: () => void;
      constructor(public text: string) {}
    }
    const ArabicFemale = { lang: "ar-SA", name: "Arabic Female" } as SpeechSynthesisVoice;
    const ArabicNeutral = { lang: "ar-SA", name: "Arabic Voice" } as SpeechSynthesisVoice;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel: vi.fn(), resume: vi.fn(), speak, getVoices: () => [ArabicFemale, ArabicNeutral] } });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: FallbackUtterance });
    try {
      render(<AssistantReply text="السلام عليكم" language="AR" voiceGender="male" />);
      expect((speak.mock.calls[0]?.[0] as FallbackUtterance).voice?.name).toBe("Arabic Voice");
    } finally {
      Object.defineProperty(window, "speechSynthesis", { configurable: true, value: originalSpeechSynthesis });
      Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: originalUtterance });
    }
  });
});

describe("Platform branding", () => {
  it("uses the requested ALASSAUL-AI platform title", () => {
    expect(import.meta.env.VITE_APP_TITLE ?? "ALASSAUL-AI | بوابتك للشمال التركي").toBe("ALASSAUL-AI | بوابتك للشمال التركي");
    render(<Home />);
    expect(screen.getByRole("button", { name: "ALASSAUL-AI — بوابتك للشمال التركي" })).toBeTruthy();
    expect(screen.getByText("بوابتك للشمال التركي")).toBeTruthy();
  });
});

describe("VoiceSelector UI", () => {
  it("shows an honest fallback when the device has no distinct Arabic male voice", async () => {
    const originalSpeechSynthesis = window.speechSynthesis;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [{ lang: "ar-SA", name: "Arabic Female" }], addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    try {
      window.localStorage.setItem("alassault-voice-gender", "male");
      render(<VoiceSelector />);
      await waitFor(() => expect(screen.getByText(/لا يوفر جهازك صوت رجل عربي مستقلاً/)).toBeTruthy());
    } finally {
      Object.defineProperty(window, "speechSynthesis", { configurable: true, value: originalSpeechSynthesis });
    }
  });

  it("switches gender and persists the selected voice", () => {
    window.localStorage.clear();
    const onChange = vi.fn();
    const { unmount } = render(<VoiceSelector onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "اختيار صوت الرد" }) as HTMLSelectElement;
    expect(select.value).toBe("male");
    fireEvent.change(select, { target: { value: "female" } });
    expect(onChange).toHaveBeenCalledWith("female");
    expect(window.localStorage.getItem("alassault-voice-gender")).toBe("female");
    unmount();
    render(<VoiceSelector />);
    expect((screen.getByRole("combobox", { name: "اختيار صوت الرد" }) as HTMLSelectElement).value).toBe("female");
  });
});

describe("LiveStatusView UI", () => {
  const baseProps = {
    title: "مكة المكرمة",
    subtitle: "بث مباشر",
    video: "sample",
    sourceUrl: "https://example.com/live",
    sourceType: "youtube" as const,
    onReady: vi.fn(),
    onUnavailable: vi.fn(),
    onToggleStop: vi.fn(),
  };

  it("shows loading, ready, stopped, and unavailable messages", () => {
    const { rerender } = render(<LiveStatusView {...baseProps} status="loading" />);
    expect(screen.getByText("جاري التحقق من المصدر؛ لن نعرضه كبث مباشر قبل بدء التشغيل فعلياً…")).toBeTruthy();
    rerender(<LiveStatusView {...baseProps} status="ready" />);
    expect(screen.getByText(/القناة تعمل داخل المنصة مباشرة/)).toBeTruthy();
    rerender(<LiveStatusView {...baseProps} status="stopped" />);
    expect(screen.getByText("تم إيقاف البث مؤقتاً")).toBeTruthy();
    rerender(<LiveStatusView {...baseProps} status="unavailable" />);
    expect(screen.getByText(/المشغل لم يبدأ في هذا المتصفح/)).toBeTruthy();
  });

  it("calls the stop/resume action from the visible button", () => {
    const props = { ...baseProps, status: "ready" as const };
    render(<LiveStatusView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /إيقاف مؤقت/ }));
    expect(props.onToggleStop).toHaveBeenCalledOnce();
  });

  it("forwards iframe failures to the unavailable state", () => {
    const props = { ...baseProps, status: "loading" as const };
    render(<LiveStatusView {...props} />);
    window.dispatchEvent(new MessageEvent("message", { origin: "https://www.youtube-nocookie.com", data: JSON.stringify({ event: "onError", info: { errorCode: 150 } }) }));
    expect(props.onUnavailable).toHaveBeenCalledOnce();
  });

  it("does not claim a YouTube stream is ready from iframe load alone", () => {
    const onReady = vi.fn();
    render(<LiveStatusView {...baseProps} status="loading" onReady={onReady} />);
    fireEvent.load(screen.getByTitle("مكة المكرمة"));
    expect(onReady).not.toHaveBeenCalled();
  });

  it("shows an official camera action without a blank iframe or false ready state", () => {
    const onReady = vi.fn();
    render(<LiveStatusView {...baseProps} sourceType="official-page" video="" sourceUrl="https://www.trabzon.bel.tr/Web/SehirKameralari#akcatepe" status="loading" onReady={onReady} />);
    expect((screen.getByRole("link", { name: /فتح قناة مكة المكرمة/ }) as HTMLAnchorElement).getAttribute("href")).toBe("https://www.trabzon.bel.tr/Web/SehirKameralari#akcatepe");
    expect(screen.queryByTitle("مكة المكرمة")).toBeNull();
    expect(onReady).not.toHaveBeenCalled();
  });
});

describe("Directions in chat", () => {
  it("extracts an Arabic destination and optional origin", () => {
    expect(parseRouteRequest("أريد الطريق من طرابزون إلى يمرة")).toEqual({ origin: "Trabzon", destinations: ["Yomra"] });
    expect(parseRouteRequest("أريد الطريق إلى جدة أو مكة")).toEqual({ destinations: ["Jeddah", "Makkah"] });
    expect(parseRouteRequest("أريد الطريق إلى بلدتي أو إلى يمرة")).toEqual({ destinations: ["بلدتي", "Yomra"] });
    expect(parseRouteRequest("ما أفضل مطعم في طرابزون؟")).toBeNull();
  });

  it("renders an interactive route card after asking for directions", async () => {
    mutateAsyncMock.mockResolvedValue({ text: "سأعرض لك الطريق على الخريطة الآن." });
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "chat" }));
    const input = screen.getByRole("textbox", { name: "سؤال المساعد" });
    fireEvent.change(input, { target: { value: "أريد الطريق من طرابزون إلى يمرة" } });
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }));

    await waitFor(() => expect(screen.getByText("سأعرض لك الطريق على الخريطة الآن.")).toBeTruthy());
    expect(screen.getByText("Yomra")).toBeTruthy();
    expect(screen.getByRole("link", { name: "فتح الاتجاهات في Google Maps" })).toBeTruthy();
    expect(screen.getByTestId("route-map-view")).toBeTruthy();
  });
});

describe("Redesign entry points and notifications", () => {
  it("shows the three journey paths and opens the live source inside the broadcast box", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: /وجهات موثوقة/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /خريطة يومك/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /مساعد الرحلة/ })).toBeTruthy();
    const mapTarget = document.getElementById("map") as HTMLElement;
    mapTarget.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "افتح خريطة يومك" }));
    expect(mapTarget.scrollIntoView).toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "سؤال المساعد" })).toBeNull();
    const gmailEntry = screen.getByRole("link", { name: /فتح Gmail في تبويب جديد/ }) as HTMLAnchorElement;
    expect(gmailEntry.getAttribute("href")).toBe("https://mail.google.com/mail/u/0/");
    expect(gmailEntry.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("button", { name: /اسأل المساعد/ })).toBeTruthy();
    const cameraEntry = screen.getByRole("button", { name: /شاهد الكاميرات/ });
    expect(cameraEntry.querySelector(".camera-cta-thumb img")).toBeTruthy();
    fireEvent.click(cameraEntry);
    expect(document.getElementById("cameras")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /مكة المكرمة/ }));
    expect(screen.getByTitle("مكة المكرمة")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إغلاق البث" })).toBeTruthy();
  });
});

describe("Guestbook studio upload", () => {
  it("offers a gallery/studio picker without the camera capture constraint", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /دفتر الزوار|الذكريات|صورة/ }));
    const studioButton = screen.getByRole("button", { name: "اختيار من الاستوديو" });
    expect(studioButton).toBeTruthy();
    const imageInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    expect(imageInput).toBeTruthy();
    expect(imageInput.hasAttribute("capture")).toBe(false);
  });
});

describe("Account, live modal, and place details", () => {
  it("offers email and phone as optional account methods without a fake password flow", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /دخول الحساب/ }));
    expect(screen.getByRole("tab", { name: /البريد الإلكتروني/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /رقم الجوال/ }));
    expect(screen.getByText(/سيتم فتح بوابة الدخول/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /متابعة الدخول الآمن/ })).toBeTruthy();
  });

  it("opens a selected place chip directly on the in-app map", async () => {
    render(<Home />);
    const placeButton = document.querySelector(".place-chips button") as HTMLButtonElement;
    expect(placeButton).toBeTruthy();
    fireEvent.click(placeButton);
    await waitFor(() => expect(screen.getByRole("region", { name: "تفاصيل أوزنجول" })).toBeTruthy());
    expect(screen.getByRole("link", { name: /احصل على الاتجاهات/ })).toBeTruthy();
  });

  it("opens the selected live channel inside the broadcast box without the old modal", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /مكة المكرمة/ }));
    expect(screen.getByTitle("مكة المكرمة")).toBeTruthy();
    expect(document.querySelector(".modal-card-live")).toBeNull();
  });
});

describe("Entertainment memory game", () => {
  it("opens a playable memory board with restart and move counter", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /ألعاب خفيفة/ }));
    fireEvent.click(screen.getByRole("tab", { name: /الألعاب/ }));
    expect(screen.getByRole("grid", { name: "لعبة الذاكرة" })).toBeTruthy();
    const cards = screen.getAllByRole("button", { name: "بطاقة مخفية" });
    expect(cards).toHaveLength(12);
    fireEvent.click(cards[0]);
    fireEvent.click(cards[1]);
    await waitFor(() => expect(screen.getByTestId("memory-moves").textContent).toBe("1"), { timeout: 1000 });
    expect(screen.getByRole("button", { name: "لعبة جديدة" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "لعبة جديدة" }));
    expect(screen.getAllByRole("button", { name: "بطاقة مخفية" })).toHaveLength(12);
  });
});

describe("TikTok profile page", () => {
  it("shows the official Trabzon Yomra account with distinct follow and video links", () => {
    render(<Home />);
    const links = screen.getAllByRole("link", { name: /@trabzon_yomra|مشاهدة الفيديوهات|متابعة الحساب/ });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect((link as HTMLAnchorElement).href).toBe("https://www.tiktok.com/@trabzon_yomra");
    expect(screen.getByText("الحساب الرسمي · TikTok")).toBeTruthy();
  });
});

describe("Official live channel actions", () => {
  it("opens the Makkah channel inside the broadcast box", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /مكة المكرمة/ }));
    const iframe = screen.getByTitle("مكة المكرمة") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain("youtube-nocookie.com/embed/eC4LfEVxvKg");
    expect(document.querySelector(".video-shell")).toBeNull();
  });

  it("keeps all four broadcast channel cards actionable", () => {
    render(<Home />);
    for (const name of ["مكة المكرمة", "المدينة المنورة", "قناة الحدث", "أخبار الشمال التركي"]) {
      const card = screen.getByRole("button", { name: new RegExp(name) });
      expect(card).toBeTruthy();
    }
  });

  it("opens Northern Turkey News on the official TRT Haber live stream", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /أخبار الشمال التركي/ }));
    const iframe = screen.getByTitle("أخبار الشمال التركي") as HTMLIFrameElement;
    expect(iframe.src).toContain("youtube-nocookie.com/embed/live_stream");
    expect(iframe.src).toContain("channel=UCBgTP2LOFVPmq15W-RH-WXA");
  });
});

describe("City and place detail actions", () => {
  it("opens the selected city file with its image when a city tab is clicked", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /02.*ريزا.*Rize/ }));
    expect(screen.getByRole("heading", { name: /ريزا — Rize/ })).toBeTruthy();
    expect(screen.getAllByAltText("ريزا").length).toBeGreaterThan(0);
    expect(screen.getByText("اختر أي وجهة لعرضها على الخريطة")).toBeTruthy();
    expect(screen.getByText("المعالم")).toBeTruthy();
    expect(screen.getByText("القرى والامتداد")).toBeTruthy();
  });

  it("opens map details and directions from an Uzungol place chip", async () => {
    render(<Home />);
    fireEvent.click(screen.getAllByRole("button", { name: /أوزنجول/ })[0]!);
    await waitFor(() => expect(screen.getByRole("region", { name: "تفاصيل أوزنجول" })).toBeTruthy());
    expect(screen.getByRole("link", { name: /احصل على الاتجاهات/ })).toBeTruthy();
  });
});

describe("Interactive north map", () => {
  it("opens the map as a full-screen mobile workspace with one map search", () => {
    const { container } = render(<InteractiveNorthMap />);
    expect(screen.getAllByRole("textbox", { name: "ابحث في الخريطة" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /فتح الخريطة بحجم كامل/ }));
    expect(document.body.querySelector(".north-map-expanded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /إغلاق الخريطة/ }));
    expect(document.body.querySelector(".north-map-expanded")).toBeNull();
  });

  it("includes the eastern Trabzon coastal towns in the city picker", () => {
    render(<InteractiveNorthMap />);
    for (const city of ["يومرا", "أرسين", "سورميني", "أراكلي"]) {
      fireEvent.click(screen.getByRole("tab", { name: city }));
      expect(screen.getByText(new RegExp(`${city} · الوجهات`))).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /اختيار وجهة الخريطة رقم/ }).length).toBeGreaterThan(0);
    }
  });

  it("filters destinations and selects a destination when its map control is pressed", () => {
    render(<InteractiveNorthMap />);
    fireEvent.click(screen.getByRole("tab", { name: "ريزا" }));
    fireEvent.click(screen.getByRole("button", { name: "طبيعة" }));
    expect(screen.getAllByText("أيدر").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /اختيار وجهة الخريطة رقم/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "اختيار وجهة الخريطة رقم 1" })[0]!);
    expect(screen.getByRole("region", { name: /تفاصيل/ }).textContent).toContain("أيدر");
  });
});

it("opens and closes the mobile navigation from the hamburger button", () => {
  render(<Home />);
  const menuButton = screen.getByRole("button", { name: "فتح القائمة" });
  expect(menuButton.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(menuButton);
  const closeButton = screen.getAllByRole("button", { name: "إغلاق القائمة" }).find((button) => button.getAttribute("aria-expanded") === "true");
  expect(closeButton).toBeTruthy();
  expect(screen.getByRole("navigation").getAttribute("aria-hidden")).toBe("false");
  fireEvent.click(closeButton!);
  expect(screen.getByRole("button", { name: "فتح القائمة" }).getAttribute("aria-expanded")).toBe("false");
});

it("keeps the assistant panel physically centered in RTL layouts", () => {
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "chat" }));
  const panel = document.querySelector(".chat-panel");
  expect(panel).toBeTruthy();
  expect(getComputedStyle(panel as HTMLElement).left).toBe("12px");
  expect(getComputedStyle(panel as HTMLElement).right).toBe("12px");
  expect(getComputedStyle(panel as HTMLElement).transform).toBe("none");
});

describe("Global search guidance", () => {
  it("explains when a query has no match in the local directory", () => {
    render(<Home />);
    fireEvent.change(screen.getByRole("textbox", { name: "بحث عالمي عن الأماكن والخدمات" }), {
      target: { value: "مستشفى في جدة" },
    });
    expect(screen.getByRole("status").textContent).toContain("لا توجد نتيجة مطابقة في دليلنا المحلي بعد");
    expect(screen.getByRole("button", { name: "بحث عالمي" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ابحث عن هذا المكان في الخرائط" })).toBeTruthy();
  });

  it("shows local directory matches separately from global continuation", () => {
    render(<Home />);
    fireEvent.change(screen.getByRole("textbox", { name: "بحث عالمي عن الأماكن والخدمات" }), {
      target: { value: "أوزنجول" },
    });
    expect(screen.getAllByText(/نتيجة من دليل ALASSAUL/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "بحث عالمي" })).toBeTruthy();
  });
});
