# Weekly Report

## Week 1

### Status
Foundation completed on the week-1-foundation branch and submitted as PR #1.

### Completed
- Created the GrievX Campus repository foundation.
- Defined the 14-week development roadmap.
- Defined the architecture and technology boundaries.
- Added local PostgreSQL, Redis, and MinIO infrastructure configuration.
- Added project development and security rules.
- Added detailed requirements.
- Added roles and permissions matrix.
- Added planned API design.
- Added planned database design.
- Added student mobile and admin dashboard UI flows.
- Added application, backend and ML project shells.
- Added environment variable template.
- Documented Duplicate Detection as an application feature, separate from the three ML capabilities.

## Week 2

### Status
Implemented and locally verified in the developer environment.

### Completed
- Created the FastAPI application entry point.
- Added environment-backed application configuration with Pydantic Settings.
- Added SQLAlchemy engine/session infrastructure.
- Added the shared declarative database base and timestamp defaults.
- Added Alembic configuration and a Week 2 baseline migration.
- Added GET /health with a database connectivity check.
- Added a common application error response structure.
- Added pytest configuration and root/health API tests.
- Fixed API packaging discovery for the flat Alembic/app layout.
- Verified PostgreSQL connectivity and Alembic migration locally.

### Scope control
Week 2 intentionally did not implement complaint APIs, complaint lifecycle, notifications, ML inference, duplicate detection, analytics, map features, or deployment.

## Week 3

### Status
Implementation added on the `week-3-auth-rbac` branch. Local runtime verification is still required after syncing the branch.

### Completed
- Added users and roles SQLAlchemy models.
- Added Student, Staff, Department Head, and Admin roles.
- Added password hashing with Argon2 through pwdlib.
- Added JWT access-token creation and validation with subject, issued-at, and expiration claims.
- Added registration and login endpoints.
- Added authenticated current-user endpoint.
- Added backend role-based authorization dependency.
- Added an Admin-only RBAC verification endpoint.
- Added Alembic migration `0002_auth_rbac` with role seed data.
- Added authentication and RBAC API tests with an isolated SQLite test database.
- Verified missing, malformed, expired, and inactive token handling behavior.
- Kept complaint, ML, notification, analytics, map, deployment, and all Week 4 functionality outside Week 3 scope.

### Explicit scope note
Week 4 complaint submission and complaint-related functionality were not started in this branch.

### Security boundary
Public registration always creates a Student account. Privileged roles are not user-selectable during registration.

### Verification
The connected GitHub environment was used to inspect and modify the repository, but it does not execute the project's local Python/Docker test environment. Run the Week 3 test suite and PostgreSQL migration locally before marking Week 3 complete.

### Next
Verify Week 3 locally, then proceed to Week 4 complaint submission only after authentication and RBAC are passing.


## Week 4

### Status
Student complaint submission implementation added on the week-4-complaint-submission branch.

### Completed
- Added Complaint and ComplaintImage database models.
- Added Alembic migration 0003_complaints.
- Added student-only complaint creation.
- Added authenticated student complaint listing.
- Added authenticated student complaint detail access with ownership enforcement.
- New complaints start in SUBMITTED status.
- Added MinIO/S3-compatible image upload.
- Added image MIME-type and 5 MB size validation.
- Added complaint image metadata persistence.
- Added React Native + Expo student login/register flow using the existing Week 3 authentication API.
- Added secure JWT storage using Expo SecureStore.
- Added New Complaint, My Complaints and Complaint Details screens.
- Added image selection and preview.
- Added Week 4 backend tests for authentication, authorization, ownership, validation and image handling.
- Updated API and database documentation.

### Scope control
Week 4 intentionally did not implement admin complaint management, staff assignment, department routing, status transitions, notifications, text classification, priority prediction, duplicate detection, analytics, campus map or deployment.

### Verification
The repository changes were implemented on the week-4-complaint-submission branch. Local pytest, PostgreSQL migration and mobile npm/typecheck commands must be run in the user's VS Code environment before this week is marked fully verified.


## Week 4 — Current Supabase student demo

### Status
Supabase-backed student demo implemented on the `week-4-supabase-demo` branch and carried into the Week 5 integrated branch.

### Completed
- Student registration and login with Supabase Auth.
- Persistent authentication session with AsyncStorage.
- Student profile retrieval.
- Complaint creation directly in Supabase PostgreSQL.
- Manual campus location entry; GPS is not used.
- Complaint list and complaint details.
- Image selection, preview and upload to the private `complaint-evidence` Supabase Storage bucket.
- Complaint image metadata stored in `complaint_images`.
- Student-facing RLS for profiles, complaints and complaint images.
- Evidence signed URLs for complaint details.

