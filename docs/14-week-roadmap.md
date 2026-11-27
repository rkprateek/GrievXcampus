# GrievX Campus — 14-Week Roadmap

## Week 1 — Requirements and project foundation
Requirements, roles, architecture, repository structure, environment configuration, documentation, initial application shells, and local infrastructure plan.

## Week 2 — Backend and database foundation
FastAPI structure, PostgreSQL connection, SQLAlchemy models, Alembic, common error handling, configuration, health checks, and test foundation.

## Week 3 — Authentication and role management
Student, Staff, Department Head, and Admin roles; registration/login; JWT; password hashing; current-user endpoint; RBAC; protected routes; authentication tests.

## Week 4 — Student complaint submission
Complaint creation, description, image upload, campus location, complaint ID, complaint details/history, object storage, validation, mobile submission UI, and tests.

## Week 5 — Admin complaint management
Dashboard overview, complaint queue, search/filter/sort, details, student information permissions, location, department/staff assignment, manual priority/status controls, responsive admin UI, and authorization tests.

## Week 6 — Complaint lifecycle and notifications
Status history, lifecycle transitions, notification database, notification APIs, student timeline/notifications, admin state updates, realtime updates, and tests.

## Week 7 — Text classification
Dataset preparation, preprocessing, baseline model, category classification, evaluation, model versioning, inference service, API integration, and tests.

## Week 8 — Priority prediction
Priority labels/rules for dataset creation, baseline model, evaluation, explainable prediction output, inference integration, and tests.

## Week 9 — Department routing
Department mapping, routing logic based on text classification and project department data, confidence handling, inference integration, and tests.

## Week 10 — ML integration, duplicate detection, and operational workflow
Connect classification, priority and routing to complaint submission; persist predictions; automatically route confident predictions to their mapped departments; route uncertain or unavailable predictions to General; expose results to authorized users.

Add duplicate complaint detection with title/description similarity, campus location and recency checks. Show a possible-duplicate warning and allow an explicit submit-anyway path. Duplicate detection is an application feature, not an additional ML capability.

## Week 11 — Analytics and reporting
Operational dashboard metrics, complaint trends, category/priority/department summaries, filters, export/report support, and tests.

## Week 12 — Department portal and operational views
Department-head login, department-scoped complaint inbox, complaint status updates, staff-to-department membership, and department activity in the main administrator dashboard. No campus heatmap is in scope.

## Week 13 — Security, performance, deployment, and reliability
Security review, validation hardening, rate limits where appropriate, logging/auditing, performance checks, production configuration, deployment, backups, and monitoring.

## Week 14 — Integration, testing, documentation, and final presentation
End-to-end testing, bug fixing, final UI polish, documentation, architecture diagrams, demo data, final report, presentation, and project handover.

## Implementation checkpoint
- Weeks 1–9: foundational application, lifecycle, ML models and department routing implemented.
- Weeks 10–12: workflow integration, duplicate detection, upvotes, analytics, department portal and department activity view implemented in code.
- Automatic routing and prediction persistence migration must be applied and verified in the target Supabase project.
- Runtime verification remains required before features are marked fully tested.
- Campus heatmap is explicitly out of scope.

## Rule
A later week must not be considered complete until implementation has been tested and reviewed.
