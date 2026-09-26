# Requirements

## Functional requirements

### Student
- Register and authenticate.
- Submit a complaint with title, description and campus location.
- Optionally attach an image.
- View complaint details, history and status.
- Receive notifications.
- Review possible duplicate complaints before submitting a new complaint.

### Staff
- View complaints within authorized scope.
- Work on assigned complaints.
- Update permitted complaint states.

### Department Head
- View and manage complaints within the department scope.

### Admin
- Manage campus-wide complaint operations.
- Assign departments and staff.
- Manage priority and status.
- View operational information.

## Complaint lifecycle

SUBMITTED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED

A controlled REJECTED path may be supported where justified.

## Duplicate detection

Before creating a new complaint, the system may compare it with relevant recent complaints using:
- title similarity;
- description similarity;
- normalized location;
- recency;
- configurable threshold.

A possible duplicate is a warning/review state. The student can inspect the existing complaint and either follow it or explicitly submit anyway.

## Non-functional requirements

- Role-based authorization at the API boundary.
- Secrets supplied through environment variables.
- Uploaded files validated and size-limited.
- Automated tests for business-critical behavior.
- Reproducible ML evaluation.
- Clear separation between UI, API, persistence, application services and ML.

## Explicit ML boundary

Only text classification, priority prediction and department routing are ML capabilities in this project. Duplicate detection must not be represented as a fourth ML model.
