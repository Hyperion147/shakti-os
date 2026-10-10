"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Flame,
  MapPinned,
  Radio,
  Signal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperatorShell } from "@/components/dashboard/shell";
import { SeverityBadge, SourceBadge, StatusBadge } from "@/components/dashboard/badges";
import { RiskScore } from "@/components/dashboard/risk";
import { SignalDialog } from "@/components/dashboard/signal-dialog";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { formatDateTime, label, riskPercent, timeAgo } from "@/lib/format";

const SituationMap = dynamic(() => import("@/components/situation-map"), { ssr: false });

export default function DashboardPage() {
  const {
    incidents,
    events,
    venues,
    loading,
    error,
    connected,
    refresh,
    prependEvent,
  } = useShaktiData();

  const active = useMemo(() => incidents.filter((item) => item.status !== "RESOLVED"), [incidents]);
  const elevated = useMemo(
    () => active.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity)),
    [active],
  );
  const awaitingTriage = useMemo(
    () => active.filter((item) => item.status === "DETECTED").length,
    [active],
  );
  const topRisk = useMemo(
    () => [...active].sort((a, b) => b.risk - a.risk)[0] ?? null,
    [active],
  );
  const averageRisk = active.length
    ? active.reduce((sum, item) => sum + item.risk, 0) / active.length
    : 0;

  return (
    <OperatorShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-medium tracking-[-0.03em]">Command Center</h1>
            {!loading && !error && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${
                  connected ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"
                }`}
                role="status"
                title={connected ? "Incident + event streams connected" : "Streams reconnecting — data may be stale"}
              >
                <span className="relative flex size-1.5">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${connected ? "bg-success" : "bg-warning"}`} aria-hidden />
                  <span className={`relative inline-flex size-1.5 rounded-full ${connected ? "bg-success" : "bg-warning"}`} aria-hidden />
                </span>
                {connected ? "Live" : "Syncing"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent snapshot of up to 200 incidents and 200 signals; stream status is not source health.
          </p>
        </div>
        <SignalDialog onCreated={prependEvent} venues={venues} />
      </div>

      {error && (
        <Card className="mb-4 rounded-xl bg-card ring-0">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-sm font-medium text-destructive">
              Operational data unavailable or stale. Check the configured API and connection, then retry.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="text-sm font-medium text-info hover:underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      )}

      {!error && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key indicators">
        {loading
          ? [0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)
          : [
              { title: "Active incidents", value: String(active.length).padStart(2, "0"), note: `${elevated.length} elevated · ${awaitingTriage} awaiting triage`, icon: Activity },
              { title: "Elevated risk", value: String(elevated.length).padStart(2, "0"), note: `${Math.round(averageRisk * 100)}% average`, icon: MapPinned },
              { title: "Signals", value: String(events.length).padStart(2, "0"), note: "Latest retained events", icon: Radio },
              { title: "Fusion", value: connected ? "Live" : "Wait", note: "Incident + event streams", icon: Signal },
            ].map(({ title, value, note, icon: Icon }) => (
              <Card key={title} className="group rounded-xl bg-card py-0 ring-0 transition-shadow hover:shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">{title}</p>
                    <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-info" aria-hidden />
                  </div>
                  <p className="mt-6 text-4xl font-medium tracking-[-0.06em]">{value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{note}</p>
                </CardContent>
              </Card>
            ))}
      </section>}

      {!loading && !error && topRisk && (
        <section aria-label="Highest risk incident" className="mt-4">
          <Card className="rounded-xl bg-card py-0 ring-0">
            <CardContent className="flex flex-wrap items-center gap-5 p-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Flame className="size-5" aria-hidden />
              </span>
              <RiskScore risk={topRisk.risk} severity={topRisk.severity} confidence={topRisk.confidence} compact />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  Needs attention · updated {timeAgo(topRisk.updated_at)}
                </p>
                <p className="mt-1 truncate text-lg font-medium capitalize">
                  {label(topRisk.type)} · {label(topRisk.location)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Highest risk across {active.length} active incident{active.length === 1 ? "" : "s"} — open it to review evidence and approve the next state.
                </p>
              </div>
              <Link
                href={`/incidents/${topRisk.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open incident <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.9fr]">
        <Card className="rounded-xl bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium tracking-[-0.03em]">Live situation map</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Ranchi · College circuit · Coordinates from live incidents and venue zones</p>
              </div>
              <Link href="/map" className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
                Full map <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <SituationMap incidents={active} venues={venues} />
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium tracking-[-0.03em]">Incident queue</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Newest correlated situations</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{active.length}</Badge>
                <Link href="/incidents" className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
                  View all <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && <p className="px-6 py-8 text-sm text-muted-foreground">Loading operational data…</p>}
            {!loading && !error && !active.length && (
              <div className="px-6 py-10 text-center">
                <CheckCircle2 className="mx-auto size-6 text-success" aria-hidden />
                <p className="mt-3 font-medium">No active incidents</p>
              </div>
            )}
            <ScrollArea className="max-h-[380px]">
              <div className="space-y-1 px-3 pb-3">
                {active.slice(0, 8).map((item) => (
                  <Link key={item.id} href={`/incidents/${item.id}`} className="flex items-center justify-between rounded-lg px-4 py-4 transition-colors hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium capitalize">{label(item.type)}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPinned className="size-3 shrink-0" aria-hidden />{label(item.location)}</p>
                      <div
                        className="mt-2 h-1 w-full max-w-44 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={riskPercent(item.risk)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Risk ${riskPercent(item.risk)} percent`}
                      >
                        <div
                          className="h-full rounded-full bg-info transition-[width]"
                          style={{ width: `${riskPercent(item.risk)}%` }}
                        />
                      </div>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-3">
                      <SeverityBadge value={item.severity} />
                      <span className="w-10 text-right text-sm font-medium tabular-nums">{riskPercent(item.risk)}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card className="rounded-xl bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium tracking-[-0.03em]">Live activity feed</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Incidents and events in one view</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Link href="/signals" className="inline-flex items-center gap-1 font-medium text-info hover:underline">
                  Signals <ArrowUpRight className="size-3" aria-hidden />
                </Link>
                <Link href="/timeline" className="inline-flex items-center gap-1 font-medium text-info hover:underline">
                  Timeline <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="incidents" className="px-6 pt-4 pb-6">
              <TabsList className="mb-4 rounded-lg bg-muted p-1">
                <TabsTrigger className="rounded-md px-4 font-medium" value="incidents">Incidents</TabsTrigger>
                <TabsTrigger className="rounded-md px-4 font-medium" value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="incidents">
                {loading ? (
                  <p className="py-8 text-sm text-muted-foreground">Loading…</p>
                ) : error ? (
                  <ErrorState onRetry={refresh} />
                ) : incidents.length === 0 ? (
                  <EmptyState title="No incidents yet" hint="Correlated events will create crowd_risk incidents here." />
                ) : (
                  <ScrollArea className="max-h-[340px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead scope="col">Type</TableHead>
                          <TableHead scope="col">Location</TableHead>
                          <TableHead scope="col">Status</TableHead>
                          <TableHead scope="col" className="text-right">Risk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidents.slice(0, 10).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell><Link href={`/incidents/${item.id}`} className="font-medium capitalize hover:text-info">{label(item.type)}</Link></TableCell>
                            <TableCell className="capitalize text-muted-foreground">{label(item.location)}</TableCell>
                            <TableCell><StatusBadge value={item.status} /></TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{riskPercent(item.risk)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>
              <TabsContent value="events">
                {loading ? (
                  <p className="py-8 text-sm text-muted-foreground">Loading…</p>
                ) : events.length === 0 ? (
                  !error ? (
                    <EmptyState title="No events have arrived yet" hint="Authenticated observations and configured source events appear here." />
                  ) : (
                    <ErrorState onRetry={refresh} />
                  )
                ) : (
                  <ScrollArea className="max-h-[340px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead scope="col">Type</TableHead>
                          <TableHead scope="col">Location</TableHead>
                          <TableHead scope="col">Source</TableHead>
                          <TableHead scope="col" className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.slice(0, 10).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium capitalize">{label(item.type)}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{label(item.location)}</TableCell>
                            <TableCell><SourceBadge source={item.source} /></TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </OperatorShell>
  );
}
