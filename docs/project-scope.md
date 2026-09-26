# Project Scope

## Users

### Student
- Register and log in.
- Submit a complaint.
- Add a description.
- Add a photo.
- Provide campus location.
- View complaint details and history.
- Receive notifications.

### Staff
- View complaints within the permitted department/assignment scope.
- Work on assigned complaints.
- Update permitted complaint state.

### Department Head
- View complaints within the permitted department scope.
- Manage department-level operational work.

### Admin
- Manage campus-wide complaint operations.
- Assign departments and staff.
- Manage complaint state and priority.
- View operational analytics.

## Core complaint flow

SUBMITTED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED

A REJECTED path may exist where justified by the requirements and must be controlled by authorization and transition rules.

## ML scope

Only three ML capabilities are planned:

- Text classification
- Priority prediction
- Department routing

The ML system must expose confidence/evaluation information where appropriate and should support a safe fallback when a prediction is uncertain.

## Explicit non-goals for the initial ML scope

- No image classification requirement.
- No image object detection requirement.
- No generic chatbot requirement.
- No unsupported accuracy claims.
