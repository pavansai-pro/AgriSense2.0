"use client";

import { Loader2, LogIn, Mic, Sprout, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LocationPicker } from "@/components/agri/location-picker";
import { useApp } from "@/components/app-provider";
import { LanguageSelect } from "@/components/language-select";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVoice } from "@/components/voice-provider";
import { api } from "@/lib/api";
import type { TokenResponse } from "@/lib/types";
import { extractDigits } from "@/lib/voice/commands";

export default function LoginPage() {
  const { t, lang, user, signIn, online } = useApp();
  const { supported, listening, interim, listenOnce, speak } = useVoice();
  const router = useRouter();
  const [tab, setTab] = useState("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceStep, setVoiceStep] = useState<"idle" | "phone" | "pin">("idle");
  const [google, setGoogle] = useState(false);
  const [reg, setReg] = useState({ name: "", phone: "", pin: "", state: "", district: "" });

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (online) api<{ google: boolean }>("/api/auth/providers").then((p) => setGoogle(p.google)).catch(() => {});
  }, [online]);

  async function login(username: string, password: string) {
    setBusy(true);
    try {
      const res = await api<TokenResponse>("/api/auth/login", { method: "POST", form: { username, password } });
      signIn(res);
      speak(t("welcome", { name: res.user.name }));
      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("error");
      toast.error(msg);
      speak(msg);
    } finally {
      setBusy(false);
    }
  }

  function speakAndWait(text: string) {
    return new Promise<void>((resolve) => {
      speak(text);
      const synth = window.speechSynthesis;
      const started = Date.now();
      const poll = window.setInterval(() => {
        if ((!synth.speaking && Date.now() - started > 300) || Date.now() - started > 6000) {
          window.clearInterval(poll);
          resolve();
        }
      }, 150);
    });
  }

  async function voiceLogin() {
    if (!supported) return toast.error(t("voiceUnsupported"));
    setVoiceStep("phone");
    await speakAndWait(t("sayPhone"));
    const spokenPhone = extractDigits((await listenOnce()) ?? "");
    if (spokenPhone.length < 10) {
      setVoiceStep("idle");
      speak(t("notUnderstood"));
      return toast.error(`${t("phone")}: ${spokenPhone || "—"}`);
    }
    setPhone(spokenPhone);
    setVoiceStep("pin");
    await speakAndWait(t("sayPin"));
    const spokenPin = extractDigits((await listenOnce()) ?? "");
    setVoiceStep("idle");
    if (spokenPin.length < 4) {
      speak(t("notUnderstood"));
      return toast.error(t("pin"));
    }
    setPin(spokenPin);
    await login(spokenPhone, spokenPin);
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<TokenResponse>("/api/auth/register", {
        method: "POST",
        json: { ...reg, phone: extractDigits(reg.phone), state: reg.state || null, district: reg.district || null, language: lang },
      });
      signIn(res);
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-to-b from-primary/10 to-background">
      <header className="flex items-center justify-between gap-2 p-4">
        <StatusBadge />
        <LanguageSelect className="w-32" />
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 pb-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Sprout className="size-9" aria-hidden />
          </span>
          <h1 className="text-3xl font-bold tracking-tight">{t("appName")}</h1>
          <p className="text-muted-foreground">{t("tagline")}</p>
        </div>

        <Button
          size="lg"
          className="h-20 rounded-2xl text-xl shadow-lg"
          onClick={() => void voiceLogin()}
          disabled={busy || listening || voiceStep !== "idle"}
          data-testid="voice-login"
        >
          {voiceStep !== "idle" ? <Loader2 className="size-7 animate-spin" /> : <Mic className="size-7" />}
          {voiceStep === "phone" ? t("sayPhone") : voiceStep === "pin" ? t("sayPin") : t("voiceLogin")}
        </Button>
        {listening && (
          <p className="text-center text-lg font-medium" role="status" aria-live="assertive">
            {interim || t("listening")}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1" />
          <span>or</span>
          <Separator className="flex-1" />
        </div>

        <Card>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="gap-4">
              <TabsList className="h-11 w-full">
                <TabsTrigger value="login" className="text-base">
                  {t("login")}
                </TabsTrigger>
                <TabsTrigger value="register" className="text-base">
                  {t("register")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void login(phone, pin);
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone">{t("phone")}</Label>
                    <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 text-lg" placeholder="98765 43210" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pin">{t("pin")}</Label>
                    <Input id="pin" type="password" inputMode="numeric" autoComplete="current-password" required pattern="\d{4,6}" value={pin} onChange={(e) => setPin(e.target.value)} className="h-12 text-lg tracking-widest" />
                  </div>
                  <Button type="submit" size="lg" className="h-12 text-base" disabled={busy || !online}>
                    {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
                    {t("login")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form className="flex flex-col gap-4" onSubmit={register}>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="r-name">{t("name")}</Label>
                    <Input id="r-name" required autoComplete="name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} className="h-12 text-base" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="r-phone">{t("phone")}</Label>
                    <Input id="r-phone" type="tel" inputMode="tel" required value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} className="h-12 text-base" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="r-pin">{t("pin")}</Label>
                    <Input id="r-pin" type="password" inputMode="numeric" required pattern="\d{4,6}" autoComplete="new-password" value={reg.pin} onChange={(e) => setReg({ ...reg, pin: e.target.value })} className="h-12 text-base tracking-widest" />
                  </div>
                  <LocationPicker state={reg.state} district={reg.district} onChange={(v) => setReg({ ...reg, ...v })} />
                  <Button type="submit" size="lg" className="h-12 text-base" disabled={busy || !online}>
                    {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
                    {t("register")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {google && (
              <>
                <Separator className="my-4" />
                <Button variant="outline" size="lg" className="h-12 w-full text-base" asChild>
                  <a href="/api/auth/oauth/google/login">{t("orGoogle")}</a>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card size="sm" className="bg-transparent shadow-none ring-0">
          <CardHeader className="text-center">
            <CardTitle className="text-sm font-normal text-muted-foreground">{t("help")}</CardTitle>
            <CardDescription className="sr-only">Voice help</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
