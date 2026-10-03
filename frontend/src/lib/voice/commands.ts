import type { Lang } from "@/lib/languages";
import type { Soil } from "@/lib/types";

export type Intent =
  | { type: "navigate"; route: string }
  | { type: "logout" }
  | { type: "theme"; value: "dark" | "light" }
  | { type: "language"; value: Lang }
  | { type: "help" }
  | { type: "sync" }
  | { type: "submit" }
  | { type: "read" };

type Rule = { intent: Intent; keywords: Partial<Record<Lang, string[]>> & { en: string[] } };

// Keywords from every language are matched regardless of the active language,
// because farmers often mix English words ("weather", "risk") into their speech.
const RULES: Rule[] = [
  {
    intent: { type: "navigate", route: "/risk" },
    keywords: {
      en: ["risk", "danger", "assessment"],
      hi: ["जोखिम", "खतरा"],
      te: ["ప్రమాదం", "రిస్క్"],
      ta: ["ஆபத்து", "அபாயம்"],
      mr: ["धोका", "जोखीम"],
    },
  },
  {
    intent: { type: "navigate", route: "/crop" },
    keywords: {
      en: ["crop", "predict", "prediction", "which crop"],
      hi: ["फसल", "फ़सल"],
      te: ["పంట"],
      ta: ["பயிர்"],
      mr: ["पीक", "पिक"],
    },
  },
  {
    intent: { type: "navigate", route: "/weather" },
    keywords: {
      en: ["weather", "forecast", "rain", "temperature today"],
      hi: ["मौसम", "बारिश"],
      te: ["వాతావరణం", "వర్షం"],
      ta: ["வானிலை", "மழை"],
      mr: ["हवामान", "पाऊस"],
    },
  },
  {
    intent: { type: "navigate", route: "/records" },
    keywords: {
      en: ["record", "records", "soil data", "field", "harvest record"],
      hi: ["रिकॉर्ड", "मिट्टी"],
      te: ["రికార్డు", "నేల"],
      ta: ["பதிவு", "மண்"],
      mr: ["नोंद", "माती"],
    },
  },
  {
    intent: { type: "navigate", route: "/assistant" },
    keywords: {
      en: ["assistant", "chat", "advice", "ask"],
      hi: ["सहायक", "सलाह"],
      te: ["సహాయకుడు", "సలహా"],
      ta: ["உதவியாளர்", "ஆலோசனை"],
      mr: ["सहाय्यक", "सल्ला"],
    },
  },
  {
    intent: { type: "navigate", route: "/settings" },
    keywords: {
      en: ["settings", "setting", "options"],
      hi: ["सेटिंग", "सेटिंग्स"],
      te: ["సెట్టింగ్", "సెట్టింగ్‌లు"],
      ta: ["அமைப்பு", "அமைப்புகள்"],
      mr: ["सेटिंग", "सेटिंग्ज"],
    },
  },
  {
    intent: { type: "navigate", route: "/profile" },
    keywords: {
      en: ["profile", "my account"],
      hi: ["प्रोफ़ाइल", "प्रोफाइल"],
      te: ["ప్రొఫైల్"],
      ta: ["சுயவிவரம்"],
      mr: ["प्रोफाइल"],
    },
  },
  {
    intent: { type: "navigate", route: "/dashboard" },
    keywords: {
      en: ["dashboard", "home", "main page", "go back"],
      hi: ["डैशबोर्ड", "होम", "मुख्य"],
      te: ["డాష్‌బోర్డ్", "హోమ్", "ముఖ్య"],
      ta: ["முகப்பு", "டாஷ்போர்டு"],
      mr: ["डॅशबोर्ड", "मुख्यपृष्ठ", "होम"],
    },
  },
  {
    intent: { type: "navigate", route: "/login" },
    keywords: { en: ["login", "log in", "sign in"], hi: ["लॉगिन", "लॉग इन"], te: ["లాగిన్"], ta: ["உள்நுழை"], mr: ["लॉगिन"] },
  },
  {
    intent: { type: "logout" },
    keywords: {
      en: ["logout", "log out", "sign out"],
      hi: ["लॉगआउट", "लॉग आउट"],
      te: ["లాగౌట్"],
      ta: ["வெளியேறு"],
      mr: ["लॉगआउट", "लॉग आउट"],
    },
  },
  {
    intent: { type: "theme", value: "dark" },
    keywords: { en: ["dark mode", "dark"], hi: ["डार्क"], te: ["డార్క్"], ta: ["இருண்ட"], mr: ["डार्क"] },
  },
  {
    intent: { type: "theme", value: "light" },
    keywords: { en: ["light mode", "light"], hi: ["लाइट"], te: ["లైట్"], ta: ["வெளிச்ச"], mr: ["लाइट"] },
  },
  { intent: { type: "language", value: "en" }, keywords: { en: ["english", "अंग्रेजी", "ఇంగ్లీష్", "ஆங்கிலம்", "इंग्रजी"] } },
  { intent: { type: "language", value: "hi" }, keywords: { en: ["hindi", "हिंदी", "हिन्दी", "హిందీ", "இந்தி"] } },
  { intent: { type: "language", value: "te" }, keywords: { en: ["telugu", "తెలుగు", "तेलुगु", "தெலுங்கு"] } },
  { intent: { type: "language", value: "ta" }, keywords: { en: ["tamil", "தமிழ்", "तमिल", "తమిళం"] } },
  { intent: { type: "language", value: "mr" }, keywords: { en: ["marathi", "मराठी", "మరాఠీ", "மராத்தி"] } },
  {
    intent: { type: "sync" },
    keywords: { en: ["sync", "upload"], hi: ["सिंक"], te: ["సింక్"], ta: ["ஒத்திசை"], mr: ["सिंक"] },
  },
  {
    intent: { type: "submit" },
    keywords: {
      en: ["submit", "check", "calculate", "get advice", "go"],
      hi: ["जांचें", "जाँचो", "जांच", "भेजो"],
      te: ["తనిఖీ", "పంపు"],
      ta: ["சரிபார்", "அனுப்பு"],
      mr: ["तपासा", "पाठवा"],
    },
  },
  {
    intent: { type: "read" },
    keywords: { en: ["read", "speak", "tell me"], hi: ["पढ़ो", "सुनाओ", "बताओ"], te: ["చదువు", "చెప్పు"], ta: ["படி", "சொல்"], mr: ["वाचा", "सांगा"] },
  },
  {
    intent: { type: "help" },
    keywords: { en: ["help", "commands", "what can i say"], hi: ["मदद"], te: ["సహాయం"], ta: ["உதவி"], mr: ["मदत"] },
  },
];

