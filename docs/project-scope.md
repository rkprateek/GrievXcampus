# Project Scope

## Users

### Student
- Register and log in.
- Submit a complaint.
- Add a title and description.
- Add a photo.
- Provide campus location.
- View complaint details and history.
- Receive notifications.
- Review a possible duplicate complaint before submitting a new one.

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
- Review duplicate-detection activity where needed.

## Core complaint flow

SUBMITTED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED

A REJECTED path may exist where justified by the requirements and must be controlled by authorization and transition rules.

## Duplicate complaint detection

Duplicate detection happens during complaint submission, before a new complaint is permanently created.

### Signals

The detector should consider:
- title similarity;
- description similarity;
- exact or normalized campus location match;
- recency of the existing complaint;
- optionally category/department once those fields are available.

### Example

Existing complaint:

> **Title:** Water leaking from ceiling pipe  
> **Location:** Boys Hostel 1, 3rd Floor  
> **Description:** Continuous water leaking and pooling on the floor.

New complaint:

> **Title:** Ceiling pipe leakage in hostel  
> **Location:** Boys Hostel 1, 3rd Floor  
> **Description:** Water dripping from pipe on the 3rd floor.

Expected result:

- The new complaint is flagged as a **possible duplicate**.
- The existing complaint is shown to the student.
- The student can open/follow the existing complaint.
- The student can choose to submit anyway if they confirm it is a different issue.
- The backend records the duplicate-check result for audit/debugging without exposing unnecessary internal details to the student.

### Important behavior

A possible duplicate is a warning/review state, not an automatic deletion of the new complaint. The final submission decision belongs to the student unless a future requirement explicitly changes this.

Duplicate detection is a product/application feature and is **not** part of the three-model ML scope.

## Core ML scope

Only three ML capabilities are planned:

- Text classification
- Priority prediction
- Department routing

The ML system must expose confidence/evaluation information where appropriate and should support a safe fallback when a prediction is uncertain.

## Explicit non-goals for the initial ML scope

- No image classification requirement.
- No image object detection requirement.
- No generic chatbot requirement.
- No fourth ML model for duplicate detection.
- No unsupported accuracy claims.
