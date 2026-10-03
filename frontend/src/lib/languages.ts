export const LANGUAGES = [
  { code: "en", label: "English", native: "English", speech: "en-IN" },
  { code: "hi", label: "Hindi", native: "हिंदी", speech: "hi-IN" },
  { code: "te", label: "Telugu", native: "తెలుగు", speech: "te-IN" },
  { code: "ta", label: "Tamil", native: "தமிழ்", speech: "ta-IN" },
  { code: "mr", label: "Marathi", native: "मराठी", speech: "mr-IN" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export const speechLang = (lang: Lang) =>
  LANGUAGES.find((l) => l.code === lang)?.speech ?? "en-IN";