const DIGIT_BLOCKS = [0x0966, 0x0c66, 0x0be6]; // Devanagari, Telugu, Tamil

export function normalizeDigits(text: string) {
  return text.replace(/[\u0966-\u096F\u0C66-\u0C6F\u0BE6-\u0BEF]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const base = DIGIT_BLOCKS.find((b) => code >= b && code <= b + 9)!;
    return String(code - base);
  });
}

export function normalize(text: string) {
  return normalizeDigits(text)
    .toLowerCase()
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/[,!?।]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchIntent(transcript: string, lang: Lang): Intent | null {
  const text = normalize(transcript);
  let best: { intent: Intent; len: number; own: boolean } | null = null;
  for (const rule of RULES) {
    for (const [kwLang, words] of Object.entries(rule.keywords)) {
      for (const w of words ?? []) {
        const kw = w.toLowerCase();
        const isAscii = /^[a-z ]+$/.test(kw);
        const hit = isAscii ? new RegExp(`(^|\\s)${kw}(\\s|$)`).test(text) : text.includes(kw);
        if (!hit) continue;
        const own = kwLang === lang;
        if (!best || kw.length > best.len || (kw.length === best.len && own && !best.own)) {
          best = { intent: rule.intent, len: kw.length, own };
        }
      }
    }
  }
  return best?.intent ?? null;
}

const FIELD_WORDS: Record<keyof Soil, string[]> = {
  n: ["nitrogen", "नाइट्रोजन", "नत्रजन", "नायट्रोजन", "నత్రజని", "నైట్రోజన్", "நைட்ரஜன்"],
  p: ["phosphorus", "phosphorous", "फास्फोरस", "फॉस्फरस", "स्फुरद", "భాస్వరం", "ఫాస్ఫరస్", "பாஸ்பரஸ்"],
  k: ["potassium", "potash", "पोटैशियम", "पोटाश", "पालाश", "पोटॅशियम", "పొటాషియం", "பொட்டாசியம்"],
  moisture: ["moisture", "नमी", "ओलावा", "తేమ", "ஈரப்பதம்"],
  temperature: ["temperature", "तापमान", "ఉష్ణోగ్రత", "வெப்பநிலை"],
  ph: ["ph", "p h", "पीएच", "पी एच", "పీహెచ్", "பிஎச்", "பி எச்"],
};

/** Extract soil values from speech like "nitrogen 90 phosphorus 40 pH 6.5". */
export function parseSoilValues(transcript: string): Partial<Soil> {
  const text = normalize(transcript).replace(/(\d)\s*(point|dot|दशमलव|पॉइंट)\s*(\d)/g, "$1.$3");
  const found: { field: keyof Soil; index: number; length: number }[] = [];
  for (const [field, words] of Object.entries(FIELD_WORDS) as [keyof Soil, string[]][]) {
    for (const w of words) {
      // ASCII keywords must be whole words so "ph" doesn't match inside "phosphorus".
      const re = /^[a-z ]+$/.test(w) ? new RegExp(`(?<![a-z])${w}(?![a-z])`) : null;
      const index = re ? text.search(re) : text.indexOf(w);
      if (index >= 0) {
        found.push({ field, index, length: w.length });
        break;
      }
    }
  }
  found.sort((a, b) => a.index - b.index);
  const out: Partial<Soil> = {};
  found.forEach((f, i) => {
    const end = found[i + 1]?.index ?? text.length;
    const num = text.slice(f.index + f.length, end).match(/\d+(\.\d+)?/);
    if (num) out[f.field] = Number(num[0]);
  });
  return out;
}

export function extractDigits(transcript: string) {
  return normalizeDigits(transcript).replace(/\D/g, "");
}
