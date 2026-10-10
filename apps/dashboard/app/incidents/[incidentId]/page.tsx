"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { OperatorShell } from "@/components/dashboard/shell";
import {
    EventTypeBadge,
    SeverityBadge,
    SourceBadge,
    StatusBadge,
} from "@/components/dashboard/badges";
import {
    EvidencePhotos,
    PhotoBadge,
    photoUrlsFromPayload,
} from "@/components/dashboard/evidence-photos";
import { RiskFactors, RiskScore } from "@/components/dashboard/risk";
import { TimelineView } from "@/components/dashboard/timeline-view";
import { EmptyState } from "@/components/dashboard/states";
import {
    getIncident,
    getAssistConfig,
    getIntegrations,
    getTimeline,
    requestIncidentAction,
    requestIncidentBrief,
    updateIncidentStatus,
    websocketUrl,
    type Event,
    type Incident,
    type IncidentBrief,
    type Integrations,
    type TimelineEntry,
} from "@/lib/api";
import { useIncidentEvents } from "@/hooks/use-shakti";
import { accessToken } from "@/lib/supabase";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";
import {
    ALLOWED_TRANSITIONS,
    formatDateTime,
    formatFullDateTime,
    label,
    riskPercent,
} from "@/lib/format";

/** Operator WebSocket frame for incident updates. Hoisted to module scope so the
 * exhaustive-deps rule does not mistake the payload's `incident` key for the
 * component's `incident` state inside the subscription effect. */
type IncidentUpdateFrame = {
    type: string;
    incident: Incident;
};

/** Backend-provided evidence text. Never invents content: only payload fields. */
function evidenceDetail(event: Event): { text: string; meta: string } {
    const payload = event.payload as Record<string, unknown>;
    const text = ["description", "text", "summary"]
        .map((key) => payload[key])
        .find(
            (value): value is string =>
                typeof value === "string" && value.trim().length > 0,
        );
    const meta = ["urgency", "category", "venue_event_id"]
        .map((key) => payload[key])
        .filter(
            (value): value is string =>
                typeof value === "string" && value.trim().length > 0,
        );
    return { text: text ?? "—", meta: meta.join(" · ") };
}

export default function IncidentDetail({
    params,
}: {
    params: Promise<{ incidentId: string }>;
}) {
    const { incidentId } = use(params);
    return <IncidentDetailView key={incidentId} incidentId={incidentId} />;
}

