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

MODEL_VERSION = "priority-predictor-v1.0.0"
DATASET_VERSION = "complaints-seed-v1"

CRITICAL_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("electrical_safety", ("electric shock", "sparking", "sparks", "burning smell", "smoke", "exposed electrical wire")),
    ("water_emergency", ("flooding", "flooded", "pipe has burst", "sewage overflow", "sewage water")),
    ("security_threat", ("intruder", "suspicious person", "serious security threat", "unauthorized entry")),
    ("transport_safety", ("brake problem", "serious brake", "transport safety")),
    ("structural_hazard", ("collapsed", "shattered", "emergency evacuation", "dangerous obstacle")),
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
    def _train() -> Pipeline:
        rows = _load_rows()
        texts = [f"{row['title']}. {row['description']}" for row in rows]
        labels = [row["priority"] for row in rows]
        x_train, _, y_train, _ = train_test_split(
            texts,
            labels,
            test_size=0.2,
            random_state=42,
            stratify=labels,
        )
        model = Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        lowercase=True,
                        ngram_range=(1, 2),
                        sublinear_tf=True,
                    ),
                ),
                (
                    "classifier",
                    LogisticRegression(
                        max_iter=2000,
                        class_weight="balanced",
                        random_state=42,
                    ),
                ),
            ]
        )
        model.fit(x_train, y_train)
        return model

    @staticmethod
    def _matched_rules(text: str) -> list[str]:
        normalized = text.lower()
        return [name for name, terms in CRITICAL_RULES if any(term in normalized for term in terms)]

    def predict(self, title: str, description: str) -> PriorityResult:
        text = f"{title.strip()}. {description.strip()}"
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
                explanation="Critical safety language detected: " + ", ".join(matched) + ".",
                matched_rules=matched,
                model_version=MODEL_VERSION,
            )

        return PriorityResult(
            priority=str(classes[index]),
            confidence=round(confidence, 4),
            method="tfidf_logistic_regression",
            explanation="Priority predicted from the complaint title and description using the trained baseline model.",
            matched_rules=[],
            model_version=MODEL_VERSION,
        )

    def evaluate(self) -> dict[str, float]:
        rows = _load_rows()
        texts = [f"{row['title']}. {row['description']}" for row in rows]
        labels = [row["priority"] for row in rows]
        x_train, x_test, y_train, y_test = train_test_split(
            texts,
            labels,
            test_size=0.2,
            random_state=42,
            stratify=labels,
        )
        self.model.fit(x_train, y_train)
        predictions = self.model.predict(x_test)
        return {
            "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
            "macro_f1": round(float(f1_score(y_test, predictions, average="macro")), 4),
        }


@lru_cache(maxsize=1)
def get_priority_predictor() -> PriorityPredictor:
    return PriorityPredictor()
