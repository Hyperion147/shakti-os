"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
    Activity,
    ArrowRight,
    ArrowUpRight,
    Check,
    CircleAlert,
    CircleCheck,
    FileText,
    Gauge,
    GitBranch,
    MapPin,
    Radio,
    ShieldCheck,
    Users,
    Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ShaktiLogo } from "@/components/shakti-logo";

// Marketing-only fixtures. The landing page never reads operational APIs.
const previewStats = [
    {
        title: "Active incidents",
        value: "12",
        note: "Across 4 venue zones",
        icon: Activity,
        tone: "bg-success/10 text-success",
    },
    {
        title: "Elevated risk",
        value: "03",
        note: "Ready for operator review",
        icon: Gauge,
        tone: "bg-warning/10 text-warning",
    },
    {
        title: "Events today",
        value: "128",
        note: "Crowd, social & citizen",
        icon: Radio,
        tone: "bg-info/10 text-info",
    },
    {
        title: "Signal sources",
        value: "08",
        note: "One shared operating picture",
        icon: Zap,
        tone: "bg-primary/10 text-primary",
    },
];

const previewIncidents = [
    {
        id: "sreebhumi",
        title: "Crowd buildup",
        location: "Sreebhumi",
        status: "Assessing",
        risk: 87,
        tone: "bg-warning/10 text-warning",
        x: "72%",
        y: "28%",
    },
    {
        id: "college-square",
        title: "Access obstruction",
        location: "College Square",
        status: "Responding",
        risk: 76,
        tone: "bg-warning/10 text-warning",
        x: "40%",
        y: "52%",
    },
    {
        id: "bagbazar",
        title: "Movement anomaly",
        location: "Bagbazar",
        status: "Detected",
        risk: 71,
        tone: "bg-warning/10 text-warning",
        x: "33%",
        y: "24%",
    },
    {
        id: "ballygunge",
        title: "Queue forming",
        location: "Ballygunge",
        status: "Assessing",
        risk: 35,
        tone: "bg-success/10 text-success",
        x: "67%",
        y: "77%",
    },
];

const previewActivity = [
    {
        title: "Crowd signals correlated",
        detail: "Sreebhumi · 3 sources",
        time: "14:32",
    },
    {
        title: "Operator review started",
        detail: "College Square · Access",
        time: "14:30",
    },
    {
        title: "Citizen report received",
        detail: "Ballygunge · Queue",
        time: "14:28",
    },
];

const sourceCards = [
    {
        icon: Users,
        title: "Crowd Signals",
        copy: "Density and movement from camera or simulator feeds, normalized by venue zone.",
        bg: "bg-primary/10",
        iconColor: "text-primary",
    },
    {
        icon: Radio,
        title: "Social Concern",
        copy: "Civic-Shield mention velocity, sentiment, and location context before the feed becomes noise.",
        bg: "bg-info/10",
        iconColor: "text-info",
    },
    {
        icon: FileText,
        title: "Citizen Reports",
        copy: "Location-aware observations with category, urgency, description, and optional coordinates.",
        bg: "bg-warning/10",
        iconColor: "text-warning",
    },
];