function IncidentDetailView({ incidentId }: { incidentId: string }) {
    const [incident, setIncident] = useState<Incident | null>(null);
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
    const mutationPending = useRef(false);
    const readRevision = useRef(0);
    const [statusSending, setStatusSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [timelineError, setTimelineError] = useState(false);
    const [statusError, setStatusError] = useState(false);
    const [actionState, setActionState] = useState("idle");
    const [actionError, setActionError] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [actionType, setActionType] = useState("notify_operator");
    const [reviewOpen, setReviewOpen] = useState(false);
    const [connection, setConnection] = useState<ConnectionState>("CONNECTING");
    const [integrations, setIntegrations] = useState<Integrations | null>(null);
    const [integrationError, setIntegrationError] = useState(false);
    const [brief, setBrief] = useState<IncidentBrief | null>(null);
    const [briefLoading, setBriefLoading] = useState(false);
    const [briefError, setBriefError] = useState<string | null>(null);
    const [assistReady, setAssistReady] = useState<boolean | null>(null);

    const {
        events,
        loading: eventsLoading,
        error: eventsError,
        reload: reloadEvents,
    } = useIncidentEvents(incidentId);

    useEffect(() => {
        let cancelled = false;
        getAssistConfig()
            .then((value) => {
                if (!cancelled) setAssistReady(value.configured);
            })
            .catch(() => {
                if (!cancelled) setAssistReady(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!incidentId) return;
        let cancelled = false;
        const load = () => {
            if (mutationPending.current) return;
            const request = ++readRevision.current;
            const current = () =>
                !cancelled && request === readRevision.current;
            getIncident(incidentId)
                .then((value) => {
                    if (current()) {
                        setIncident(value);
                        setError(false);
                    }
                })
                .catch(() => {
                    if (current()) setError(true);
                })
                .finally(() => {
                    if (current()) setLoading(false);
                });
            getTimeline(incidentId)
                .then((value) => {
                    if (current()) {
                        setTimeline(value);
                        setTimelineError(false);
                    }
                })
                .catch(() => {
                    if (current()) setTimelineError(true);
                });
            void reloadEvents();
        };
        setLoading(true);
        load();
        getIntegrations()
            .then((value) => {
                if (!cancelled) setIntegrations(value);
            })
            .catch(() => {
                if (!cancelled) setIntegrationError(true);
            });
        const stop = subscribeWithReconnect(
            websocketUrl("/ws/incidents"),
            accessToken,
            (data) => {
                try {
                    const update = JSON.parse(data) as IncidentUpdateFrame;
                    if (
                        update.type === "incident.updated" &&
                        update.incident?.id === incidentId
                    )
                        load();
                } catch {
                    /* Ignore invalid frames; polling reloads the authoritative snapshot. */
                }
            },
            (state) => {
                setConnection(state);
                if (state === "LIVE") load();
            },
        );
        const interval = setInterval(load, 15_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
            stop();
        };
    }, [incidentId, reloadEvents]);

    const changeStatus = async (status: string) => {
        if (mutationPending.current) return;
        mutationPending.current = true;
        readRevision.current += 1;
        setStatusSending(true);
        setStatusError(false);
        try {
            setIncident(
                await updateIncidentStatus(
                    incidentId,
                    status,
                    note || undefined,
                ),
            );
            setNote("");
            try {
                setTimeline(await getTimeline(incidentId));
                setTimelineError(false);
            } catch {
                setTimelineError(true);
            }
            await reloadEvents();
        } catch {
            setStatusError(true);
        } finally {
            mutationPending.current = false;
            setStatusSending(false);
        }
    };

    const requestAction = async () => {
        if (
            mutationPending.current ||
            incident?.status !== "RESPONDING" ||
            !actionType.trim()
        )
            return;
        mutationPending.current = true;
        readRevision.current += 1;
        setActionState("sending");
        setActionError(null);
        try {
            await requestIncidentAction(
                incidentId,
                actionType.trim(),
                note || undefined,
            );
            setActionState("accepted");
            setReviewOpen(false);
            // The handoff has succeeded. A later timeline read failure must not
            // tell the operator to resend an already accepted action.
            try {
                setTimeline(await getTimeline(incidentId));
                setTimelineError(false);
            } catch {
                setTimelineError(true);
            }
            await reloadEvents();
        } catch (err) {
            setActionState("error");
            setActionError(
                `${err instanceof Error ? err.message : "Workflow request failed."} Delivery may be unconfirmed; inspect the timeline and n8n execution history before retrying.`,
            );
        } finally {
            mutationPending.current = false;
        }
    };

    const summarizeWithGemma = async () => {
        if (!incident || briefLoading) return;
        setBriefLoading(true);
        setBriefError(null);
        try {
            const evidence = events.slice(0, 10).map((item) => {
                const detail = evidenceDetail(item);
                return `${item.type} via ${item.source}: ${detail.text}${detail.meta ? ` (${detail.meta})` : ""}`;
            });
            setBrief(
                await requestIncidentBrief({
                    location: incident.location,
                    status: incident.status,
                    severity: incident.severity,
                    risk: incident.risk,
                    evidence,
                }),
            );
        } catch (err) {
            setBriefError(
                err instanceof Error ? err.message : "Gemma brief request failed.",
            );
        } finally {
            setBriefLoading(false);
        }
    };

    const correlatedEvents = useMemo(
        () => timeline.filter((e) => e.type === "event.correlated"),
        [timeline],
    );

    const sameLocationEvents = useMemo(() => events.slice(0, 8), [events]);

    const allowed = incident
        ? (ALLOWED_TRANSITIONS[
              incident.status as keyof typeof ALLOWED_TRANSITIONS
          ] ?? [])
        : [];

    return (
        <OperatorShell>
            <nav
                aria-label="Breadcrumb"
                className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground"
            >
                <Link
                    href="/incidents"
                    className="inline-flex items-center gap-1 font-medium text-info hover:underline"
                >
                    <ArrowLeft className="size-3.5" aria-hidden />
                    Incidents
                </Link>
                <ChevronRight className="size-3.5" aria-hidden />
                <span className="truncate font-medium text-foreground">
                    {incident
                        ? `${label(incident.type)} · ${label(incident.location)}`
                        : "Detail"}
                </span>
            </nav>

            {loading && (
                <p className="mt-16 text-muted-foreground" role="status">
                    Loading incident…
                </p>
            )}
            {error && (
                <p className="mt-16 text-destructive" role="alert">
                    Incident not found or API unavailable.
                </p>
            )}
            {incident && (
                <>
                    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                                Incident assessment
                            </p>
                            <h1 className="mt-2 text-4xl font-medium capitalize tracking-[-0.05em] sm:text-5xl">
                                {label(incident.type)}
                            </h1>
                            <p className="mt-2 text-sm font-medium text-muted-foreground">
                                {label(incident.location)} · detected{" "}
                                {formatDateTime(incident.created_at)} · updated{" "}
                                {formatDateTime(incident.updated_at)}
                            </p>
                            <p
                                className="mt-1.5 font-mono text-[11px] text-muted-foreground"
                                title="Incident ID"
                            >
                                ID {incident.id}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <SeverityBadge value={incident.severity} />
                            <StatusBadge value={incident.status} />
                            <Badge variant="outline" className="tabular-nums">
                                {riskPercent(incident.risk)}% risk
                            </Badge>
                            <span
                                className="text-xs text-muted-foreground"
                                title={`WebSocket status: ${connection}`}
                            >
                                <span
                                    className={`mr-1.5 inline-block size-2 rounded-full ${
                                        connection === "LIVE"
                                            ? "bg-success"
                                            : connection === "DISCONNECTED"
                                              ? "bg-destructive"
                                              : "bg-warning"
                                    }`}
                                    aria-hidden
                                />
                                {connection.toLowerCase()}
                            </span>
                        </div>
                    </header>

                    <ol
                        aria-label="Operator workflow: observe, understand, decide"
                        className="mb-5 flex flex-wrap items-center gap-2 text-xs font-medium"
                    >
                        {[
                            "Observe signals",
                            "Understand risk",
                            "Decide & approve",
                        ].map((phase, index) => (
                            <li key={phase} className="flex items-center gap-2">
                                {index > 0 && (
                                    <ChevronRight
                                        className="size-3.5 text-muted-foreground"
                                        aria-hidden
                                    />
                                )}
                                <span
                                    aria-current={
                                        index === 1 ? "step" : undefined
                                    }
                                    className={`rounded-md px-3 py-1.5 ${
                                        index === 1
                                            ? "bg-foreground text-background"
                                            : "bg-card text-muted-foreground shadow-sm"
                                    }`}
                                >
                                    {index + 1}. {phase}
                                </span>
                            </li>
                        ))}
                    </ol>

                    <section
                        className="grid gap-4 lg:grid-cols-[1fr_1.2fr]"
                        aria-label="Risk summary"
                    >
                        <Card className="rounded-xl bg-card py-0 ring-0">
                            <CardHeader className="px-6 pt-6 pb-0">
                                <CardTitle className="text-lg font-medium">
                                    Risk summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 p-6">
                                <RiskScore
                                    risk={incident.risk}
                                    severity={incident.severity}
                                    confidence={incident.confidence}
                                />
                                <Separator />
                                <div>
                                    <p className="text-sm font-medium">
                                        Why this incident exists
                                    </p>
                                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                                        <li>
                                            · {correlatedEvents.length}{" "}
                                            correlated{" "}
                                            {correlatedEvents.length === 1
                                                ? "signal"
                                                : "signals"}{" "}
                                            in the returned timeline window at{" "}
                                            {label(incident.location)}
                                        </li>
                                        <li>
                                            ·{" "}
                                            {
                                                Object.keys(
                                                    incident.factors,
                                                ).filter(
                                                    (k) =>
                                                        k !==
                                                        "citizen_report_count",
                                                ).length
                                            }{" "}
                                            explainable risk factors tracked
                                        </li>
                                        <li>
                                            · Confidence{" "}
                                            {Math.round(
                                                incident.confidence * 100,
                                            )}
                                            % (strongest contributing signal)
                                        </li>
                                        <li>
                                            · Status {incident.status} —
                                            operator-controlled lifecycle
                                        </li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                        <RiskFactors factors={incident.factors} />
                    </section>

                    <Card className="mt-4 rounded-xl bg-card py-0 ring-0">
                        <CardHeader className="px-6 pt-6 pb-0">
                            <CardTitle className="text-lg font-medium">
                                Gemma brief
                            </CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Open-weights summary of the evidence above. Read-only: it never
                                edits the incident or requests action.
                            </p>
                        </CardHeader>
                        <CardContent className="p-6">
                            {assistReady === false && (
                                <p className="text-sm text-muted-foreground" role="status">
                                    Gemma assist is not configured for this API.
                                </p>
                            )}
                            {assistReady !== false && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        className="rounded-lg font-medium"
                                        disabled={briefLoading}
                                        onClick={summarizeWithGemma}
                                    >
                                        {briefLoading
                                            ? "Summarizing…"
                                            : brief
                                              ? "Regenerate brief"
                                              : "Summarize with Gemma"}
                                    </Button>
                                </div>
                            )}
                            {briefError && (
                                <p className="mt-3 text-sm text-destructive" role="alert">
                                    {briefError}
                                </p>
                            )}
                            {brief && (
                                <div className="mt-4 space-y-3">
                                    <p className="text-sm leading-7">{brief.brief}</p>
                                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                                        {brief.bullets.map((bullet) => (
                                            <li key={bullet}>· {bullet}</li>
                                        ))}
                                    </ul>
                                    {brief.suggested_actions.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium">
                                                Suggested next reviews
                                            </p>
                                            <ul className="mt-1.5 space-y-1.5 text-sm text-muted-foreground">
                                                {brief.suggested_actions.map((action) => (
                                                    <li key={action}>· {action}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <p className="font-mono text-[11px] text-muted-foreground">
                                        Model {brief.model}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <section className="mt-4 grid gap-4 lg:grid-cols-2">
                        <Card className="rounded-xl bg-card py-0 ring-0">
                            <CardHeader className="px-6 pt-6 pb-0">
                                <CardTitle className="text-lg font-medium">
                                    Signals / evidence
                                </CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Latest 8 of the returned evidence window (up
                                    to 100 records), newest first.
                                </p>
                            </CardHeader>
                            <CardContent className="p-0 pt-2 pb-2">
                                {eventsLoading ? (
                                    <p className="px-6 py-8 text-sm text-muted-foreground">
                                        Loading related events…
                                    </p>
                                ) : eventsError ? (
                                    <p
                                        className="px-6 py-8 text-sm text-destructive"
                                        role="alert"
                                    >
                                        Related events unavailable.
                                    </p>
                                ) : sameLocationEvents.length === 0 ? (
                                    <EmptyState
                                        title="No related events"
                                        hint="The backend has not linked any evidence to this incident."
                                    />
                                ) : (
                                    <ScrollArea className="max-h-72">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead scope="col">
                                                        Type
                                                    </TableHead>
                                                    <TableHead scope="col">
                                                        Source
                                                    </TableHead>
                                                    <TableHead scope="col">
                                                        Detail
                                                    </TableHead>
                                                    <TableHead
                                                        scope="col"
                                                        className="text-right"
                                                    >
                                                        Time
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sameLocationEvents.map((e) => {
                                                    const detail =
                                                        evidenceDetail(e);
                                                    const photos =
                                                        photoUrlsFromPayload(
                                                            e.payload as Record<
                                                                string,
                                                                unknown
                                                            >,
                                                        );
                                                    return (
                                                        <TableRow key={e.id}>
                                                            <TableCell>
                                                                <EventTypeBadge
                                                                    type={
                                                                        e.type
                                                                    }
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <SourceBadge
                                                                    source={
                                                                        e.source
                                                                    }
                                                                />
                                                            </TableCell>
                                                            <TableCell className="max-w-72">
                                                                <p
                                                                    className="truncate text-xs text-muted-foreground"
                                                                    title={
                                                                        detail.text
                                                                    }
                                                                >
                                                                    {
                                                                        detail.text
                                                                    }{" "}
                                                                    <PhotoBadge
                                                                        count={
                                                                            photos.length
                                                                        }
                                                                    />
                                                                </p>
                                                                {detail.meta && (
                                                                    <p
                                                                        className="mt-0.5 truncate text-[11px] text-muted-foreground"
                                                                        title={
                                                                            detail.meta
                                                                        }
                                                                    >
                                                                        {
                                                                            detail.meta
                                                                        }
                                                                    </p>
                                                                )}
                                                                <EvidencePhotos
                                                                    urls={
                                                                        photos
                                                                    }
                                                                    size="sm"
                                                                    className="mt-1.5"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                                {formatFullDateTime(
                                                                    e.timestamp,
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl bg-card py-0 ring-0">
                            <CardHeader className="px-6 pt-6 pb-0">
                                <CardTitle className="text-lg font-medium">
                                    Timeline
                                </CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Chronological audit record
                                </p>
                            </CardHeader>
                            <CardContent className="p-6">
                                {timelineError && (
                                    <p
                                        className="text-sm text-destructive"
                                        role="alert"
                                    >
                                        Timeline unavailable.
                                    </p>
                                )}
                                {!timelineError && (
                                    <ScrollArea className="h-72">
                                        <div className="pr-4">
                                            <TimelineView entries={timeline} />
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    {incident.status !== "RESOLVED" && (
                        <Card className="mt-4 rounded-xl bg-card py-0 ring-0">
                            <CardHeader className="px-6 pt-6 pb-0">
                                <CardTitle className="text-lg font-medium">
                                    Operator decision
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <p className="text-sm text-muted-foreground">
                                    Review evidence, then approve the next
                                    incident state. Only allowed transitions are
                                    shown; the backend rejects anything else.
                                </p>
                                <Textarea
                                    className="mt-4 min-h-24 rounded-lg bg-muted"
                                    placeholder="Optional operator note — stored with the next status change"
                                    value={note}
                                    onChange={(event) =>
                                        setNote(event.target.value)
                                    }
                                    maxLength={500}
                                    aria-label="Operator note"
                                />
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {allowed.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            No further transitions available.
                                        </p>
                                    )}
                                    {allowed.map((status) => (
                                        <Button
                                            key={status}
                                            className="rounded-lg font-medium"
                                            variant={
                                                status === "RESOLVED"
                                                    ? "outline"
                                                    : "default"
                                            }
                                            disabled={
                                                statusSending ||
                                                actionState === "sending"
                                            }
                                            onClick={() => changeStatus(status)}
                                        >
                                            {status === "ASSESSING" &&
                                                "Begin assessment"}
                                            {status === "RESPONDING" &&
                                                "Approve response"}
                                            {status === "RESOLVED" &&
                                                "Resolve incident"}
                                        </Button>
                                    ))}
                                </div>
                                {statusError && (
                                    <p
                                        className="mt-3 text-sm text-destructive"
                                        role="alert"
                                    >
                                        Status update failed. The transition may
                                        be invalid or the API unreachable.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {incident.status === "RESPONDING" && (
                        <Card className="mt-4 rounded-xl border-warning/30 bg-warning/5 py-0">
                            <CardHeader className="px-6 pt-6 pb-0">
                                <CardTitle className="flex items-center gap-2 text-lg font-medium">
                                    <ShieldAlert
                                        className="size-5 text-warning-foreground"
                                        aria-hidden
                                    />
                                    Proposed action — human approval required
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <p className="text-sm leading-7 text-muted-foreground">
                                    Analysis and action are separate. Approving
                                    below forwards one request to the configured
                                    n8n workflow — it does not execute
                                    autonomous emergency action.
                                </p>
                                <div className="mt-4 flex max-w-md flex-col gap-3">
                                    <label
                                        className="space-y-1.5 text-xs font-medium text-muted-foreground"
                                        htmlFor="action-type"
                                    >
                                        Requested action
                                        <Input
                                            id="action-type"
                                            className="h-11 rounded-lg bg-card"
                                            value={actionType}
                                            maxLength={100}
                                            disabled={actionState === "sending"}
                                            onChange={(event) =>
                                                setActionType(
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <div className="flex gap-2">
                                        <Button
                                            className="rounded-lg font-medium"
                                            disabled={
                                                statusSending ||
                                                actionState === "sending" ||
                                                !actionType.trim() ||
                                                !integrations?.n8n.configured ||
                                                !integrations.n8n.authenticated
                                            }
                                            onClick={() => setReviewOpen(true)}
                                        >
                                            Review & approve
                                        </Button>
                                    </div>
                                    {integrationError && (
                                        <p
                                            className="text-sm text-destructive"
                                            role="alert"
                                        >
                                            Action readiness could not be
                                            checked.
                                        </p>
                                    )}
                                    {!integrationError &&
                                        integrations &&
                                        (!integrations.n8n.configured ||
                                            !integrations.n8n
                                                .authenticated) && (
                                            <p
                                                className="text-sm text-warning-foreground"
                                                role="status"
                                            >
                                                n8n action is not ready; no
                                                request can be sent.
                                            </p>
                                        )}
                                    {actionState === "accepted" && (
                                        <p
                                            className="text-sm font-medium text-success"
                                            role="status"
                                        >
                                            Workflow request accepted and
                                            recorded in the timeline.
                                        </p>
                                    )}
                                    {actionState === "error" && (
                                        <p
                                            className="text-sm font-medium text-destructive"
                                            role="alert"
                                        >
                                            {actionError}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                        <DialogContent className="rounded-xl sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-medium">
                                    Approve action?
                                </DialogTitle>
                            </DialogHeader>
                            <dl className="space-y-2.5 text-sm">
                                {[
                                    [
                                        "Incident",
                                        `${label(incident.type)} · ${label(incident.location)}`,
                                    ],
                                    [
                                        "Current risk",
                                        `${riskPercent(incident.risk)}% · ${incident.severity}`,
                                    ],
                                    ["Requested action", actionType],
                                    [
                                        "Evidence",
                                        `${correlatedEvents.length} correlated signals at ${label(incident.location)}`,
                                    ],
                                    ["Operator note", note || "—"],
                                ].map(([k, v]) => (
                                    <div
                                        key={k}
                                        className="flex justify-between gap-4"
                                    >
                                        <dt className="shrink-0 text-muted-foreground">
                                            {k}
                                        </dt>
                                        <dd className="text-right font-medium break-words">
                                            {v}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            <p className="rounded-lg bg-muted p-3.5 text-xs leading-6 text-muted-foreground">
                                This forwards a human-approved request to the
                                n8n workflow. ShaktiOS never acts autonomously —
                                the timeline records this approval for audit.
                            </p>
                            {actionState === "error" && actionError && (
                                <p
                                    className="text-sm font-medium text-destructive"
                                    role="alert"
                                >
                                    {actionError}
                                </p>
                            )}
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-lg"
                                    onClick={() => setReviewOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="rounded-lg"
                                    disabled={
                                        statusSending ||
                                        incident.status !== "RESPONDING" ||
                                        !actionType.trim() ||
                                        actionState === "sending" ||
                                        !integrations?.n8n.configured ||
                                        !integrations.n8n.authenticated
                                    }
                                    onClick={requestAction}
                                >
                                    {actionState === "sending"
                                        ? "Submitting…"
                                        : "Approve action"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Separator className="my-8" />
                    <footer className="pb-8 text-center text-xs text-muted-foreground">
                        ShaktiOS · Every signal becomes traceable evidence.
                    </footer>
                </>
            )}
        </OperatorShell>
    );
}
