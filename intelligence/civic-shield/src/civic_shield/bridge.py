"""Lightweight bridge between Civic-Shield analysis and ShaktiOS Events.

Extracts only the necessary intelligence functions from the Civic-Shield
backend (sentiment, trend, credibility, geo) and packages them into
a signal dict that CivicShieldAdapter.to_event() can consume.

No database, no Redis, no external services required for demo.
"""

from __future__ import annotations

import json
import random
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

# ---------------------------------------------------------------------------
# GEO — Region matching (from Civic-Shield geo_service.py)
# ---------------------------------------------------------------------------

INDIA_REGIONS: dict[str, dict[str, Any]] = {
    "Delhi NCR": {"lat": 28.6139, "lon": 77.2090, "keywords": ["delhi", "new delhi", "noida", "gurgaon", "gurugram", "ncr", "faridabad", "ghaziabad"]},
    "Uttar Pradesh": {"lat": 26.8467, "lon": 80.9462, "keywords": ["lucknow", "kanpur", "varanasi", "prayagraj", "allahabad", "agra", "meerut", "uttar pradesh", " up "]},
    "Punjab": {"lat": 31.1471, "lon": 75.3412, "keywords": ["punjab", "chandigarh", "amritsar", "ludhiana", "jalandhar"]},
    "Haryana": {"lat": 29.0588, "lon": 76.0856, "keywords": ["haryana", "hisar", "rohtak", "panipat"]},
    "Rajasthan": {"lat": 27.0238, "lon": 74.2179, "keywords": ["rajasthan", "jaipur", "jodhpur", "udaipur", "kota", "ajmer"]},
    "Maharashtra": {"lat": 19.7515, "lon": 75.7139, "keywords": ["maharashtra", "mumbai", "pune", "nagpur", "nashik", "thane", "aurangabad"]},
    "Karnataka": {"lat": 15.3173, "lon": 75.7139, "keywords": ["karnataka", "bengaluru", "bangalore", "mysuru", "mysore", "mangalore", "hubli"]},
    "Tamil Nadu": {"lat": 11.1271, "lon": 78.6569, "keywords": ["tamil nadu", "chennai", "coimbatore", "madurai", "trichy", "salem"]},
    "West Bengal": {"lat": 22.9868, "lon": 87.8550, "keywords": ["west bengal", "kolkata", "howrah", "siliguri", "durgapur"]},
    "Gujarat": {"lat": 22.2587, "lon": 71.1924, "keywords": ["gujarat", "ahmedabad", "surat", "vadodara", "rajkot"]},
    "Kerala": {"lat": 10.8505, "lon": 76.2711, "keywords": ["kerala", "kochi", "cochin", "thiruvananthapuram", "kozhikode", "calicut"]},
    "Assam / Northeast": {"lat": 26.2006, "lon": 92.9376, "keywords": ["assam", "guwahati", "manipur", "meghalaya", "nagaland", "tripura", "mizoram", "sikkim", "arunachal"]},
    "Telangana": {"lat": 18.1124, "lon": 79.0193, "keywords": ["telangana", "hyderabad", "warangal", "nizamabad"]},
    "Andhra Pradesh": {"lat": 15.9129, "lon": 79.7400, "keywords": ["andhra pradesh", "vijayawada", "visakhapatnam", "vizag", "tirupati"]},
    "Madhya Pradesh": {"lat": 22.9734, "lon": 78.6569, "keywords": ["madhya pradesh", " mp ", "bhopal", "indore", "gwalior", "jabalpur"]},
    "Bihar": {"lat": 25.0961, "lon": 85.3131, "keywords": ["bihar", "patna", "gaya", "muzaffarpur", "bhagalpur"]},
    "Jharkhand": {"lat": 23.6102, "lon": 85.2799, "keywords": ["jharkhand", "ranchi", "morabadi", "mesra", "dhanbad", "bokaro", "jamshedpur"]},
    "Odisha": {"lat": 20.9517, "lon": 85.0985, "keywords": ["odisha", "orissa", "bhubaneswar", "cuttack", "rourkela"]},
    "Chhattisgarh": {"lat": 21.2787, "lon": 81.8661, "keywords": ["chhattisgarh", "raipur", "bilaspur", "bastar"]},
    "Jammu & Kashmir": {"lat": 33.7782, "lon": 76.5762, "keywords": ["jammu", "kashmir", "srinagar", "j&k", "leh", "ladakh"]},
    "International": {"lat": 20.0, "lon": 0.0, "keywords": ["usa", "uk", "california", "london", "canada", "germany", "singapore", "dubai", "australia"]},
}

