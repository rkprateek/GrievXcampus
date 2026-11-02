from dataclasses import dataclass
from typing import Literal

Category = Literal[
    "Electrical",
    "Plumbing",
    "IT & Network",
    "Cleanliness",
    "Classroom & Facilities",
    "Hostel",
    "Security",
    "Transport",
    "General",
]

CATEGORY_TO_DEPARTMENT = {
    "Electrical": "ELEC",
    "Plumbing": "PLMB",
    "IT & Network": "IT",
    "Cleanliness": "CLEAN",
    "Classroom & Facilities": "FAC",
    "Hostel": "HOSTEL",
    "Security": "SEC",
    "Transport": "TRANS",
    "General": "GEN",
}


@dataclass(frozen=True)
class DepartmentRouteResult:
    department_code: str
    confidence: float
    method: str
    explanation: str
    model_version: str


def route_category(category: str, category_confidence: float) -> DepartmentRouteResult:
    confidence = round(max(0.0, min(1.0, category_confidence)), 4)
    code = CATEGORY_TO_DEPARTMENT.get(category, "GEN")

    if category in CATEGORY_TO_DEPARTMENT and confidence >= 0.55:
        return DepartmentRouteResult(
            department_code=code,
            confidence=confidence,
            method="category-mapping",
            explanation=f"The {category} complaint category maps to department {code}.",
            model_version="department-router-v1.0.0",
        )

    return DepartmentRouteResult(
        department_code="GEN",
        confidence=0.50,
        method="fallback",
        explanation="The category is unknown or low-confidence, so the complaint is routed to General for manual review.",
        model_version="department-router-v1.0.0",
    )
