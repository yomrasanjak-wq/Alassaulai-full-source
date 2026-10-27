export type LiveStatus = "loading" | "ready" | "stopped" | "unavailable";

export function getLiveStatusLabel(status: LiveStatus) {
  switch (status) {
    case "ready":
      return "يعمل الآن";
    case "stopped":
      return "متوقف";
    case "unavailable":
      return "المصدر غير متاح";
    default:
      return "جاري التحميل";
  }
}
