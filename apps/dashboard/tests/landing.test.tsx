import { act, cleanup, render, screen, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Animation and Next route prefetching are outside this data-boundary test.
vi.mock("motion/react", async () => {
  const { createElement } = await import("react");
  const motionProps = new Set(["initial", "animate", "transition", "whileHover", "whileInView", "viewport"]);
  const element = (tag: string) => function StaticMotion(props: Record<string, unknown>) {
    const attributes = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children" && !motionProps.has(key)));
    return createElement(tag, attributes, props.children as ReactNode);
  };
  return {
    motion: { div: element("div"), nav: element("nav"), a: element("a"), article: element("article") },
    useReducedMotion: () => true,
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

import LandingPage from "../app/page";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("landing page demo data", () => {
  it("always shows a populated preview and pulse without contacting or polling the API", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error("API offline"));
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(LandingPage));

    expect(screen.getByText("Demo preview")).toBeInTheDocument();
    expect(screen.getByText("Crowd buildup")).toBeInTheDocument();
    expect(screen.getByText("Operator review started")).toBeInTheDocument();
    expect(screen.getByText("Ranchi · College circuit")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Demo venue map of Ranchi/ })).toBeInTheDocument();
    const pulse = within(screen.getByRole("region", { name: "Sample system pulse" }));
    expect(pulse.getByText("Sample data")).toBeInTheDocument();
    for (const value of ["12", "03", "128", "08"]) {
      expect(pulse.getByText(value)).toBeInTheDocument();
    }

    // Advance beyond the removed 30-second polling intervals.
    await act(async () => { vi.advanceTimersByTime(90_000); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/HTTP (unavailable|checking|live)|Loading public overview|Public overview unavailable/i)).not.toBeInTheDocument();
    // Landing CTAs are anchors with role="button"; query the exposed role.
    expect(screen.getAllByRole("button", { name: /Open (the )?dashboard|Enter command center/i }).every((link) => link.getAttribute("href") === "/dashboard")).toBe(true);
  });
});
