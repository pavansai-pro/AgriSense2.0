"use client";

import {
  ClipboardList,
  CloudSun,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  Settings,
  ShieldAlert,
  Sprout,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useApp } from "@/components/app-provider";
import { LanguageSelect } from "@/components/language-select";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceButton } from "@/components/voice-button";
import { tokens } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAV: { href: string; key: MessageKey; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/crop", key: "crop", icon: Sprout },
  { href: "/risk", key: "risk", icon: ShieldAlert },
  { href: "/weather", key: "weather", icon: CloudSun },
  { href: "/records", key: "records", icon: ClipboardList },
  { href: "/assistant", key: "assistant", icon: MessageCircle },
  { href: "/profile", key: "profile", icon: UserRound },
  { href: "/settings", key: "settings", icon: Settings },
];

function NavList({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, signOut } = useApp();
  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {NAV.map(({ href, key, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? t(key) : undefined}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className={cn(collapsed && "sr-only")}>{t(key)}</span>
          </Link>
        );
      })}
      <Separator className="my-2" />
      <button
        type="button"
        onClick={() => {
          signOut();
          onNavigate?.();
          router.push("/login");
        }}
        title={collapsed ? t("logout") : undefined}
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          collapsed && "justify-center px-0",
        )}
      >
        <LogOut className="size-5 shrink-0" />
        <span className={cn(collapsed && "sr-only")}>{t("logout")}</span>
      </button>
    </nav>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useApp();
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sprout className="size-5" aria-hidden />
      </span>
      {!compact && <span className="text-lg tracking-tight">{t("appName")}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, authReady, t } = useApp();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (authReady && !user && !tokens.access) router.replace("/login");
  }, [authReady, user, router]);

  if (!authReady || !user) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 border-r bg-sidebar p-3 transition-[width] md:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className={cn("flex items-center justify-between gap-2 px-1 pt-1", collapsed && "justify-center")}>
          <Brand compact={collapsed} />
        </div>
        <NavList collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetHeader className="p-0">
            <SheetTitle>
              <Brand />
            </SheetTitle>
            <SheetDescription>{t("tagline")}</SheetDescription>
          </SheetHeader>
          <NavList onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-4">
          <Button
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            data-testid="menu-button"
          >
            <Menu className="size-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            className="hidden md:inline-flex"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <Menu className="size-5" /> : <PanelLeftClose className="size-5" />}
          </Button>
          <div className="md:hidden">
            <Brand compact />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge />
            <LanguageSelect className="w-28 sm:w-32" />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-32">
          {children}
        </main>
      </div>
      <VoiceButton />
    </div>
  );
}
