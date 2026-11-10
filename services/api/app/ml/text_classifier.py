from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

MODEL_VERSION = "text-classifier-v1.2.0"
CONFIDENCE_THRESHOLD = 0.55
DATASET_VERSION = "complaints-seed-v2"
CATEGORY_LABELS = (
    "Electrical",
    "Plumbing",
    "IT & Network",
    "Cleanliness",
    "Classroom & Facilities",
    "Hostel",
    "Security",
    "Transport",
    "General",
)


def _dataset_path() -> Path:
    return Path(__file__).resolve().parents[4] / "ml" / "data" / "complaints_seed.csv"


def _load_rows() -> list[dict[str, str]]:
    path = _dataset_path()
    if not path.exists():
        raise RuntimeError(f"ML training dataset is missing: {path}")
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    required = {"title", "description", "category"}
    if not rows or not required.issubset(rows[0]):
        raise RuntimeError("ML training dataset is empty or missing required columns.")

    cleaned: list[dict[str, str]] = []
    for row_number, row in enumerate(rows, start=2):
        title = " ".join((row.get("title") or "").split())
        description = " ".join((row.get("description") or "").split())
        category = (row.get("category") or "").strip()
        if not title or not description or category not in CATEGORY_LABELS:
            raise RuntimeError(f"Invalid ML training row at CSV line {row_number}.")
        cleaned.append({"title": title, "description": description, "category": category})

    if len({row["category"] for row in cleaned}) != len(CATEGORY_LABELS):
        raise RuntimeError("ML training dataset must contain all nine complaint categories.")
    return cleaned


def _build_model() -> Pipeline:
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    strip_accents="unicode",
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


@dataclass(frozen=True)
class ClassificationResult:
    category: str
    confidence: float
    low_confidence: bool
    model_version: str


class TextClassifier:
    def __init__(self) -> None:
        self.rows = _load_rows()
        self.training_samples = len(self.rows)
        texts = [f"{row['title']}. {row['description']}" for row in self.rows]
        labels = [row["category"] for row in self.rows]
        # Train the serving model on every labelled seed example. Evaluation below
        # uses a separate model so it can never replace the live inference model.
        self.model = _build_model()
        self.model.fit(texts, labels)

    def predict(self, title: str, description: str) -> ClassificationResult:
        title = " ".join(title.split())
        description = " ".join(description.split())
        if len(title) < 3 or len(description) < 5:
            raise ValueError("A title (at least 3 characters) and description (at least 5 characters) are required.")

        text = f"{title}. {description}"
        probabilities = self.model.predict_proba([text])[0]
        classes = self.model.classes_
        index = int(probabilities.argmax())
        confidence = float(probabilities[index])
        return ClassificationResult(
            category=str(classes[index]),
            confidence=round(confidence, 4),
            low_confidence=confidence < CONFIDENCE_THRESHOLD,
            model_version=MODEL_VERSION,
        )

    def evaluate(self) -> dict[str, Any]:
        texts = [f"{row['title']}. {row['description']}" for row in self.rows]
        labels = [row["category"] for row in self.rows]
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
def get_text_classifier() -> TextClassifier:
    return TextClassifier()
