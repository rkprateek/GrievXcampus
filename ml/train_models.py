"""Evaluate the Week 7/8 baseline models.

Run from the repository root with the API environment installed:
    python -m services.api.app.ml.train_models
"""

from services.api.app.ml.priority_predictor import get_priority_predictor
from services.api.app.ml.text_classifier import get_text_classifier


if __name__ == "__main__":
    classifier = get_text_classifier()
    priority = get_priority_predictor()
    print("Text classification:", classifier.evaluate())
    print("Priority prediction:", priority.evaluate())
