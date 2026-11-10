from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

MODEL_VERSION = "priority-predictor-v1.2.0"
DATASET_VERSION = "complaints-seed-v2"

CRITICAL_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("electrical_safety", ("electric shock", "electrocution", "sparking", "sparks", "burning smell", "exposed electrical wire", "exposed live wire", "smoke")),
    ("water_emergency", ("flooding", "flooded", "pipe has burst", "burst pipe", "sewage overflow", "sewage water")),
    ("security_threat", ("intruder", "suspicious person", "serious security threat", "unauthorized entry")),
    ("transport_safety", ("brake problem", "brake failure", "serious brake", "transport safety")),
    ("structural_hazard", ("collapsed", "shattered", "emergency evacuation", "dangerous obstacle")),
)
_NEGATION = re.compile(r"\b(?:no|not|never|without|isn't|aren't|wasn't|weren't|doesn't|don't|didn't)\b(?:\W+\w+){0,3}\W*$", re.IGNORECASE)


def _dataset_path() -> Path:
    return Path(__file__).resolve().parents[4] / "ml" / "data" / "complaints_seed.csv"


def _load_rows() -> list[dict[str, str]]:
    path = _dataset_path()
    if not path.exists():
        raise RuntimeError(f"ML training dataset is missing: {path}")
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    required = {"title", "description", "priority"}
    if not rows or not required.issubset(rows[0]):
        raise RuntimeError("Priority training dataset is empty or missing required columns.")
    valid = {"normal", "high", "critical"}
    cleaned: list[dict[str, str]] = []
    for row_number, row in enumerate(rows, start=2):
        title = " ".join((row.get("title") or "").split())
        description = " ".join((row.get("description") or "").split())
        priority = (row.get("priority") or "").strip().lower()
        if not title or not description or priority not in valid:
            raise RuntimeError(f"Invalid priority training row at CSV line {row_number}.")
        cleaned.append({"title": title, "description": description, "priority": priority})
    if {row["priority"] for row in cleaned} != valid:
        raise RuntimeError("Priority training dataset must contain normal, high and critical examples.")
    return cleaned


def _build_model() -> Pipeline:
    return Pipeline(
        [
            ("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True, strip_accents="unicode")),
            ("classifier", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
        ]
    )


@dataclass(frozen=True)
class PriorityResult:
    priority: str
    confidence: float
    method: str
    explanation: str
    matched_rules: list[str]
    requires_manual_review: bool
    model_version: str


class PriorityPredictor:
    def __init__(self) -> None:
        self.rows = _load_rows()
        self.training_samples = len(self.rows)
        texts = [f"{row['title']}. {row['description']}" for row in self.rows]
        labels = [row["priority"] for row in self.rows]
        self.model = _build_model()
        self.model.fit(texts, labels)

    @staticmethod
    def _matched_rules(text: str) -> list[str]:
        normalized = " ".join(text.lower().split())
        matched: list[str] = []
        for rule_name, phrases in CRITICAL_RULES:
            for phrase in phrases:
                for match in re.finditer(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", normalized):
                    prefix = normalized[max(0, match.start() - 48):match.start()]
                    if _NEGATION.search(prefix):
                        continue
                    matched.append(rule_name)
                    break
                if rule_name in matched:
                    break
        return matched

    def predict(self, title: str, description: str) -> PriorityResult:
        title = " ".join(title.split())
        description = " ".join(description.split())
        if len(title) < 3 or len(description) < 5:
            raise ValueError("A title (at least 3 characters) and description (at least 5 characters) are required.")

        text = f"{title}. {description}"
        probabilities = self.model.predict_proba([text])[0]
        classes = self.model.classes_
        index = int(probabilities.argmax())
        confidence = float(probabilities[index])
        matched = self._matched_rules(text)

        if matched:
            return PriorityResult(
                priority="critical",
                confidence=1.0,
                method="safety_rule_override",
                explanation="Potential critical safety language detected: " + ", ".join(matched) + ". Admin review is still required to confirm the incident.",
                matched_rules=matched,
                requires_manual_review=True,
                model_version=MODEL_VERSION,
            )

        requires_review = confidence < 0.55
        explanation = (
            "Priority estimated using the trained baseline model. "
            "Low confidence; admin review is required."
            if requires_review
            else "Priority estimated from the complaint title and description using the trained baseline model."
        )

        return PriorityResult(
            priority=str(classes[index]),
            confidence=round(confidence, 4),
            method="tfidf_logistic_regression",
            explanation=explanation,
            matched_rules=[],
            requires_manual_review=requires_review,
            model_version=MODEL_VERSION,
        )

    def evaluate(self) -> dict[str, Any]:
        texts = [f"{row['title']}. {row['description']}" for row in self.rows]
        labels = [row["priority"] for row in self.rows]
        x_train, x_test, y_train, y_test = train_test_split(
            texts,
            labels,
            test_size=0.2,
            random_state=42,
            stratify=labels,
        )
        evaluation_model = _build_model()
        evaluation_model.fit(x_train, y_train)
        predictions = evaluation_model.predict(x_test)
        return {
            "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
            "macro_f1": round(float(f1_score(y_test, predictions, average="macro", zero_division=0)), 4),
            "training_samples": len(x_train),
            "test_samples": len(x_test),
            "dataset_version": DATASET_VERSION,
            "model_version": MODEL_VERSION,
        }


@lru_cache(maxsize=1)
def get_priority_predictor() -> PriorityPredictor:
    return PriorityPredictor()
