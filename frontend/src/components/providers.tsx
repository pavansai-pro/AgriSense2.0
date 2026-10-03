"use client";

import { ThemeProvider } from "next-themes";

import { AppProvider } from "@/components/app-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VoiceProvider } from "@/components/voice-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <AppProvider>
        <VoiceProvider>
          <TooltipProvider>
            {children}
            <Toaster position="top-center" richColors />
          </TooltipProvider>
        </VoiceProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
