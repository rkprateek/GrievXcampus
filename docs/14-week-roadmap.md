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
Status history, lifecycle transitions, notification database, notification APIs, student timeline/notifications, admin state updates, WebSocket-based realtime updates, and tests.

## Week 7 — Text classification
Dataset preparation, preprocessing, baseline model, category classification, evaluation, model versioning, inference service, API integration, and tests.

## Week 8 — Priority prediction
Priority labels/rules for dataset creation, baseline model, evaluation, explainable prediction output, inference integration, and tests.

## Week 9 — Department routing
Department mapping, routing model/logic based on text classification and project data, confidence handling, inference integration, and tests.

## Week 10 — ML integration, duplicate detection, and operational workflow
Connect classification, priority, and routing to the complaint workflow; persist predictions; expose results to authorized staff; handle low-confidence cases safely.

Add **duplicate complaint detection** to the submission workflow:
- compare a new complaint with recent relevant complaints;
- compare title and description similarity;
- require matching/near-matching campus location as an important signal;
- use a configurable threshold rather than a hard-coded decision;
- return possible duplicate complaint IDs and similarity information;
- let the student review the existing complaint before creating another record;
- allow an explicit “submit anyway” path when the student confirms it is a different issue;
- prevent duplicate detection from blocking legitimate unrelated complaints;
- add backend and mobile tests for the example hostel leakage scenario.

Duplicate detection is an application feature, not an additional ML capability. It must not be presented as a fourth ML model.

## Week 11 — Analytics and reporting
Operational dashboard metrics, complaint trends, category/priority/department summaries, filters, export/report support, and tests.

## Week 12 — Campus map and operational views
Complaint locations, map/heatmap views, privacy-aware location display, filtering, and responsive UI.

## Week 13 — Security, performance, deployment, and reliability
Security review, validation hardening, rate limits where appropriate, logging/auditing, performance checks, production configuration, deployment, backups, and monitoring.

## Week 14 — Integration, testing, documentation, and final presentation
End-to-end testing, bug fixing, final UI polish, documentation, architecture diagrams, demo data, final report, presentation, and project handover.

## Rule

A later week must not be started until the current week's implementation has been tested and reviewed.
