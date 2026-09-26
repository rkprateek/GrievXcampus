from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models import Complaint, ComplaintImage, ComplaintStatus, RoleName, User
from app.schemas.complaint import (
    ComplaintCreateRequest,
    ComplaintImageUploadResponse,
    ComplaintResponse,
)
from app.storage import ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, get_object_storage

router = APIRouter(prefix="/complaints", tags=["complaints"])


def _get_student_complaint(db: Session, complaint_id: UUID, student_id: UUID) -> Complaint:
    complaint = db.scalar(
        select(Complaint)
        .options(selectinload(Complaint.images))
        .where(
            Complaint.id == complaint_id,
            Complaint.student_id == student_id,
        )
    )
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return complaint


@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
def create_complaint(
    payload: ComplaintCreateRequest,
    current_user: User = Depends(require_roles(RoleName.STUDENT)),
    db: Session = Depends(get_db),
) -> Complaint:
    complaint = Complaint(
        student_id=current_user.id,
        title=payload.title,
        description=payload.description,
        location=payload.location,
        status=ComplaintStatus.SUBMITTED.value,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    complaint.images = []
    return complaint


@router.get("", response_model=list[ComplaintResponse])
def list_my_complaints(
    current_user: User = Depends(require_roles(RoleName.STUDENT)),
    db: Session = Depends(get_db),
) -> list[Complaint]:
    return list(
        db.scalars(
            select(Complaint)
            .options(selectinload(Complaint.images))
            .where(Complaint.student_id == current_user.id)
            .order_by(Complaint.created_at.desc())
        ).all()
    )


@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_my_complaint(
    complaint_id: UUID,
    current_user: User = Depends(require_roles(RoleName.STUDENT)),
    db: Session = Depends(get_db),
) -> Complaint:
    return _get_student_complaint(db, complaint_id, current_user.id)


@router.post(
    "/{complaint_id}/images",
    response_model=ComplaintImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_complaint_image(
    complaint_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(RoleName.STUDENT)),
    db: Session = Depends(get_db),
) -> ComplaintImage:
    complaint = _get_student_complaint(db, complaint_id, current_user.id)

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG, and WebP images are supported.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 5 MB size limit.")

    storage = get_object_storage()
    object_key = storage.upload_image(
        content=content,
        content_type=file.content_type,
        filename=file.filename or "image",
    )

    image = ComplaintImage(
        complaint_id=complaint.id,
        object_key=object_key,
        original_filename=(file.filename or "image")[:255],
        content_type=file.content_type,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image
