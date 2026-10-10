"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OperatorShell } from "@/components/dashboard/shell";
import { SeverityBadge, StatusBadge } from "@/components/dashboard/badges";
import { RiskFactors, RiskScore } from "@/components/dashboard/risk";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { label, riskPercent, SEVERITIES, STATUSES, timeAgo } from "@/lib/format";

const SituationMap = dynamic(() => import("@/components/situation-map"), { ssr: false });

export default function MapPage() {
  const { incidents, venues, loading, error, refresh } = useShaktiData();
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      incidents.filter((i) => {
        if (severity !== "all" && i.severity !== severity) return false;
        if (status !== "all" && i.status !== status) return false;
        return true;
      }),
    [incidents, severity, status],
  );

  const selected = useMemo(
    () => filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  return (
    <OperatorShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Live Incident Map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranchi college-circuit view of incidents and signal locations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={severity} onValueChange={(v) => v && setSeverity(v)}>
            <SelectTrigger className="h-10 w-36 rounded-lg bg-card" aria-label="Filter by severity">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className="h-10 w-36 rounded-lg bg-card" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <CardSkeleton />}
      {!loading && error && (
        <Card className="rounded-xl bg-card py-0 ring-0">
          <ErrorState onRetry={refresh} />
        </Card>
      )}
      {!loading && !error && (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden rounded-xl bg-card py-0 ring-0">
            <CardContent className="p-0">
              <SituationMap incidents={filtered} venues={venues} />
            </CardContent>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-6 py-3.5 text-xs text-muted-foreground">
              <span className="font-medium">Legend:</span>
              {SEVERITIES.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: `var(--severity-${s.toLowerCase()})` }}
                    aria-hidden
                  />
                  {s}
                </span>
              ))}
              <span className="ml-auto hidden sm:inline">
                Only records with API or registered zone coordinates are plotted.
              </span>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-xl bg-card py-0 ring-0">
              <CardHeader className="px-5 pt-5 pb-0">
                <CardTitle className="text-base font-medium">Selected incident</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                {selected ? (
                  <>
                    <div>
                      <p className="text-lg font-medium capitalize">{label(selected.type)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPinned className="size-3.5" aria-hidden />
                        {label(selected.location)} · updated {timeAgo(selected.updated_at)}
                      </p>
                    </div>
                    <RiskScore
                      risk={selected.risk}
                      severity={selected.severity}
                      confidence={selected.confidence}
                      compact
                    />
                    <div className="flex items-center gap-2">
                      <StatusBadge value={selected.status} />
                      <span className="text-xs text-muted-foreground">
                        {riskPercent(selected.risk)}% risk
                      </span>
                    </div>
                    <Button render={<Link href={`/incidents/${selected.id}`} />} nativeButton={false} className="w-full rounded-lg font-medium">Open incident</Button>
                  </>
                ) : (
                  <EmptyState title="Nothing selected" hint="Incidents matching the filters will appear here." />
                )}
              </CardContent>
            </Card>

            {selected && <RiskFactors factors={selected.factors} />}

            <Card className="rounded-xl bg-card py-0 ring-0">
              <CardHeader className="px-5 pt-5 pb-0">
                <CardTitle className="text-base font-medium">
                  Matching incidents ({filtered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3">
                {filtered.slice(0, 10).map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setSelectedId(i.id)}
                    aria-pressed={selected?.id === i.id}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted ${selected?.id === i.id ? "bg-muted" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium capitalize">
                        {label(i.type)} · {label(i.location)}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(i.updated_at)}</span>
                    </span>
                    <SeverityBadge value={i.severity} />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <EmptyState title="No incidents match" hint="Adjust severity or status filters." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </OperatorShell>
  );
}
