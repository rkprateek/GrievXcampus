# GrievX Campus API

FastAPI backend for the GrievX Campus project.

## Week 4 — Student complaint submission

Implemented:
- Complaint and complaint-image SQLAlchemy models.
- Student-only complaint creation.
- Authenticated student complaint listing.
- Authenticated student complaint detail access with ownership enforcement.
- Initial complaint status: submitted.
- Image upload to MinIO/S3-compatible object storage.
- JPEG, PNG and WebP validation.
- 5 MB image size limit.
- Complaint ownership checks before image upload.
- Alembic migration 0003_complaints.

## Week 4 endpoints

POST /complaints
- Requires an authenticated Student.
- Accepts title, description and location.
- The student ID is taken from the authenticated JWT.
- New complaints always start with submitted status.

GET /complaints
- Returns only complaints belonging to the authenticated Student.

GET /complaints/{complaint_id}
- Returns a complaint only when it belongs to the authenticated Student.

POST /complaints/{complaint_id}/images
- Multipart upload using field name file.
- Accepted types: image/jpeg, image/png, image/webp.
- Maximum size: 5 MB.
- Binary data is stored in MinIO/S3-compatible storage.
- PostgreSQL stores image metadata and the object key.

## Local setup

From the repository root:

    docker compose up -d postgres redis minio

Then:

    cd services/api
    pip install -e ".[test]"
    alembic upgrade head
    pytest

Default local object storage:
- Endpoint: http://localhost:9000
- Bucket: grievx
- Access key: grievx
- Secret key: grievx_dev_password

Override these values with environment variables before production use.

## Scope boundary

Week 4 does not implement admin complaint management, staff assignment, department routing, status transitions, notifications, text classification, priority prediction, duplicate detection, analytics, campus map or deployment.
