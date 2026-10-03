import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_Tamil, Noto_Sans_Telugu } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const latin = Noto_Sans({ subsets: ["latin"], variable: "--font-noto", display: "swap" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--font-telu", display: "swap" });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-taml", display: "swap" });

export const metadata: Metadata = {
  title: { default: "AgriSense", template: "%s · AgriSense" },
  description: "Voice-first crop advice, 16-day weather and crop risk alerts for Indian farmers in 5 languages.",
  manifest: "/manifest.webmanifest",
  applicationName: "AgriSense",
  appleWebApp: { capable: true, title: "AgriSense", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#166534" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a12" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${latin.variable} ${devanagari.variable} ${telugu.variable} ${tamil.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
