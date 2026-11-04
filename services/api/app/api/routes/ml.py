from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.ml.priority_predictor import DATASET_VERSION as PRIORITY_DATASET_VERSION
from app.ml.priority_predictor import MODEL_VERSION as PRIORITY_MODEL_VERSION
from app.ml.priority_predictor import get_priority_predictor
from app.ml.department_router import ROUTER_VERSION, get_department_router
from app.ml.text_classifier import DATASET_VERSION, MODEL_VERSION, get_text_classifier

router = APIRouter(prefix="/ml", tags=["ml"])


class ComplaintTextRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=5, max_length=5000)

    @field_validator("title", "description")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("This field cannot be blank.")
        return normalized


@router.get("/health")
def ml_health() -> dict:
    classifier = get_text_classifier()
    priority = get_priority_predictor()
    return {
        "status": "ok",
        "dataset": DATASET_VERSION,
        "training_samples": classifier.training_samples,
        "models": {
            "category": MODEL_VERSION,
            "priority": PRIORITY_MODEL_VERSION,
            "department_router": ROUTER_VERSION,
        },
        "image_analysis": False,
    }


@router.post("/classify")
def classify_complaint(payload: ComplaintTextRequest) -> dict:
    result = get_text_classifier().predict(payload.title, payload.description)
    return result.__dict__


@router.post("/priority")
def predict_priority(payload: ComplaintTextRequest) -> dict:
    result = get_priority_predictor().predict(payload.title, payload.description)
    return result.__dict__


@router.post("/predict")
def predict_complaint(payload: ComplaintTextRequest) -> dict:
    category = get_text_classifier().predict(payload.title, payload.description)
    priority = get_priority_predictor().predict(payload.title, payload.description)
    routing = get_department_router().route_prediction(category)
    return {
        "category": category.__dict__,
        "priority": priority.__dict__,
        "routing": routing.__dict__,
    }


@router.post("/route")
def route_complaint(payload: ComplaintTextRequest) -> dict:
    result = get_department_router().route(payload.title, payload.description)
    return result.__dict__
