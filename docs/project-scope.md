# Project Scope

## Users

### Student
- Register and log in.
- Submit a complaint with title, description, optional photo and manual campus location.
- View complaint details and history.
- Receive notifications.
- Review possible duplicate complaints before submitting a new one.

### Staff
- Sign in to the department workspace.
- View complaints assigned to their account within the permitted department scope.
- Update permitted complaint lifecycle state.

### Department Head
- Sign in to the department portal using a separate portal entry point.
- View complaints automatically routed to the department assigned to their profile.
- Manage department-level complaint work and update permitted complaint states.
- Monitor pending, in-progress and resolved complaints.

### Admin
- Manage campus-wide complaint operations.
- Assign staff and department heads to existing departments.
- Monitor all complaints and department activity from the main admin dashboard.
- Correct exceptional routing decisions when needed.
- View operational analytics and reports.

## Core complaint flow

SUBMITTED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED

A REJECTED path may exist where justified by requirements and must be controlled by authorization and transition rules.

## Automatic complaint routing

Every submitted complaint must receive an automatic department destination:
- Confident category predictions route to the mapped existing department.
- Uncertain, unknown or unavailable ML predictions route automatically to the General department.
- Routine complaints do not wait for administrator approval.
- Administrators can monitor routing and correct exceptional cases, but intervention is not part of the normal submission flow.
- Category, priority, department, confidence and model metadata are persisted for audit and reporting.

## Duplicate complaint detection

Duplicate detection happens during complaint submission, before a new complaint is permanently created.

The detector considers title similarity, description similarity, normalized campus location, recency and optionally category/department. A possible duplicate is a warning, not automatic deletion. The student can review the existing complaint and submit anyway if it is a different issue.

Duplicate detection is an application feature and is not part of the three-model ML scope.

## Core ML scope

Only three ML capabilities are planned:
- Text classification
- Priority prediction
- Department routing

The models expose confidence and evaluation information. Critical safety phrases use explicit safety overrides. Low-confidence routing uses the automatic General fallback; it does not block complaint submission.

## Explicit non-goals

- No campus issue heatmap.
- No image classification or image object detection requirement.
- No generic chatbot requirement.
- No fourth ML model for duplicate detection.
- No unsupported accuracy claims.
