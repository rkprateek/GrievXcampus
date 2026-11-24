from __future__ import annotations

from dataclasses import dataclass

from app.ml.text_classifier import (
    CONFIDENCE_THRESHOLD,
    ClassificationResult,
    get_text_classifier,
)

ROUTER_VERSION = "department-router-v1.3.0"

CATEGORY_TO_DEPARTMENT = {
    "Electrical": {"name": "Electrical", "code": "ELEC"},
    "Plumbing": {"name": "Plumbing", "code": "PLMB"},
    "IT & Network": {"name": "IT & Network", "code": "IT"},
    "Cleanliness": {"name": "Cleanliness", "code": "CLEAN"},
    "Classroom & Facilities": {"name": "Classroom & Facilities", "code": "FAC"},
    "Hostel": {"name": "Hostel", "code": "HOSTEL"},
    "Security": {"name": "Security", "code": "SEC"},
    "Transport": {"name": "Transport", "code": "TRANS"},
    "General": {"name": "General", "code": "GEN"},
}


@dataclass(frozen=True)
class RoutingResult:
    category: str
    category_confidence: float
    department: str
    department_code: str
    routing_confidence: float
    requires_manual_review: bool
    reason: str
    model_version: str


class DepartmentRouter:
    def route_prediction(self, prediction: ClassificationResult) -> RoutingResult:
        # Always preserve the classifier's best department as a suggestion.
        # Low confidence changes the approval state, not the predicted label.
        department = CATEGORY_TO_DEPARTMENT.get(
            prediction.category,
            CATEGORY_TO_DEPARTMENT["General"],
        )

        if prediction.low_confidence or prediction.confidence < CONFIDENCE_THRESHOLD:
            return RoutingResult(
                category=prediction.category,
                category_confidence=prediction.confidence,
                department=department["name"],
                department_code=department["code"],
                routing_confidence=prediction.confidence,
                requires_manual_review=True,
                reason=(
                    "Suggested department is shown for reference. "
                    "Classification confidence is below the routing threshold; "
                    "admin confirmation is required before assignment."
                ),
                model_version=ROUTER_VERSION,
            )

        return RoutingResult(
            category=prediction.category,
            category_confidence=prediction.confidence,
            department=department["name"],
            department_code=department["code"],
            routing_confidence=prediction.confidence,
            requires_manual_review=False,
            reason=(
                "Department selected from the predicted complaint category "
                "using the project department mapping."
            ),
            model_version=ROUTER_VERSION,
        )

_router = DepartmentRouter()


def get_department_router() -> DepartmentRouter:
    return _router
