from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.ml.priority_predictor import get_priority_predictor
from app.ml.department_router import get_department_router
from app.ml.text_classifier import get_text_classifier

router = APIRouter(prefix="/ml", tags=["ml"])


class ComplaintTextRequest(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=5, max_length=5000)


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
    routing = get_department_router().route(payload.title, payload.description)
    return {
        "category": category.__dict__,
        "priority": priority.__dict__,
        "routing": routing.__dict__,
    }


@router.post("/route")
def route_complaint(payload: ComplaintTextRequest) -> dict:
    result = get_department_router().route(payload.title, payload.description)
    return result.__dict__
