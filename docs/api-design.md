# API Design — Planned

## Health
GET /health

## Authentication
POST /auth/register
POST /auth/login
GET /auth/me

## Complaints
POST /complaints
GET /complaints
GET /complaints/{complaint_id}

## Duplicate detection
POST /complaints/check-duplicate

The duplicate-check endpoint returns a review result rather than creating a complaint.

A possible response shape is:

{
  "is_possible_duplicate": true,
  "matches": [
    {
      "complaint_id": "GX-0001",
      "similarity": 0.0
    }
  ]
}

The exact scoring representation will be finalized during implementation and must not expose internal details unnecessarily.

## Notifications
GET /notifications
POST/PATCH notification read state

## Lifecycle/admin
Authorized endpoints for assignments, status transitions, priority updates and operational views will be finalized during their implementation weeks.

## API principles
- Validate all request data.
- Enforce authorization server-side.
- Use consistent error responses.
- Do not leak secrets or internal errors.
