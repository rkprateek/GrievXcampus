# Database Design — Week 1 Plan

## Core entities

- users
- roles
- departments
- complaints
- complaint_images
- complaint_status_history
- staff_assignments
- notifications
- model_versions
- ai_predictions

## Duplicate detection data

Duplicate checking should not create a new complaint. The implementation may persist a compact audit/check record if needed for traceability.

Potential fields:
- new complaint/request reference
- candidate complaint ID
- similarity score
- detection threshold/version
- result
- created timestamp

The exact schema will be finalized in Week 2 after the API/domain boundaries are reviewed.

## Complaint fields planned

- complaint ID
- student/user ID
- title
- description
- location
- status
- priority
- department
- timestamps

No Week 2 database implementation is included in this document.
