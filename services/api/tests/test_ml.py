from fastapi.testclient import TestClient

from app.main import app
from app.ml.priority_predictor import get_priority_predictor
from app.ml.text_classifier import get_text_classifier


def test_text_classification_endpoint() -> None:
    client = TestClient(app)
    response = client.post(
        "/ml/classify",
        json={
            "title": "Wi-Fi is slow in lab",
            "description": "The internet connection is very slow in Lab 304.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] in {
        "Electrical",
        "Plumbing",
        "IT & Network",
        "Cleanliness",
        "Classroom & Facilities",
        "Hostel",
        "Security",
        "Transport",
        "General",
    }
    assert 0 <= payload["confidence"] <= 1
    assert payload["model_version"] == "text-classifier-v1.1.0"


def test_priority_safety_override() -> None:
    client = TestClient(app)
    response = client.post(
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


def test_combined_prediction_endpoint() -> None:
    client = TestClient(app)
    response = client.post(
        "/ml/predict",
        json={
            "title": "Broken classroom chair",
            "description": "Several chairs in Room 105 are broken.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert "category" in payload
    assert "priority" in payload
    assert payload["category"]["model_version"] == "text-classifier-v1.0.0"
    assert payload["priority"]["model_version"] == "priority-predictor-v1.1.0"
    assert "routing" in payload
    assert payload["routing"]["department_code"] in {"ELEC", "PLMB", "IT", "CLEAN", "FAC", "HOSTEL", "SEC", "TRANS", "GEN"}


def test_model_evaluation_returns_metrics() -> None:
    classifier_metrics = get_text_classifier().evaluate()
    priority_metrics = get_priority_predictor().evaluate()

    for metrics in (classifier_metrics, priority_metrics):
        assert 0 <= metrics["accuracy"] <= 1
        assert 0 <= metrics["macro_f1"] <= 1


def test_department_route_endpoint() -> None:
    client = TestClient(app)
    response = client.post(
        "/ml/route",
        json={
            "title": "Wi-Fi is slow in lab",
            "description": "The internet connection is very slow in Lab 304.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["department_code"] in {"IT", "GEN"}



def test_classroom_fan_routes_to_facilities() -> None:
    client = TestClient(app)
    response = client.post("/ml/predict", json={
        "title": "Fan not working",
        "description": "The fan is not working in classroom 201.",
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"]["category"] == "Classroom & Facilities"
    assert payload["routing"]["department_code"] == "FAC"


def test_hostel_fan_routes_to_hostel() -> None:
    client = TestClient(app)
    response = client.post("/ml/predict", json={
        "title": "Hostel fan not working",
        "description": "The fan in my hostel room has stopped working.",
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"]["category"] == "Hostel"
    assert payload["routing"]["department_code"] == "HOSTEL"


def test_fire_and_gas_leak_are_critical() -> None:
    client = TestClient(app)
    for title, description in [
        ("Fire near electrical panel", "There is a fire and smoke near the electrical panel."),
        ("Gas leak", "There is a gas leak and strong gas smell in the building."),
    ]:
        response = client.post("/ml/priority", json={"title": title, "description": description})
        assert response.status_code == 200
        assert response.json()["priority"] == "critical"


def test_unknown_category_routes_to_general_without_approval() -> None:
    from app.ml.department_router import route_category

    result = route_category("Unrecognized category", 0.12)
    assert result.department_code == "GEN"
    assert result.method == "fallback"
    assert "automatically routed" in result.explanation
