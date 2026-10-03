"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useApp } from "@/components/app-provider";
import { api, tokens } from "@/lib/api";
import type { User } from "@/lib/types";

export default function OAuthCallback() {
  const router = useRouter();
  const { signIn } = useApp();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!access || !refresh) {
      router.replace("/login");
      return;
    }
    tokens.set(access, refresh);
    api<User>("/api/auth/me")
      .then((user) => {
        signIn({ access_token: access, refresh_token: refresh, user });
        router.replace("/dashboard");
      })
      .catch(() => router.replace("/login"));
  }, [router, signIn]);

  return <p className="p-6 text-center text-muted-foreground">Signing you in…</p>;
}
