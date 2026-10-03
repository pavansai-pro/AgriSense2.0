"use client";

import { ChatPanel } from "@/components/agri/chat-panel";
import { PageHeader } from "@/components/agri/page-header";
import { useApp } from "@/components/app-provider";
import { Card, CardContent } from "@/components/ui/card";

const SUGGESTIONS: Record<string, string[]> = {
  en: ["How do I fix acidic soil?", "How to prevent blight in tomato?", "Heavy rain is coming, what should I do?"],
  hi: ["अम्लीय मिट्टी कैसे ठीक करें?", "टमाटर में झुलसा रोग कैसे रोकें?", "भारी बारिश आने वाली है, क्या करूँ?"],
  te: ["ఆమ్ల నేలను ఎలా సరిచేయాలి?", "టమాటాలో ఆకుమచ్చ తెగులు ఎలా నివారించాలి?", "భారీ వర్షం వస్తోంది, ఏమి చేయాలి?"],
  ta: ["அமில மண்ணை எப்படி சரிசெய்வது?", "தக்காளியில் இலைக்கருகல் நோயை எப்படி தடுப்பது?", "கனமழை வருகிறது, என்ன செய்ய வேண்டும்?"],
  mr: ["आम्लयुक्त माती कशी सुधारावी?", "टोमॅटोवरील करपा कसा टाळावा?", "मुसळधार पाऊस येणार आहे, काय करावे?"],
};

export default function AssistantPage() {
  const { t, lang } = useApp();
  return (
    <>
      <PageHeader title={t("assistant")} description={t("askAssistant")} />
      <Card>
        <CardContent>
          <ChatPanel suggestions={SUGGESTIONS[lang] ?? SUGGESTIONS.en} className="[&_[data-slot=scroll-area]]:h-[55vh]" />
        </CardContent>
      </Card>
    </>
  );
}