UNCLASSIFIED_REGION = "Other / Undefined"


def match_region_from_text(text: str | None) -> str | None:
    if not text:
        return None
    lower = f" {text.lower()} "
    for region, meta in INDIA_REGIONS.items():
        if any(kw in lower for kw in meta["keywords"]):
            return region
    return None


# ---------------------------------------------------------------------------
# SENTIMENT — LLM-based analysis (from Civic-Shield sentiment_service.py)
# ---------------------------------------------------------------------------

_SENTIMENT_FALLBACK: dict[str, Any] = {
    "sentiment": "neutral",
    "emotion": "neutral",
    "confidence": 0.85,
    "is_sarcastic": False,
    "sarcasm_confidence": 0.0,
}


def analyze_sentiment_and_emotion(text: str) -> dict[str, Any]:
    """Analyze text for sentiment and emotion. Falls back to neutral if Groq unavailable."""
    if not text or not str(text).strip():
        return dict(_SENTIMENT_FALLBACK)

    api_key = _get_groq_api_key()
    if not api_key:
        return dict(_SENTIMENT_FALLBACK)

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        prompt = (
            "Analyze this social post for civil tension/unrest. Return ONLY valid JSON:\n"
            '{"sentiment": "positive" | "negative" | "neutral", '
            '"emotion": "anger" | "fear" | "joy" | "sadness" | "neutral", '
            '"confidence": 0.88, "is_sarcastic": false, "sarcasm_confidence": 0.1}\n\n'
            f'Text: "{str(text)[:300]}"'
        )
        response = client.chat.completions.create(
            model=_get_groq_model(),
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        data = json.loads(response.choices[0].message.content)
        return {
            "sentiment": str(data.get("sentiment", "neutral")).lower(),
            "emotion": str(data.get("emotion", "neutral")).lower(),
            "confidence": round(float(data.get("confidence", 0.85)), 2),
            "is_sarcastic": bool(data.get("is_sarcastic", False)),
            "sarcasm_confidence": round(float(data.get("sarcasm_confidence", 0.0)), 2),
        }
    except Exception:
        return dict(_SENTIMENT_FALLBACK)


def _get_groq_api_key() -> str:
    import os
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key or key.startswith("gsk_your"):
        return ""
    return key


def _get_groq_model() -> str:
    import os
    return os.getenv("GROQ_MODEL", "qwen/qwen3.6-27b")


# ---------------------------------------------------------------------------
# CREDIBILITY — Rule-based misinformation scoring (from credibility_service.py)
# ---------------------------------------------------------------------------

_SENSATIONAL_PHRASES = [
    "you won't believe", "share before it's deleted", "share before deleted",
    "mainstream media won't tell you", "media is hiding", "wake up india",
    "forward this to everyone", "forward to all your contacts",
    "shocking truth", "they don't want you to know", "government is hiding",
    "must watch before deleted", "breaking:", "urgent:", "alert:",
    "100% true", "proof inside", "banned video", "leaked video",
]

_SOURCE_ATTRIBUTION_MARKERS = [
    "according to", "reported by", "source:", "via ", "http://", "https://",
    "confirmed by", "official statement",
]


def analyze_credibility(text: str) -> dict[str, Any]:
    if not text or not text.strip():
        return {
            "misinformation_risk_score": 0.0,
            "risk_level": "Low",
            "sensationalism_score": 0.0,
        }

    lower = text.lower()
    length = max(len(text), 1)

    phrase_hits = sum(1 for p in _SENSATIONAL_PHRASES if p in lower)
    phrase_score = min(phrase_hits * 25, 50)

    letters = [c for c in text if c.isalpha()]
    caps_ratio = (sum(1 for c in letters if c.isupper()) / len(letters)) if letters else 0.0
    caps_score = min(caps_ratio * 100, 25)

    exclaim_density = text.count("!") / (length / 100)
    exclaim_score = min(exclaim_density * 5, 15)

    has_attribution = any(marker in lower for marker in _SOURCE_ATTRIBUTION_MARKERS)
    no_source_score = 0 if has_attribution else 10

    total = round(min(phrase_score + caps_score + exclaim_score + no_source_score, 100), 1)
    risk_level = "High" if total >= 75 else ("Elevated" if total >= 50 else ("Moderate" if total >= 25 else "Low"))

    return {
        "misinformation_risk_score": total,
        "risk_level": risk_level,
        "sensationalism_score": total,
    }


# ---------------------------------------------------------------------------
# TREND — Velocity detection (from trend_service.py)
# ---------------------------------------------------------------------------

def extract_hashtags_and_keywords(text: str) -> list[str]:
    tags = re.findall(r"#\w+", text)
    return [t.lower() for t in tags]


def compute_trend_velocity(posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute trend velocity from a list of post dicts with 'text' and 'created_at' fields."""
    if not posts:
        return []

    ref_time = max(p["created_at"] for p in posts)
    t_mid = ref_time - timedelta(hours=2)
    t_start = ref_time - timedelta(hours=4)

    recent_counts: Counter[str] = Counter()
    past_counts: Counter[str] = Counter()

    for p in posts:
        ts = p["created_at"]
        tags = extract_hashtags_and_keywords(p["text"])
        if ts >= t_mid:
            recent_counts.update(tags)
        elif ts >= t_start:
            past_counts.update(tags)

    all_topics = set(recent_counts.keys()) | set(past_counts.keys())
    trends = []
    for topic in all_topics:
        c_recent = recent_counts.get(topic, 0)
        c_past = past_counts.get(topic, 0)
        if c_past == 0 and c_recent > 0:
            velocity_pct = float(c_recent * 100)
        elif c_past == 0 and c_recent == 0:
            velocity_pct = 0.0
        else:
            velocity_pct = round(((c_recent - c_past) / c_past) * 100.0, 1)
        trends.append({
            "topic": topic,
            "frequency": c_recent + c_past,
            "velocity_percentage": velocity_pct,
            "status": "surging" if velocity_pct >= 50 else ("rising" if velocity_pct > 0 else "declining"),
        })

    return sorted(trends, key=lambda x: (x["velocity_percentage"], x["frequency"]), reverse=True)[:5]


# ---------------------------------------------------------------------------
# MOCK DATA — Demo post generation (from mock_adapter.py)
# ---------------------------------------------------------------------------

_SAMPLE_USERS = [
    {"id": "usr_crowd_watcher", "username": "crowd_watcher", "bio": "Event Security Analyst | Ranchi"},
    {"id": "usr_local_news", "username": "local_news_hub", "bio": "Regional News Aggregator | Jharkhand"},
    {"id": "usr_student_eye", "username": "student_eye_witness", "bio": "College Student | BIT Mesra, Ranchi"},
    {"id": "usr_safety_first", "username": "safety_first_org", "bio": "Community Safety Volunteer | Morabadi"},
    {"id": "usr_social_feed", "username": "social_feed_bot", "bio": "Automated Social Aggregator | India"},
    {"id": "usr_campus_exec", "username": "campus_exec_rnc", "bio": "Fest Coordinator | St. Xavier's, Ranchi"},
    {"id": "usr_morabadi_local", "username": "morabadi_local", "bio": "Resident | Morabadi, Ranchi"},
]

_SAMPLE_TEXTS_NEGATIVE = [
    "Crowd situation near Gate 4 is getting out of control. People pushing and shoving. #SafetyConcern #Gate4",
    "URGENT: Heavy congestion at main entrance. Emergency vehicles cannot pass. #Gate4 #CrowdRisk",
    "Saw multiple altercations near Gate 4. Security overwhelmed. #PublicSafety",
    "Panic spreading through the crowd at Gate 4. People trying to leave. #Alert #Gate4",
    "Gate 4 area completely blocked. No movement possible. Very tense atmosphere. #CrowdControl",
    "Reports of stampede-like situation near Gate 4. Need immediate intervention. #Emergency",
    "Police struggling to maintain order at Gate 4. Crowd density critical. #Breaking",
    # Ranchi college-circuit moments (demo data).
    "Registration queue at Morabadi campus gate spilling onto the main road — badges taking forever! #RanchiFest #Crowd",
    "BIT Mesra demo stage footfall record, entry rerouted from the hostel side. #CampusFest",
    "Stuck near St. Xavier's food court — huge crowd but great vibe. #CollegeFest",
    "Shuttle pickup chaos at the station point — pushing and long waits. #RanchiCrowd",
]

_SAMPLE_TEXTS_NEUTRAL = [
    "Large gathering at Gate 4 for the event. Monitoring the situation. #EventDay",
    "Gate 4 entrance busy but orderly so far. Event starting soon. #LiveUpdates",
    "Crowd building up at Gate 4. Standard event-day congestion. #Gate4",
    "People arriving steadily at Gate 4. Queue management in progress. #EventLogistics",
    "Large evening crowd at the Morabadi campus fest — calm window 1-4pm, manageable queues. #CollegeFest2026",
]

_SAMPLE_TEXTS_POSITIVE = [
    "Great atmosphere at Gate 4! Crowd is excited and well-managed. #EventSuccess",
    "Smooth entry through Gate 4. Excellent crowd management today. #Positive",
    "Demo stage showcase was brilliant — well-managed crowd at BIT Mesra. #CampusFest",
    "Open-air judging session wrapped on time, orderly exits. Shubh Sandhya Ranchi! #CollegeFest",
]

_HEADLINES = [
    "Large Crowd Gathers at Gate 4 for Major Event",
    "Security Deployed as Crowds Build Near Gate 4",
    "Gate 4 Area Experiences Heavy Foot Traffic",
    "Event Organizers Monitor Gate 4 Crowd Density",
    "Social Media Reports of Crowding at Gate 4",
    "Registration Crush at Morabadi Campus Gate as Queue Spills onto Main Road",
]


def generate_demo_posts(
    location: str = "Gate 4",
    count: int = 12,
    negative_ratio: float = 0.5,
) -> list[dict[str, Any]]:
    """Generate demo social posts for a specific location scenario."""
    now = datetime.now(timezone.utc)
    posts = []
    for i in range(count):
        r = random.random()
        if r < negative_ratio:
            text = random.choice(_SAMPLE_TEXTS_NEGATIVE)
        elif r < negative_ratio + 0.2:
            text = random.choice(_SAMPLE_TEXTS_POSITIVE)
        else:
            text = random.choice(_SAMPLE_TEXTS_NEUTRAL)

        user = random.choice(_SAMPLE_USERS)
        created_at = now - timedelta(minutes=random.randint(1, 180))
        platform = random.choice(["x", "telegram", "reddit"])

        posts.append({
            "platform": platform,
            "platform_post_id": f"demo_{platform}_{i}_{int(created_at.timestamp())}",
            "author_id": user["id"],
            "author_username": user["username"],
            "author_bio": user["bio"],
            "text": text,
            "language": "en",
            "created_at": created_at,
            "parent_post_id": None,
            "engagement_count": {
                "likes": random.randint(5, 300),
                "shares": random.randint(1, 80),
                "comments": random.randint(0, 45),
            },
        })
    return posts


# ---------------------------------------------------------------------------
# BRIDGE — Build a Civic-Shield signal from analysis
# ---------------------------------------------------------------------------

def build_social_signal(
    posts: list[dict[str, Any]] | None = None,
    location: str = "Gate 4",
    platform: str = "multi",
    *,
    use_provider: bool = False,
) -> dict[str, Any]:
    """Run Civic-Shield analysis on posts and produce a signal dict.

    The returned dict matches the shape expected by CivicShieldAdapter.to_event().
    """
    if posts is None:
        posts = generate_demo_posts(location=location)

    # Sentiment analysis — aggregate across posts
    sentiments = []
    emotions = []
    for post in posts:
        result = analyze_sentiment_and_emotion(post["text"]) if use_provider else dict(_SENTIMENT_FALLBACK)
        sentiments.append(result["sentiment"])
        emotions.append(result["emotion"])

    sentiment_counts = Counter(sentiments)
    dominant_sentiment = sentiment_counts.most_common(1)[0][0] if sentiment_counts else "neutral"
    emotion_counts = Counter(emotions)
    dominant_emotion = emotion_counts.most_common(1)[0][0] if emotion_counts else "neutral"

    # Trend velocity
    trends = compute_trend_velocity(posts)
    top_trend = trends[0] if trends else None

    # Credibility — average across posts
    cred_scores = [analyze_credibility(p["text"])["misinformation_risk_score"] for p in posts]
    avg_credibility_risk = sum(cred_scores) / len(cred_scores) if cred_scores else 0.0

    # Region matching from author bios
    regions = [match_region_from_text(p.get("author_bio", "")) for p in posts]
    regions = [r for r in regions if r]
    primary_region = Counter(regions).most_common(1)[0][0] if regions else location

    # Mention count — total posts for this location/topic
    mention_count = len(posts)

    # Velocity from trend
    velocity = top_trend["velocity_percentage"] / 100.0 if top_trend else 0.0
    velocity = max(0.0, min(1.0, velocity))

    # Confidence based on data volume
    confidence = min(1.0, mention_count / 20.0)

    # Trend status
    trend_status = top_trend["status"] if top_trend else "stable"

    # Headline — prefer the campus-fest headline for Ranchi college-circuit locations.
    if location.startswith(("ranchi_", "hackspire26_ranchi_")) and len(_HEADLINES) > 1:
        headline = _HEADLINES[-1]
    else:
        headline = _HEADLINES[0] if _HEADLINES else None

    # Platform
    platform_set = set(p["platform"] for p in posts)
    platform_str = ", ".join(sorted(platform_set)) if len(platform_set) > 1 else (list(platform_set)[0] if platform_set else platform)

    return {
        # Region inferred from author bios must not replace the canonical zone.
        "location": location,
        "region": primary_region,
        "mention_count": mention_count,
        "sentiment": dominant_sentiment,
        "emotion": dominant_emotion,
        "velocity": velocity,
        "velocity_score": velocity,
        "avg_tone": -2.5 if dominant_sentiment == "negative" else (2.5 if dominant_sentiment == "positive" else 0.0),
        "tone": -2.5 if dominant_sentiment == "negative" else (2.5 if dominant_sentiment == "positive" else 0.0),
        "sample_headline": headline,
        "query_used": f"{location}_crowd_monitoring",
        "platform": platform_str,
        "trend_status": trend_status,
        "confidence": confidence,
        "credibility_risk": avg_credibility_risk,
        "post_count": mention_count,
        "sentiment_distribution": dict(sentiment_counts),
        "emotion_distribution": dict(emotion_counts),
        "top_trend": top_trend,
    }