### Verification
The student complaint, image upload and storage flow was verified against the connected Supabase project during development. Local Expo/Android networking still needs to be verified on the current machine when the device can reach the Supabase hostname.

## Week 5 — Integrated admin complaint management

### Status
Week 5 admin functionality has been integrated onto the current Supabase student branch as `week-5-integrated`.

### Completed
- Added Next.js + TypeScript admin dashboard.
- Added administrator authentication and role enforcement with Supabase Auth.
- Added complaint queue, search and lifecycle filters.
- Added complaint details with student information, location and evidence.
- Added complaint status updates.
- Added dashboard counts for total, new, active and resolved/closed complaints.
- Added departments and staff-assignment data model.
- Added complaint priority field foundation: normal, high and critical.
- Added staff assignment workflow.
- Added admin/staff RLS policies.
- Added profile role-escalation protection.
- Consolidated the Week 5 Supabase database changes into a single uniquely versioned migration.

### Scope control
Automated text classification, priority prediction, department routing, notifications, duplicate detection/upvoting, analytics, campus map and deployment are not implemented in Week 5.

### Verification
Run the integrated mobile and admin applications locally and complete the end-to-end student-to-admin workflow before starting Week 6.


## Week 6 — Complaint lifecycle: status history

### Status
Status-history implementation added on `week-6-lifecycle-notifications`.

### Completed
- Added `complaint_status_history` data model and indexes.
- Added RLS so students can see history only for their own complaints.
- Added staff/admin visibility through the existing staff-access policy.
- Added database trigger to automatically record the initial complaint status and every later status transition.
- Added historical backfill for existing complaints.
- Added student complaint detail timeline using persisted status history.
- Added admin complaint detail status-history display.
- Preserved status history when admin changes routing or staff assignment.

### Scope control
Notifications/realtime, text classification, priority prediction, department routing, duplicate detection/upvoting, analytics, campus map and deployment are not implemented in this step.

### Verification
The GitHub branch contains the Week 6 code and migration. The connected Supabase project is currently in `COMING_UP` state, so the Week 6 migration has not yet been applied to the live project. Database migration and end-to-end timeline verification must be completed when the project is available.


## Week 6 — Notifications and realtime

### Status
Notification infrastructure completed on `week-6-lifecycle-notifications`.

### Completed
- Added `notifications` table with complaint linkage, notification type, read state and timestamps.
- Added RLS so students can read and mark only their own notifications.
- Added automatic notification creation from complaint status history.
- New complaint submission creates a submission notification.
- Admin status changes create status-change notifications automatically.
- Added mobile APIs to fetch notifications and mark one/all as read.
- Replaced the placeholder Alerts screen with a real notification list.
- Added Supabase Realtime subscription for new notifications addressed to the signed-in student.
- Enabled the `notifications` table in the `supabase_realtime` publication.

### Verification
The live Supabase database reports:
- notification trigger exists;
- notifications Realtime is enabled;
- notification table has 0 rows before the next new complaint/status change;
- status history contains 9 existing records.

No synthetic complaint data was inserted just for testing.


## Week 7 — Text classification

### Status
Implemented on `week-7-8-ml`.

### Completed
- Added a curated 54-example campus complaint seed dataset covering the nine project categories.
- Added TF-IDF unigram/bigram preprocessing.
- Added Logistic Regression category baseline with class balancing.
- Added stratified 80/20 evaluation with fixed random seed.
- Added model version `text-classifier-v1.0.0` and registry metadata.
- Added confidence and low-confidence output.
- Added FastAPI inference endpoints `POST /ml/classify` and `POST /ml/predict`.
- Added automated API and evaluation tests.

### Scope control
This is a reproducible baseline using the curated development dataset. Production training on institutional complaint data and end-to-end workflow integration remain later tasks.

## Week 8 — Priority prediction

### Status
Implemented on `week-7-8-ml`.

### Completed
- Added TF-IDF + Logistic Regression baseline for normal/high/critical priority.
- Added model version `priority-predictor-v1.0.0` and registry metadata.
- Added explainable safety-rule override for critical hazards.
- Added confidence, explanation, method and matched-rule output.
- Added FastAPI inference endpoint `POST /ml/priority` and combined `POST /ml/predict`.
- Added automated priority and combined-prediction tests.

### Scope control
Priority prediction is standalone in Week 8. Complaint submission is not automatically calling the model yet; that integration belongs to the later ML workflow stage.

### Verification
Run the FastAPI test suite and `python -m services.api.app.ml.train_models` in the local environment before treating the model metrics as verified for the project report.
