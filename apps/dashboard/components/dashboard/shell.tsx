"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  FileText,
  History,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Radio,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ShaktiLogo } from "@/components/shakti-logo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RealtimeStatus } from "@/components/dashboard/realtime-status";
import { getEvents, getIncidents, websocketUrl, type Me } from "@/lib/api";
import { useOperatorIdentity } from "@/components/dashboard/operator-session";
import { accessToken } from "@/lib/supabase";
import { label, timeAgo } from "@/lib/format";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Command Center", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: TriangleAlert },
  { href: "/map", label: "Live Map", icon: MapIcon },
  { href: "/signals", label: "Signals / Events", icon: Radio },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/timeline", label: "Timeline", icon: History },
  { href: "/actions", label: "Actions / Approvals", icon: ShieldCheck },
  { href: "/sources", label: "Sources", icon: Activity },
  { href: "/reports", label: "Reports / Evidence", icon: FileText },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarBody({
  collapsed,
  onNavigate,
  me,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  me?: Me | null;
}) {
  const pathname = usePathname();
  const initials = (me?.email ?? "OP").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-4 pt-5 pb-4",
          collapsed && "justify-center px-2",
        )}
        aria-label="ShaktiOS command center"
      >
        <ShaktiLogo size={36} />
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-[15px] leading-tight font-medium tracking-tight">
              ShaktiOS
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Operator command
            </span>
          </span>
        )}
      </Link>
      <nav aria-label="Operator sections" className="flex-1 overflow-y-auto px-2.5 pb-2">
        <ul className="space-y-1">
          {NAV.map(({ href, label: itemLabel, icon: Icon }) => {
            const active = isActive(pathname, href);
            const link = (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? itemLabel : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{itemLabel}</span>}
              </Link>
            );
            if (!collapsed) return <li key={href}>{link}</li>;
            return (
              <li key={href}>
                <Tooltip>
                  <TooltipTrigger render={<span className="block" />}>
                    {link}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="rounded-xl">
                    {itemLabel}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={cn("border-t border-border p-3", collapsed && "px-2")}>
        <Link
          href="/settings"
          aria-label="Open operator settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted",
            collapsed && "justify-center px-0",
          )}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
            aria-hidden
          >
            {initials}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{me?.email ?? "Operator"}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" />
                {me?.role ?? "Operator"}
              </span>
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

type SearchResult = {
  key: string;
  kind: string;
  title: string;
  subtitle: string;
  href: string;
};

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([getIncidents(), getEvents()])
      .then(([incidents, events]) => {
        if (cancelled) return;
        const mapped: SearchResult[] = [
          ...(Array.isArray(incidents) ? incidents : []).map((i) => ({
            key: `incident-${i.id}`,
            kind: "Incident",
            title: `${label(String(i.type ?? ""))} · ${label(String(i.location ?? ""))}`,
            subtitle: `${String(i.severity ?? "")} · ${String(i.status ?? "")}`,
            href: `/incidents/${i.id}`,
          })),
          ...(Array.isArray(events) ? events : []).map((e) => ({
            key: `event-${e.id}`,
            kind: "Signal",
            title: `${label(String(e.type ?? ""))} · ${label(String(e.location ?? ""))}`,
            subtitle: `${String(e.source ?? "")} · ${timeAgo(String(e.timestamp ?? ""))}`,
            href: "/signals",
          })),
        ];
        setResults(mapped);
      })
      .catch(() => { if (!cancelled) { setResults([]); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results.slice(0, 8);
    return results.filter((r) => `${r.title} ${r.subtitle}`.toLowerCase().includes(q)).slice(0, 12);
  }, [results, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] translate-y-0 rounded-xl p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Search incidents and signals</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search incidents, signals, locations…"
            className="h-12 border-0 bg-transparent shadow-none focus-visible:ring-0"
            aria-label="Search incidents and signals"
          />
          {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
        </div>
        <ScrollArea className="max-h-80">
          <div className="p-2">
            {!loading && error && <p role="alert" className="px-3 py-8 text-center text-sm text-destructive">Search data unavailable. Close and reopen to retry.</p>}
            {!loading && !error && filtered.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No matching incidents or signals in recent data.
              </p>
            )}
            {filtered.map((r) => (
              <button
                key={r.key}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted"
                onClick={() => {
                  onOpenChange(false);
                  router.push(r.href);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                </span>
                <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {r.kind}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
        <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          Searches recently loaded backend data only — no separate search index.
        </p>
      </DialogContent>
    </Dialog>
  );
}

const TITLES: Record<string, string> = {
  "/dashboard": "Command Center",
  "/incidents": "Incidents",
  "/map": "Live Incident Map",
  "/signals": "Signal / Event Explorer",
  "/analytics": "Analytics & Insights",
  "/timeline": "Incident Timeline",
  "/actions": "Actions / Approvals",
  "/sources": "Source Intelligence",
  "/reports": "Reports / Evidence",
  "/settings": "Settings",
};

function titleFor(pathname: string) {
  if (pathname.startsWith("/incidents/")) return "Incident Detail";
  for (const [prefix, title] of Object.entries(TITLES)) {
    if (pathname === prefix) return title;
  }
  return "ShaktiOS";
}

export function OperatorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = useOperatorIdentity();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [incidentState, setIncidentState] = useState<ConnectionState>("CONNECTING");
  const [eventState, setEventState] = useState<ConnectionState>("CONNECTING");

  useEffect(() => {
    try {
      if (localStorage.getItem("shaktios-sidebar-collapsed") === "1") setCollapsed(true);
    } catch { /* Storage may be blocked by browser policy. */ }
  }, []);

  useEffect(() => {
    if (!me?.is_operator) return;
    const stopIncidents = subscribeWithReconnect(websocketUrl("/ws/incidents"), accessToken, () => {}, setIncidentState);
    const stopEvents = subscribeWithReconnect(websocketUrl("/ws/events"), accessToken, () => {}, setEventState);
    return () => {
      stopIncidents();
      stopEvents();
    };
  }, [me]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try { localStorage.setItem("shaktios-sidebar-collapsed", v ? "0" : "1"); }
      catch { /* Navigation still works without preference persistence. */ }
      return !v;
    });
  };

  const initials = (me?.email ?? "OP").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-card/60 backdrop-blur transition-[width] lg:block",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
        aria-label="Operator navigation"
      >
        <SidebarBody collapsed={collapsed} me={me} />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-16 flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} aria-hidden />
        </button>
      </aside>

      {/* Mobile drawer */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="top-0 left-0 h-full w-[300px] translate-x-0 translate-y-0 rounded-none p-0 sm:max-w-[300px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Operator navigation</DialogTitle>
          </DialogHeader>
          <SidebarBody collapsed={false} me={me} onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <div className={cn("transition-[padding] lg:pl-[264px]", collapsed && "lg:pl-[76px]")}>
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-lg lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-4" aria-hidden />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium tracking-tight">
                {titleFor(pathname)}
              </p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                A common operating picture for evolving safety incidents.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden items-center gap-2 rounded-lg bg-card px-4 py-2 text-xs text-muted-foreground shadow-sm transition-colors hover:text-foreground md:flex"
              aria-label="Search (Ctrl+K)"
            >
              <Search className="size-3.5" aria-hidden />
              Search incidents, signals…
              <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                ⌘K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-lg md:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="size-4" aria-hidden />
            </Button>
            <RealtimeStatus incidentState={incidentState} eventState={eventState} compact />
            <ModeToggle />
            <Link href="/timeline" className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted sm:inline-flex" aria-label="Open activity timeline">
              <Bell className="size-4" aria-hidden />
            </Link>
            <Link
              href="/settings"
              className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
              aria-label="Operator profile and settings"
              title={`${me?.email ?? "Operator"} · ${me?.role ?? "operator"}`}
            >
              {initials}
            </Link>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="flex items-center justify-between px-4 pb-6 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
          <span>Operators retain control — detection never acts autonomously.</span>
          <span className="hidden sm:inline">Recent snapshot · Up to 200 incidents / events · Seed sources are labelled</span>
        </footer>
      </div>
    </div>
  );
}
