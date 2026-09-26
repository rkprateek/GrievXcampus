from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.complaint import ComplaintStatus


class ComplaintCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=5, max_length=5000)
    location: str = Field(min_length=2, max_length=255)

    @field_validator("title", "description", "location")
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value


class ComplaintImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    object_key: str
    original_filename: str
    content_type: str
    created_at: datetime


class ComplaintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: UUID
    title: str
    description: str
    location: str
    status: ComplaintStatus
    created_at: datetime
    updated_at: datetime
    images: list[ComplaintImageResponse] = Field(default_factory=list)


class ComplaintImageUploadResponse(BaseModel):
    id: UUID
    complaint_id: UUID
    object_key: str
    original_filename: str
    content_type: str
    created_at: datetime
