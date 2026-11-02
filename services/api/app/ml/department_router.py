from __future__ import annotations

from dataclasses import dataclass

from app.ml.text_classifier import CONFIDENCE_THRESHOLD, ClassificationResult, get_text_classifier

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
    def __init__(self) -> None:
        self.classifier = get_text_classifier()

    def route(self, title: str, description: str) -> RoutingResult:
        prediction: ClassificationResult = self.classifier.predict(title, description)

        if prediction.low_confidence or prediction.confidence < CONFIDENCE_THRESHOLD:
            fallback = CATEGORY_TO_DEPARTMENT["General"]
            return RoutingResult(
                category=prediction.category,
                category_confidence=prediction.confidence,
                department=fallback["name"],
                department_code=fallback["code"],
                routing_confidence=prediction.confidence,
                requires_manual_review=True,
                reason="Classification confidence is below the routing threshold; routed to General for admin review.",
                model_version=prediction.model_version,
            )

        department = CATEGORY_TO_DEPARTMENT.get(
            prediction.category,
            CATEGORY_TO_DEPARTMENT["General"],
        )
        return RoutingResult(
            category=prediction.category,
            category_confidence=prediction.confidence,
            department=department["name"],
            department_code=department["code"],
            routing_confidence=prediction.confidence,
            requires_manual_review=False,
            reason="Department selected from the predicted complaint category using the project department mapping.",
            model_version=prediction.model_version,
        )


_router = DepartmentRouter()


def get_department_router() -> DepartmentRouter:
    return _router