function DashboardPreview() {
    const reduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                duration: 0.8,
                delay: 0.16,
                ease: [0.22, 1, 0.36, 1],
            }}
            className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-2 shadow-[0_24px_70px_rgba(100,104,240,.18)]"
        >
            <div className="flex min-h-[430px] overflow-hidden rounded-lg border border-border bg-background text-[10px]">
                <aside className="hidden w-[76px] shrink-0 border-r border-border bg-card px-2 py-3 sm:block">
                    <ShaktiLogo size={32} className="mx-auto" />
                    <div className="mt-6 space-y-1">
                        {[
                            "Command",
                            "Incidents",
                            "Map",
                            "Signals",
                            "Analytics",
                            "Timeline",
                        ].map((item, index) => (
                            <div
                                key={item}
                                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 ${index === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                            >
                                <span className="text-[7px] font-bold">
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                </aside>
                <div className="min-w-0 flex-1">
                    <div className="flex h-12 items-center justify-between border-b border-border bg-card px-3 sm:px-4">
                        <div>
                            <p className="text-[11px] font-extrabold">
                                Command center
                            </p>
                            <p className="text-[8px] text-muted-foreground">
                                Kolkata · Puja circuit
                            </p>
                        </div>
                        <span className="flex items-center gap-1 rounded-sm bg-primary/10 px-2 py-1 text-[8px] font-bold text-primary">
                            <span className="size-1.5 rounded-full bg-primary" />{" "}
                            Demo preview
                        </span>
                    </div>
                    <div className="space-y-2.5 p-2.5 sm:p-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {previewStats.map(
                                ({ title, value, note, icon: Icon }) => (
                                    <div
                                        key={title}
                                        className="rounded-xl border border-border bg-card p-2.5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="truncate text-[7px] font-bold tracking-wide text-muted-foreground uppercase">
                                                {title}
                                            </p>
                                            <Icon className="size-3 shrink-0 text-primary" />
                                        </div>
                                        <p className="mt-2 text-base font-extrabold tracking-tight">
                                            {value}
                                        </p>
                                        <p className="mt-0.5 truncate text-[7px] text-muted-foreground">
                                            {note}
                                        </p>
                                    </div>
                                ),
                            )}
                        </div>
                        <div className="grid gap-2.5 lg:grid-cols-[1.25fr_.75fr]">
                            <div className="rounded-xl border border-border bg-card p-2.5">
                                <div className="mb-2 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-extrabold">
                                            Situation map
                                        </p>
                                        <p className="text-[8px] text-muted-foreground">
                                            4 zones · Illustrative Kolkata
                                            layout
                                        </p>
                                    </div>
                                    <MapPin className="size-3 text-primary" />
                                </div>
                                <div
                                    className="relative h-[196px] overflow-hidden rounded-lg bg-muted"
                                    role="img"
                                    aria-label="Demo venue map of Kolkata with sample incidents at Sreebhumi, College Square, Bagbazar and Ballygunge"
                                >
                                    <div
                                        className="absolute inset-0 opacity-60"
                                        style={{
                                            backgroundImage:
                                                "linear-gradient(var(--card) 1px, transparent 1px), linear-gradient(90deg, var(--card) 1px, transparent 1px)",
                                            backgroundSize: "24px 24px",
                                        }}
                                    />
                                    <div className="absolute -top-6 left-[52%] h-[140%] w-9 rotate-[24deg] border-x-4 border-card/60 bg-border" />
                                    <div className="absolute top-[49%] -left-4 h-3 w-[120%] -rotate-12 bg-card/90" />
                                    <div className="absolute -top-4 left-[24%] h-[120%] w-2 rotate-12 bg-card/90" />
                                    <div className="absolute top-3 left-3 h-8 w-12 rounded-lg bg-success/15" />
                                    <div className="absolute right-4 bottom-4 h-10 w-14 rounded-lg bg-success/15" />
                                    {previewIncidents.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className="absolute -translate-x-1/2 -translate-y-1/2"
                                            style={{
                                                left: item.x,
                                                top: item.y,
                                            }}
                                        >
                                            <motion.div
                                                animate={
                                                    reduceMotion
                                                        ? undefined
                                                        : {
                                                              scale: [
                                                                  1, 1.15, 1,
                                                              ],
                                                          }
                                                }
                                                transition={{
                                                    duration: 3,
                                                    delay: index * 0.4,
                                                    repeat: Infinity,
                                                }}
                                                className={`mx-auto flex size-7 items-center justify-center rounded-full border-4 border-card shadow-sm ${item.tone}`}
                                            >
                                                <span className="size-2 rounded-full bg-current" />
                                            </motion.div>
                                            <span className="mt-1 block whitespace-nowrap rounded-md bg-card/95 px-1.5 py-1 text-[7px] font-bold shadow-sm">
                                                {item.location}
                                            </span>
                                        </div>
                                    ))}
                                    <span className="absolute bottom-2 left-2 rounded-md bg-card/90 px-2 py-1 text-[7px] font-semibold text-muted-foreground">
                                        Illustrative map
                                    </span>
                                </div>
                            </div>
                            <div className="rounded-xl border border-border bg-card p-2.5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-extrabold">
                                            Incident queue
                                        </p>
                                        <p className="text-[8px] text-muted-foreground">
                                            Prioritized for review
                                        </p>
                                    </div>
                                    <span className="rounded-sm bg-primary/10 px-2 py-1 text-[8px] font-bold text-primary">
                                        12
                                    </span>
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {previewIncidents.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-2 rounded-lg bg-background p-2"
                                        >
                                            <span
                                                className={`flex size-5 shrink-0 items-center justify-center rounded-md ${item.tone}`}
                                            >
                                                <CircleAlert className="size-2.5" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[8px] font-bold">
                                                    {item.title}
                                                </p>
                                                <p className="truncate text-[7px] text-muted-foreground">
                                                    {item.location} ·{" "}
                                                    {item.status}
                                                </p>
                                            </div>
                                            <span className="text-[8px] font-extrabold">
                                                {item.risk}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl border border-border bg-card px-3 py-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[9px] font-extrabold">
                                    Recent activity
                                </p>
                                <span className="text-[7px] font-bold text-primary">
                                    Sample timeline
                                </span>
                            </div>
                            <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                                {previewActivity.map((item) => (
                                    <div
                                        key={item.title}
                                        className="flex min-w-0 items-center gap-1.5"
                                    >
                                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                            <CircleCheck className="size-2" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-[7px] font-bold">
                                                {item.title}
                                            </p>
                                            <p className="truncate text-[7px] text-muted-foreground">
                                                {item.time} · {item.detail}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function DemoPulse({ reduceMotion }: { reduceMotion: boolean }) {
    return (
        <section
            className="border-b border-border bg-card"
            aria-label="Sample system pulse"
        >
            <div className="grid w-full gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr] lg:items-center lg:px-8">
                <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Zap className="size-4" />
                    </span>
                    <div>
                        <p className="text-[10px] font-extrabold tracking-[.14em] text-foreground uppercase">
                            System pulse
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            An example of the bigger picture
                        </p>
                    </div>
                    <span className="ml-2 rounded-sm bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">
                        Sample data
                    </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {previewStats.map(
                        ({ title, value, note, icon: Icon, tone }, index) => (
                            <motion.div
                                key={title}
                                initial={
                                    reduceMotion ? false : { opacity: 0, y: 8 }
                                }
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.4 }}
                                transition={{
                                    duration: 0.35,
                                    delay: index * 0.06,
                                }}
                                whileHover={{ y: -2 }}
                                className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/70 px-3 py-2"
                            >
                                <span
                                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${tone}`}
                                >
                                    <Icon className="size-3.5" />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-[10px] font-bold text-foreground">
                                            {title}
                                        </p>
                                        <span className="text-[10px] font-extrabold text-primary">
                                            {value}
                                        </span>
                                    </div>
                                    <p className="truncate text-[9px] text-muted-foreground">
                                        {note}
                                    </p>
                                </div>
                            </motion.div>
                        ),
                    )}
                </div>
            </div>
        </section>
    );
}

export default function LandingPage() {
    const reduceMotion = useReducedMotion();

    return (
        <main className="min-h-screen overflow-hidden bg-background text-foreground">
            <section className="relative bg-accent/40">
                <div
                    className="absolute top-0 right-0 size-[min(55vw,700px)] rounded-full bg-accent blur-3xl"
                    aria-hidden
                />
                <div className="relative w-full px-4 sm:px-6 lg:px-8">
                    <motion.nav
                        initial={reduceMotion ? false : { opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="sticky top-3 z-40 flex items-center justify-between rounded-xl border border-border/80 bg-background/80 px-3 py-2.5 shadow-[0_8px_28px_rgba(29,41,61,.08)] backdrop-blur-xl sm:px-4"
                    >
                        <Link
                            href="/"
                            className="flex items-center gap-2.5"
                            aria-label="ShaktiOS home"
                        >
                            <ShaktiLogo
                                size={40}
                                className="rounded-lg shadow-sm"
                            />
                            <span className="hidden sm:block">
                                <span className="block text-sm font-extrabold tracking-[.16em]">
                                    SHAKTIOS
                                </span>
                                <span className="block text-[9px] font-semibold tracking-[.12em] text-muted-foreground uppercase">
                                    Civic intelligence
                                </span>
                            </span>
                        </Link>
                        <div className="hidden items-center gap-1 rounded-xl border border-border/70 bg-background/80 p-1 md:flex">
                            <motion.a
                                whileHover={{ y: -1 }}
                                href="#how-it-works"
                                className="rounded-lg bg-card px-3 py-2 text-[11px] font-bold text-foreground shadow-sm"
                            >
                                How it works
                            </motion.a>
                            <motion.a
                                whileHover={{ y: -1 }}
                                href="#signals"
                                className="rounded-lg px-3 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                            >
                                Signals
                            </motion.a>
                            <motion.a
                                whileHover={{ y: -1 }}
                                href="#operators"
                                className="rounded-lg px-3 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                            >
                                For operators
                            </motion.a>
                        </div>
                        <div className="flex items-center gap-2">
                            <ModeToggle />
                            <Button
                                render={<Link href="/dashboard" />}
                                nativeButton={false}
                                size="sm"
                                className="h-9 rounded-lg px-3.5 shadow-sm"
                            >
                                Open dashboard <ArrowUpRight />
                            </Button>
                        </div>
                    </motion.nav>
                    <div className="grid gap-8 pt-8 pb-8 sm:pt-10 sm:pb-10 lg:grid-cols-[.86fr_1.14fr] lg:items-center lg:gap-12 lg:pt-12 lg:pb-12">
                        <motion.div
                            initial={
                                reduceMotion ? false : { opacity: 0, y: 24 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.7,
                                delay: 0.08,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                            className="relative z-10"
                        >
                            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-primary/15 bg-card/70 px-3 py-1.5 text-[10px] font-bold tracking-[.14em] text-primary uppercase">
                                <span className="size-1.5 rounded-full bg-success" />{" "}
                                Event-driven intelligence
                            </div>
                            <h1 className="max-w-2xl text-[clamp(3.5rem,7.5vw,7.5rem)] leading-[.89] font-extrabold tracking-[-.085em] text-foreground">
                                Safer places start with a clearer picture.
                            </h1>
                            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                ShaktiOS turns crowd density from venue feeds,
                                Civic-Shield concern, and citizen reports into
                                explainable incidents — so operators can triage
                                the next decision with context, not guesswork.
                            </p>
                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                <Button
                                    render={<Link href="/dashboard" />}
                                    nativeButton={false}
                                    size="lg"
                                    className="h-12 rounded-lg px-6 shadow-md"
                                >
                                    Enter command center <ArrowRight />
                                </Button>
                                <a
                                    href="#how-it-works"
                                    className="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-card/70"
                                >
                                    See the system <ArrowDownIcon />
                                </a>
                            </div>
                            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-semibold text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Check className="size-3 text-success" />{" "}
                                    Explainable risk
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Check className="size-3 text-success" />{" "}
                                    Human approval
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Check className="size-3 text-success" />{" "}
                                    Timeline by default
                                </span>
                            </div>
                        </motion.div>
                        <motion.div
                            initial={
                                reduceMotion ? false : { opacity: 0, x: 28 }
                            }
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                                duration: 0.75,
                                delay: 0.22,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                            className="relative z-10 lg:pt-8"
                        >
                            <DashboardPreview />
                        </motion.div>
                    </div>
                </div>
            </section>

            <DemoPulse reduceMotion={Boolean(reduceMotion)} />

            <section
                id="how-it-works"
                className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
            >
                <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-12">
                    <div>
                        <p className="text-[10px] font-extrabold tracking-[.18em] text-primary uppercase">
                            The ShaktiOS loop
                        </p>
                        <h2 className="mt-4 max-w-md text-4xl leading-[.96] font-extrabold tracking-[-.07em] sm:text-6xl">
                            From scattered signals to one next step.
                        </h2>
                        <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
                            A crowd spike at Gate 4, a rising social concern,
                            and one blocked-entrance report should not live in
                            separate tabs. ShaktiOS places them in the same
                            operational story.
                        </p>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-12 lg:grid-rows-2">
                        <motion.article
                            whileHover={{ y: -3 }}
                            transition={{ duration: 0.2 }}
                            className="relative overflow-hidden rounded-xl bg-primary p-6 text-primary-foreground sm:p-8 lg:col-span-7 lg:row-span-2"
                        >
                            <div className="absolute -right-20 -bottom-24 size-64 rounded-full bg-primary-foreground/15 blur-3xl" />
                            <div className="relative flex h-full min-h-72 flex-col justify-between">
                                <div className="flex items-start justify-between">
                                    <span className="flex size-11 items-center justify-center rounded-lg bg-primary-foreground/15">
                                        <Radio className="size-5" />
                                    </span>
                                    <span className="text-xs font-extrabold opacity-70">
                                        01 / 04
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold tracking-[.16em] uppercase opacity-75">
                                        Signals
                                    </p>
                                    <h3 className="mt-3 max-w-md text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">
                                        Many observations. One event language.
                                    </h3>
                                    <div className="mt-7 flex flex-wrap gap-2 text-[10px] font-bold">
                                        <span className="rounded-sm bg-primary-foreground/15 px-3 py-1.5">
                                            Crowd
                                        </span>
                                        <span className="rounded-sm bg-primary-foreground/15 px-3 py-1.5">
                                            Social
                                        </span>
                                        <span className="rounded-sm bg-primary-foreground/15 px-3 py-1.5">
                                            Citizen
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.article>
                        <motion.article
                            whileHover={{ y: -3 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-xl border border-border bg-card p-6 lg:col-span-5"
                        >
                            <div className="flex items-start justify-between">
                                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <GitBranch className="size-5" />
                                </span>
                                <span className="text-xs font-extrabold text-primary">
                                    02
                                </span>
                            </div>
                            <h3 className="mt-8 text-xl font-extrabold tracking-[-.04em]">
                                Fuse the context.
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Location and time connect Gate 4 observations
                                into one evolving incident instead of three
                                disconnected alerts.
                            </p>
                        </motion.article>
                        <motion.article
                            whileHover={{ y: -3 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-xl border border-border bg-muted p-6 lg:col-span-5"
                        >
                            <div className="flex items-start justify-between">
                                <span className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                                    <Gauge className="size-5" />
                                </span>
                                <span className="text-xs font-extrabold text-warning">
                                    03
                                </span>
                            </div>
                            <h3 className="mt-8 text-xl font-extrabold tracking-[-.04em]">
                                Explain the risk.
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Density, velocity, movement, and reports stay
                                visible before anyone approves a response.
                            </p>
                        </motion.article>
                        <motion.article
                            whileHover={{ y: -3 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-xl border border-primary/15 bg-accent p-6 lg:col-span-12"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 items-center justify-center rounded-xl bg-card text-primary">
                                        <ShieldCheck className="size-5" />
                                    </span>
                                    <div>
                                        <p className="text-xs font-extrabold tracking-[.14em] text-primary uppercase">
                                            04 · Human decision
                                        </p>
                                        <p className="mt-1 text-sm font-bold">
                                            Review the evidence. Approve the
                                            next incident state.
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="size-5 text-primary" />
                            </div>
                        </motion.article>
                    </div>
                </div>
            </section>

            <section id="signals" className="bg-muted">
                <div className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        <div>
                            <p className="text-[10px] font-extrabold tracking-[.18em] text-primary uppercase">
                                Meet the inputs
                            </p>
                            <h2 className="mt-4 text-4xl font-extrabold tracking-[-.07em] sm:text-5xl">
                                Different sources. Shared understanding.
                            </h2>
                        </div>
                        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                            Each source becomes a normalized event with a
                            location, timestamp, confidence, and payload that
                            operators can compare and correlate.
                        </p>
                    </div>
                    <div className="mt-10 grid gap-4 md:grid-cols-3">
                        {sourceCards.map(
                            (
                                { icon: Icon, title, copy, bg, iconColor },
                                index,
                            ) => (
                                <motion.article
                                    key={title}
                                    initial={
                                        reduceMotion
                                            ? false
                                            : { opacity: 0, y: 18 }
                                    }
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.2 }}
                                    transition={{
                                        duration: 0.45,
                                        delay: index * 0.08,
                                    }}
                                    whileHover={{ y: -4 }}
                                    className="rounded-xl border border-border bg-card p-6 shadow-[0_4px_18px_rgba(29,41,61,.03)] transition-shadow duration-300 hover:shadow-md sm:p-8"
                                >
                                    <span
                                        className={`flex size-12 items-center justify-center rounded-lg ${bg} ${iconColor}`}
                                    >
                                        <Icon className="size-5" />
                                    </span>
                                    <h3 className="mt-14 text-2xl font-extrabold tracking-[-.04em]">
                                        {title}
                                    </h3>
                                    <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
                                        {copy}
                                    </p>
                                    <Link
                                        href="/signals"
                                        className="mt-8 inline-flex items-center gap-1.5 text-xs font-extrabold text-primary"
                                    >
                                        Explore {title.toLowerCase()}{" "}
                                        <ArrowUpRight className="size-3.5" />
                                    </Link>
                                </motion.article>
                            ),
                        )}
                    </div>
                </div>
            </section>

            <section
                id="operators"
                className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
            >
                <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
                    <div className="rounded-2xl bg-primary p-8 text-primary-foreground sm:p-12">
                        <div className="flex size-12 items-center justify-center rounded-lg bg-primary-foreground/15">
                            <Gauge className="size-6" />
                        </div>
                        <h2 className="mt-16 max-w-xl text-4xl leading-[.95] font-extrabold tracking-[-.07em] sm:text-6xl">
                            Risk should be understandable before action is
                            approved.
                        </h2>
                        <p className="mt-6 max-w-lg text-base leading-7 text-primary-foreground/80">
                            Density, social velocity, abnormal movement, and
                            citizen reports remain visible as weighted factors.
                            The operator sees why Gate 4 moved to elevated risk,
                            not just a number.
                        </p>
                        <Link
                            href="/dashboard"
                            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-card px-4 py-3 text-sm font-extrabold text-primary transition-colors hover:bg-accent"
                        >
                            Review the command center{" "}
                            <ArrowUpRight className="size-4" />
                        </Link>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="rounded-2xl border border-border bg-card p-7 sm:p-8">
                            <div className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                                    <ShieldCheck className="size-5" />
                                </span>
                                <span className="text-[10px] font-extrabold tracking-[.13em] text-muted-foreground uppercase">
                                    Human checkpoint
                                </span>
                            </div>
                            <h3 className="mt-10 text-2xl font-extrabold tracking-[-.04em]">
                                Observe. Understand. Decide.
                            </h3>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Detection never dispatches on its own. Operators
                                move incidents from Detected to Assessing,
                                Responding, or Resolved.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-card p-7 sm:p-8">
                            <div className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <GitBranch className="size-5" />
                                </span>
                                <span className="text-[10px] font-extrabold tracking-[.13em] text-muted-foreground uppercase">
                                    Timeline memory
                                </span>
                            </div>
                            <h3 className="mt-10 text-2xl font-extrabold tracking-[-.04em]">
                                Nothing important disappears.
                            </h3>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Correlated events, operator notes, status
                                changes, and approved n8n handoffs stay
                                traceable in one timeline.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="w-full px-4 pb-6 sm:px-6 lg:px-8">
                <div className="relative w-full overflow-hidden rounded-2xl bg-accent px-7 py-14 sm:px-12 sm:py-20">
                    <div className="absolute -top-32 right-0 size-80 rounded-full bg-card/60 blur-3xl" />
                    <div className="relative flex flex-col justify-between gap-9 lg:flex-row lg:items-end">
                        <div>
                            <p className="text-[10px] font-extrabold tracking-[.18em] text-primary uppercase">
                                Make the next decision clearer
                            </p>
                            <h2 className="mt-4 max-w-3xl text-4xl leading-[.95] font-extrabold tracking-[-.07em] sm:text-6xl">
                                A live operating picture for the next decision
                                at every gate, venue, and community.
                            </h2>
                        </div>
                        <Button
                            render={<Link href="/dashboard" />}
                            nativeButton={false}
                            size="lg"
                            className="h-12 w-fit rounded-lg px-6 shadow-md"
                        >
                            Open the dashboard <ArrowUpRight />
                        </Button>
                    </div>
                </div>
            </section>

            <footer className="border-t border-border bg-card">
                <div className="flex w-full flex-col gap-4 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <Link href="/" className="flex items-center gap-2.5">
                        <ShaktiLogo size={32} />
                        <span className="font-extrabold tracking-[.16em]">
                            SHAKTIOS
                        </span>
                    </Link>
                    <span className="text-muted-foreground">
                        HackSpire 2026 · Human-approved intelligence
                    </span>
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-1 font-extrabold text-primary"
                    >
                        Command center <ArrowUpRight className="size-3.5" />
                    </Link>
                </div>
            </footer>
        </main>
    );
}

function ArrowDownIcon() {
    return <ArrowRight className="size-4 rotate-90" />;
}
