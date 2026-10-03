"""Basic Retrieval-Augmented Generation over the AgriSense knowledge corpus.

Retrieval: TF-IDF over markdown sections (corpus + generated dataset summaries).
Generation: an OpenAI-compatible chat endpoint when LLM_API_KEY is set
(OpenAI, Hugging Face router, Groq, local vLLM...), otherwise an extractive answer
built from the retrieved passages.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import httpx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

from agrisense_ml.knowledge import CROP_PROFILES
from app.core.config import get_settings
from app.services.ml import load_artifact

log = logging.getLogger(__name__)
CORPUS_DIR = Path(__file__).resolve().parents[1] / "rag_corpus"
LANG_NAMES = {"en": "English", "hi": "Hindi", "te": "Telugu", "ta": "Tamil", "mr": "Marathi"}


@dataclass
class Passage:
    id: str
    title: str
    text: str
    source: str


def _split_markdown(text: str, source: str) -> list[Passage]:
    out, title, buf = [], source, []
    for line in text.splitlines():
        if line.startswith("## "):
            if buf:
                out.append(Passage(f"{source}#{len(out)}", title, "\n".join(buf).strip(), source))
            title, buf = line[3:].strip(), []
        elif not line.startswith("# "):
            buf.append(line)
    if buf:
        out.append(Passage(f"{source}#{len(out)}", title, "\n".join(buf).strip(), source))
    return [p for p in out if p.text]


def _dataset_passages() -> list[Passage]:
    passages = []
    meta = load_artifact("metadata.json")["crop_model"]
    passages.append(
        Passage(
            "dataset#model",
            "How AgriSense recommends crops",
            f"The crop recommender blends agronomic suitability ranges, regional census data and an ML model "
            f"trained on {meta['rows']} sensor rows. The ML model accuracy is {meta['accuracy']:.0%} versus "
            f"{meta['chance_accuracy']:.0%} chance, so its weight is {meta['ml_weight']}. "
            + (meta.get("data_quality_warning") or ""),
            "sensor_crop_dataset",
        )
    )
    regional = load_artifact("regional_prior.json")
    for state, crops in regional["states"].items():
        top = sorted(crops.items(), key=lambda kv: kv[1]["area_ha"], reverse=True)[:4]
        if not top or top[0][1]["area_ha"] == 0:
            continue
        lines = ", ".join(f"{c} ({v['area_ha']:,.0f} ha, {v['share_pct']:.1f}% of cropped area)" for c, v in top)
        passages.append(
            Passage(
                f"census#{state}",
                f"Main crops in {state}",
                f"Agricultural census {regional['census_year']}: the most grown AgriSense crops in {state} "
                f"are {lines}.",
                "state-level-agcensus-crop",
            )
        )
    for state, b in load_artifact("weather_baseline.json").items():
        passages.append(
            Passage(
                f"weather#{state}",
                f"Typical weather snapshot for {state}",
                f"Across {b['districts']} districts of {state} the recorded average was {b['temp_c']}°C, "
                f"humidity {b['humidity']}%, wind {b['wind_kmh']} km/h, mostly {b['condition']} "
                f"(observed {b['observed']}).",
                "weather-1",
            )
        )
    for crop, p in CROP_PROFILES.items():
        passages.append(
            Passage(
                f"profile#{crop}",
                f"{crop} ideal conditions",
                f"{crop} grows best with N {p['N'][0]}-{p['N'][1]}, P {p['P'][0]}-{p['P'][1]}, "
                f"K {p['K'][0]}-{p['K'][1]}, "
                f"pH {p['ph'][0]}-{p['ph'][1]}, temperature {p['temp'][0]}-{p['temp'][1]}°C, soil moisture "
                f"{p['moisture'][0]}-{p['moisture'][1]}%. "
                f"It matures in {p['duration_days'][0]}-{p['duration_days'][1]} days.",
                "crop_profiles",
            )
        )
    return passages


class KnowledgeBase:
    def __init__(self, passages: list[Passage]):
        self.passages = passages
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        self.matrix = self.vectorizer.fit_transform([f"{p.title}\n{p.title}\n{p.text}" for p in passages])

    def search(self, query: str, k: int = 4, min_score: float = 0.03) -> list[tuple[Passage, float]]:
        sims = linear_kernel(self.vectorizer.transform([query]), self.matrix).ravel()
        order = sims.argsort()[::-1][:k]
        return [(self.passages[i], float(sims[i])) for i in order if sims[i] >= min_score]


@lru_cache
def get_kb() -> KnowledgeBase:
    passages = []
    for path in sorted(CORPUS_DIR.glob("*.md")):
        passages += _split_markdown(path.read_text(), path.stem)
    passages += _dataset_passages()
    log.info("RAG knowledge base: %d passages", len(passages))
    return KnowledgeBase(passages)


def prevention_steps(tags: list[str], crop: str, k: int = 4) -> list[dict]:
    if not tags:
        return []
    kb = get_kb()
    seen, out = set(), []
    for tag in tags:
        for p, score in kb.search(f"{tag} {crop} prevention", k=2):
            if p.id in seen or p.source != "prevention":
                continue
            seen.add(p.id)
            out.append({"title": p.title, "text": p.text, "source": p.source, "score": round(score, 3)})
    return sorted(out, key=lambda x: x["score"], reverse=True)[:k]


def _first_sentences(text: str, n: int = 3) -> str:
    bullets = [b.strip("-* ").strip() for b in text.splitlines() if b.strip().startswith(("-", "*"))]
    if bullets:
        return " ".join(f"• {b}" for b in bullets[:n])
    return " ".join(re.split(r"(?<=[.!?])\s+", text.strip())[:n])


def answer(question: str, lang: str = "en", context: dict | None = None, history: list[dict] | None = None) -> dict:
    kb = get_kb()
    query = question
    if context and context.get("crop"):
        query += f" {context['crop']} " + " ".join(context.get("query_tags", []))
    hits = kb.search(query, k=4)
    sources = [{"title": p.title, "source": p.source, "score": round(s, 3)} for p, s in hits]
    s = get_settings()

    if s.llm_api_key:
        ctx = "\n\n".join(f"[{i + 1}] {p.title}\n{p.text}" for i, (p, _) in enumerate(hits))
        risk_ctx = ""
        if context:
            risk_ctx = (
                f"\nFarmer's latest risk assessment: crop {context.get('crop')}, score {context.get('score')} "
                f"({context.get('level')}). Causes: {'; '.join(context.get('main_causes', []))}"
            )
        messages = [
            {
                "role": "system",
                "content": (
                    "You are AgriSense, a friendly crop-health assistant for Indian farmers "
                    "with low digital literacy. "
                    "Answer in short, simple sentences (max 6), give concrete actionable prevention steps, "
                    "and only use "
                    f"facts from the provided context. Reply in {LANG_NAMES.get(lang, 'English')}."
                    f"\n\nContext:\n{ctx}{risk_ctx}"
                ),
            },
            *[{"role": m["role"], "content": m["content"]} for m in (history or [])[-6:]],
            {"role": "user", "content": question},
        ]
        try:
            r = httpx.post(
                f"{s.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {s.llm_api_key}"},
                json={"model": s.llm_model, "messages": messages, "temperature": 0.3, "max_tokens": 400},
                timeout=30,
            )
            r.raise_for_status()
            text = r.json()["choices"][0]["message"]["content"].strip()
            return {"answer": text, "sources": sources, "mode": "llm", "lang": lang}
        except (httpx.HTTPError, KeyError, IndexError) as e:
            log.warning("LLM call failed, using extractive answer: %s", e)

    if not hits:
        text = (
            "I don't have information on that yet. Try asking about soil pH, fertilizer, irrigation, "
            "pests, disease, weather or harvest for your crop."
        )
    else:
        parts = [f"{p.title}: {_first_sentences(p.text)}" for p, _ in hits[:2]]
        text = "\n\n".join(parts)
    return {"answer": text, "sources": sources, "mode": "extractive", "lang": "en"}
