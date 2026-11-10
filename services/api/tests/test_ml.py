from fastapi.testclient import TestClient

from app.main import app
from app.ml.department_router import DepartmentRouter
from app.ml.priority_predictor import get_priority_predictor
from app.ml.text_classifier import (
    CONFIDENCE_THRESHOLD,
    ClassificationResult,
    get_text_classifier,
)


def test_ml_health_reports_loaded_models_and_dataset() -> None:
    response = TestClient(app).get("/ml/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["training_samples"] >= 45
    assert payload["image_analysis"] is False
    assert "category" in payload["models"]
    assert "priority" in payload["models"]


def test_ml_metrics_endpoint_reports_seed_evaluation() -> None:
    response = TestClient(app).get("/ml/metrics")
    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset"] == "complaints-seed-v2"
    assert 0 <= payload["category"]["accuracy"] <= 1
    assert 0 <= payload["priority"]["macro_f1"] <= 1
    assert "not production" in payload["note"]


def test_text_classification_endpoint() -> None:
    response = TestClient(app).post(
        "/ml/classify",
        json={
            "title": "Wi-Fi is slow in lab",
            "description": "The internet connection is very slow in Lab 304.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] == "IT & Network"
    assert 0 <= payload["confidence"] <= 1
    assert payload["model_version"] == "text-classifier-v1.2.0"


def test_blank_or_whitespace_complaint_text_is_rejected() -> None:
    response = TestClient(app).post(
        "/ml/predict",
        json={"title": "   ", "description": "      "},
    )
    assert response.status_code == 422


def test_priority_safety_override() -> None:
    response = TestClient(app).post(
        "/ml/priority",
        json={
            "title": "Electric shock from tap",
            "description": "Students are getting an electric shock from the metal water tap.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["priority"] == "critical"
    assert payload["method"] == "safety_rule_override"
    assert payload["matched_rules"]


def test_negated_safety_language_does_not_trigger_that_rule() -> None:
    predictor = get_priority_predictor()
    assert predictor._matched_rules(
        "No electric shock, no sparks and no smoke were reported."
    ) == []


def test_combined_prediction_endpoint_reuses_category_prediction() -> None:
    response = TestClient(app).post(
        "/ml/predict",
        json={
            "title": "Broken classroom chair",
            "description": "Several chairs in Room 105 are broken.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"]["model_version"] == "text-classifier-v1.2.0"
    assert payload["priority"]["model_version"] == "priority-predictor-v1.2.0"
    assert payload["routing"]["category"] == payload["category"]["category"]


def test_model_evaluation_returns_metrics_without_mutating_live_model() -> None:
    classifier = get_text_classifier()
    priority = get_priority_predictor()
    classifier_before = classifier.predict(
        "Wi-Fi is slow in lab",
        "The internet connection is slow in Lab 304.",
    )
    priority_before = priority.predict(
        "Electric shock from tap",
        "Students are receiving an electric shock.",
    )

    for metrics in (classifier.evaluate(), priority.evaluate()):
        assert 0 <= metrics["accuracy"] <= 1
        assert 0 <= metrics["macro_f1"] <= 1
        assert metrics["training_samples"] > 0
        assert metrics["test_samples"] > 0

    assert classifier.predict(
        "Wi-Fi is slow in lab",
        "The internet connection is slow in Lab 304.",
    ) == classifier_before
    assert priority.predict(
        "Electric shock from tap",
        "Students are receiving an electric shock.",
    ) == priority_before


def test_low_confidence_department_routing_requires_manual_review() -> None:
    response = TestClient(app).post(
        "/ml/route",
        json={
            "title": "Wi-Fi is slow in lab",
            "description": "The internet connection is very slow in Lab 304.",
        },
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["category"] == "IT & Network"
    assert payload["category_confidence"] < CONFIDENCE_THRESHOLD
    assert payload["department"] == payload["category"]
    assert payload["department"] == "IT & Network"
    assert payload["department_code"] == "IT"
    assert payload["requires_manual_review"] is True
    assert "admin confirmation" in payload["reason"]


def test_high_confidence_prediction_routes_to_it_department() -> None:
    prediction = ClassificationResult(
        category="IT & Network",
        confidence=0.90,
        low_confidence=False,
        model_version="text-classifier-v1.2.0",
    )

    result = DepartmentRouter().route_prediction(prediction)

    assert result.category == "IT & Network"
    assert result.department == "IT & Network"
    assert result.department_code == "IT"
    assert result.requires_manual_review is False
    assert result.category_confidence == 0.90

def test_uncertain_priority_prediction_requires_manual_review() -> None:
    result = get_priority_predictor().predict(
        "Need help",
        "I am facing an issue and need assistance.",
    )

    assert result.confidence < 0.55
    assert result.requires_manual_review is True
    assert "admin review" in result.explanation.lower()


def test_safety_override_remains_critical_and_requires_review() -> None:
    result = get_priority_predictor().predict(
        "Exposed electrical wire",
        "An exposed live electrical wire is hanging near the classroom door.",
    )

    assert result.priority == "critical"
    assert result.method == "safety_rule_override"
    assert result.requires_manual_review is True
