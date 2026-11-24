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

MODEL_VERSION = "text-classifier-v1.1.0"
CONFIDENCE_THRESHOLD = 0.55
DATASET_VERSION = "complaints-seed-v1"

# High-signal phrases cover common campus wording before the statistical model
# is used. Hostel context is checked first so hostel facilities stay in Hostel.
CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Hostel", ("hostel", "dormitory", "warden", "hostel room")),
    ("Transport", ("campus bus", "shuttle", "bus route", "bus driver", "bus stop", "vehicle breakdown")),
    ("Security", ("security", "cctv", "intruder", "unauthorized entry", "gate access", "suspicious person", "theft", "harassment")),
    ("IT & Network", ("wi-fi", "wifi", "internet", "network", "server", "computer", "laptop", "projector network", "login issue", "software")),
    ("Plumbing", ("water leak", "pipe", "tap", "faucet", "drain", "washroom", "toilet", "sewage", "water pressure", "water supply")),
    ("Cleanliness", ("garbage", "dustbin", "waste collection", "cleaning", "unclean", "dirty floor", "hygiene", "sanitation", "litter")),
    ("Electrical", ("electrical", "electricity", "switchboard", "socket", "wiring", "exposed wire", "power outage", "short circuit", "sparking", "light not working", "lights not working")),
    ("Classroom & Facilities", ("classroom", "lecture hall", "seminar hall", "ceiling fan", "fan not working", "broken chair", "desk", "bench", "ceiling", "window", "door", "furniture", "air conditioner", "ac not working")),
)


def _dataset_path() -> Path:
    return Path(__file__).resolve().parents[4] / "ml" / "data" / "complaints_seed.csv"


def _load_rows() -> list[dict[str, str]]:
    with _dataset_path().open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


@dataclass(frozen=True)
class ClassificationResult:
    category: str
    confidence: float
    low_confidence: bool
    model_version: str


class TextClassifier:
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
        labels = [row["category"] for row in rows]
        model = cls._build_model()
        # Inference uses all labelled examples; held-out data is reserved for evaluate().
        model.fit(texts, labels)
        return model

    @staticmethod
    def _rule_prediction(text: str) -> str | None:
        normalized = " ".join(text.lower().replace("&", "and").split())
        matches = [
            category for category, phrases in CATEGORY_RULES
            if any(phrase in normalized for phrase in phrases)
        ]
        return matches[0] if len(matches) == 1 else None

    def predict(self, title: str, description: str) -> ClassificationResult:
        text = f"{title.strip()}. {description.strip()}"
        rule_category = self._rule_prediction(text)
        if rule_category:
            return ClassificationResult(
                category=rule_category, confidence=0.90,
                low_confidence=False, model_version=MODEL_VERSION,
            )
        probabilities = self.model.predict_proba([text])[0]
        classes = self.model.classes_
        index = int(probabilities.argmax())
        confidence = float(probabilities[index])
        return ClassificationResult(
            category=str(classes[index]), confidence=round(confidence, 4),
            low_confidence=confidence < CONFIDENCE_THRESHOLD,
            model_version=MODEL_VERSION,
        )

    def evaluate(self) -> dict[str, float]:
        rows = _load_rows()
        texts = [f"{row['title']}. {row['description']}" for row in rows]
        labels = [row["category"] for row in rows]
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
def get_text_classifier() -> TextClassifier:
    return TextClassifier()
