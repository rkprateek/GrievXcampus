# Database Design

## Implemented through Week 4

### users
Authentication identity and role assignment.

### roles
Student, Staff, Department Head and Admin roles.

### complaints

| Field | Type | Purpose |
|---|---|---|
| id | UUID | Complaint identifier |
| student_id | UUID | Authenticated student who submitted it |
| title | VARCHAR(150) | Short complaint title |
| description | TEXT | Complaint details |
| location | VARCHAR(255) | Campus location |
| status | VARCHAR(30) | Initial value is submitted |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

student_id references users.id.

### complaint_images

| Field | Type | Purpose |
|---|---|---|
| id | UUID | Image record identifier |
| complaint_id | UUID | Parent complaint |
| object_key | VARCHAR(500) | MinIO/S3 object key |
| original_filename | VARCHAR(255) | Original upload name |
| content_type | VARCHAR(100) | Validated image MIME type |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

Binary image data is not stored in PostgreSQL.

## Planned entities

- departments
- complaint_status_history
- staff_assignments
- notifications
- model_versions
- ai_predictions

These are implemented in later roadmap weeks.

Priority and department are intentionally not implemented in Week 4.
