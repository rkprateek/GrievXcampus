# API Design

## Health
GET /health

## Authentication
POST /auth/register
POST /auth/login
GET /auth/me

## Week 4 — Student complaints

POST /complaints
GET /complaints
GET /complaints/{complaint_id}
POST /complaints/{complaint_id}/images

### Complaint creation

Only an authenticated Student can create a complaint.

Request fields:
- title
- description
- location

The authenticated user's ID is used as student_id. Clients cannot submit an arbitrary owner ID.

New complaints start in submitted status.

### Complaint listing and detail

Students receive only their own complaints. A complaint belonging to another student is not exposed.

### Complaint images

Images use multipart form data with the file field. JPEG, PNG and WebP are accepted, with a 5 MB limit. Binary image data is stored in MinIO/S3-compatible storage; PostgreSQL stores image metadata and the storage key.

## Planned later APIs

Duplicate detection:
POST /complaints/check-duplicate

This is intentionally not implemented in Week 4.

Notifications:
GET /notifications
POST/PATCH notification read state

Lifecycle/admin endpoints for assignment, status transitions, priority updates and operational views will be implemented in later weeks.

## API principles
- Validate all request data.
- Enforce authorization server-side.
- Use consistent error responses.
- Do not leak secrets or internal errors.


## Week 7–8 — ML inference

POST /ml/classify
POST /ml/priority
POST /ml/predict

These inference endpoints accept:
- title
- description

Classification returns category, confidence, low-confidence flag and model version.
Priority prediction returns priority, confidence, method, explanation, matched safety rules and model version.
The endpoints are standalone in Weeks 7–8. Complaint submission does not call them automatically until the later ML integration stage.


## Weeks 9–10 operational ML endpoints
- `POST /ml/route`: returns department code, routing confidence, method, explanation and router model version.
- `POST /ml/predict`: returns category, priority and department-routing predictions together.
- Low-confidence category results are routed to `GEN` for manual review.
- The mobile workflow may call the FastAPI inference service using `EXPO_PUBLIC_GRIEVX_API_URL`; complaint submission remains usable when the service is unavailable.
- Persisting ML results is controlled by the Supabase `apply_complaint_ml_predictions` RPC, which only updates a complaint when the authenticated user owns it.

## Week 10 duplicate detection and community support
- Supabase RPC `find_possible_duplicates(title, description, location)` compares recent complaints using title similarity, description similarity and manual-location match.
- Duplicate detection settings are stored in `duplicate_detection_config` with configurable weights, threshold and recency window.
- `complaint_upvotes` stores one support vote per student per complaint, with an automatic complaint-level count.
