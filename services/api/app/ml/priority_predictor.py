from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

MODEL_VERSION = "priority-predictor-v1.1.0"
DATASET_VERSION = "complaints-seed-v1"

CRITICAL_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("electrical_safety", ("electric shock", "electrical shock", "sparking", "sparks", "burning smell", "smoke", "fire", "exposed electrical wire", "exposed wire", "short circuit")),
    ("water_emergency", ("flooding", "flooded", "pipe has burst", "burst pipe", "sewage overflow", "sewage water", "major water leak")),
    ("security_threat", ("intruder", "suspicious person", "serious security threat", "unauthorized entry", "weapon", "assault", "physical attack")),
    ("transport_safety", ("brake problem", "brake failure", "serious brake", "transport safety", "bus accident", "vehicle accident")),
    ("structural_hazard", ("collapsed", "ceiling collapsed", "shattered glass", "broken glass on the floor", "emergency evacuation", "emergency exit blocked", "dangerous obstacle")),
    ("medical_emergency", ("medical emergency", "unconscious", "not breathing", "severe injury", "life threatening")),
    ("hazardous_material", ("chemical spill", "toxic leak", "gas leak", "gas smell")),
)


def _dataset_path() -> Path:
    return Path(__file__).resolve().parents[4] / "ml" / "data" / "complaints_seed.csv"


def _load_rows() -> list[dict[str, str]]:
    with _dataset_path().open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


@dataclass(frozen=True)
class PriorityResult:
    priority: str
    confidence: float
    method: str
    explanation: str
    matched_rules: list[str]
    model_version: str


class PriorityPredictor:
    def __init__(self) -> None:
        self.model = self._train()

    @staticmethod
    def _build_model() -> Pipeline:
        return Pipeline([
            ("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True, strip_accents="unicode")),
            ("classifier", LogisticRegression(max_iter=3000, class_weight="balanced", random_state=42)),
        ])

    @classmethod
    def _train(cls) -> Pipeline:
        rows = _load_rows()
        texts = [f"{row['title']}. {row['description']}" for row in rows]
        labels = [row["priority"] for row in rows]
        model = cls._build_model()
        model.fit(texts, labels)
        return model

    @staticmethod
    def _matched_rules(text: str) -> list[str]:
        normalized = " ".join(text.lower().split())
        return [name for name, terms in CRITICAL_RULES if any(term in normalized for term in terms)]

    def predict(self, title: str, description: str) -> PriorityResult:
        text = f"{title.strip()}. {description.strip()}"
        matched = self._matched_rules(text)
        if matched:
            return PriorityResult(
                priority="critical", confidence=1.0, method="safety_rule_override",
                explanation="Critical safety language detected: " + ", ".join(matched) + ".",
                matched_rules=matched, model_version=MODEL_VERSION,
            )
        probabilities = self.model.predict_proba([text])[0]
        classes = self.model.classes_
        index = int(probabilities.argmax())
        confidence = float(probabilities[index])
        return PriorityResult(
            priority=str(classes[index]), confidence=round(confidence, 4),
            method="tfidf_logistic_regression",
            explanation="Priority predicted from the complaint title and description using the trained baseline model.",
            matched_rules=[], model_version=MODEL_VERSION,
        )

    def evaluate(self) -> dict[str, float]:
        rows = _load_rows()
        texts = [f"{row['title']}. {row['description']}" for row in rows]
        labels = [row["priority"] for row in rows]
        x_train, x_test, y_train, y_test = train_test_split(
            texts, labels, test_size=0.2, random_state=42, stratify=labels,
        )
        model = self._build_model()
        model.fit(x_train, y_train)
        predictions = model.predict(x_test)
        return {
            "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
            "macro_f1": round(float(f1_score(y_test, predictions, average="macro")), 4),
        }


@lru_cache(maxsize=1)
def get_priority_predictor() -> PriorityPredictor:
    return PriorityPredictor()
