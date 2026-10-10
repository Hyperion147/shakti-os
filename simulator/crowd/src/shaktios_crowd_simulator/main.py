import argparse
import asyncio
import json
import os
import math
from urllib.parse import urlsplit

import httpx


RANCHI_COLLEGE_ZONES: dict[str, dict[str, object]] = {
    # Hackspire26 Ranchi college-circuit demo locations (match the
    # venue-hackspire26-ranchi zones in scripts/seed_supabase.py).
    "hackspire26_ranchi_registration": {"density": 0.82},
    "hackspire26_ranchi_hacking_arena": {"density": 0.59},
    "hackspire26_ranchi_demo_stage": {"density": 0.76},
    "hackspire26_ranchi_food_rest": {"density": 0.31},
    "hackspire26_ranchi_campus_shuttle": {"density": 0.66},
}


def build_event(location: str = "gate_4", density: float = 0.42) -> dict[str, object]:
    if not location.strip() or not math.isfinite(density) or not 0 <= density <= 1:
        raise ValueError("A nonempty location and finite density between 0 and 1 are required")
    return {
        "type": "crowd_density",
        "source": "crowd_simulator",
        "location": location,
        "confidence": 0.95,
        "payload": {"density": density, "is_seeded": True},
    }


async def send_event(event: dict[str, object], api_url: str) -> dict[str, object]:
    key = os.getenv("SHAKTIOS_INGESTION_KEY", "").strip()
    if not key:
        raise RuntimeError("SHAKTIOS_INGESTION_KEY is required to send machine events")
    url = urlsplit(api_url)
    if url.username or url.password or url.query or url.fragment or not url.hostname or not (
        url.scheme == "https" or url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1", "::1"}
    ):
        raise ValueError("Use an HTTPS API URL (HTTP is allowed only for loopback development)")
    endpoint = f"{api_url.rstrip('/')}/events"
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False, trust_env=False) as client:
            response = await client.post(endpoint, json=event, headers={"X-ShaktiOS-Ingestion-Key": key})
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError:
        raise RuntimeError("Could not deliver event; check API access and availability") from None


def main() -> None:
    parser = argparse.ArgumentParser(description="Send one deterministic crowd event to ShaktiOS")
    parser.add_argument(
        "--api-url",
        default=os.getenv("SHAKTIOS_API_URL", "http://localhost:8000"),
        help="ShaktiOS API base URL",
    )
    parser.add_argument(
        "--location",
        default="gate_4",
        help="Event location (e.g. gate_4 or hackspire26_ranchi_registration)",
    )
    parser.add_argument(
        "--density",
        type=float,
        default=None,
        help="Crowd density 0-1 (defaults to scenario value or 0.42)",
    )
    parser.add_argument(
        "--scenario",
        default="",
        choices=["", "ranchi-fest"],
        help="Preset scenario: 'ranchi-fest' sends a peak registration-crush event from the Ranchi college circuit",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the event without sending it",
    )
    args = parser.parse_args()
    location = args.location
    density = args.density
    if args.scenario == "ranchi-fest":
        location = "hackspire26_ranchi_registration"
        density = 0.82 if density is None else density
    if density is None:
        preset = RANCHI_COLLEGE_ZONES.get(location)
        density = float(preset["density"]) if preset else 0.42
    try:
        event = build_event(location, density)
    except ValueError as error:
        parser.error(str(error))
    if args.dry_run:
        print(json.dumps(event, indent=2))
        return

    try:
        persisted = asyncio.run(send_event(event, args.api_url))
    except (RuntimeError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(persisted, indent=2))


if __name__ == "__main__":
    main()
