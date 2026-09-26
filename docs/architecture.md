# Architecture

## High-level architecture

Student Mobile App → FastAPI API → PostgreSQL

Admin Web App → FastAPI API → PostgreSQL

FastAPI also integrates with:

- Redis for caching/realtime support where required.
- MinIO/S3-compatible object storage for complaint images.
- ML inference services/modules for classification, priority, and routing.
- Duplicate detection service/module for comparing a new complaint against relevant existing complaints.

## Complaint submission flow

```
Student
  |
  v
Mobile App
  |
  v
POST /complaints/check-duplicate
  |
  +--> normalize title/description/location
  |
  +--> retrieve recent complaints in the same/nearby location
  |
  +--> calculate text similarity + location signal
  |
  +--> return possible duplicates
  |
  v
Student reviews result
  |
  +--> follow existing complaint
  |
  +--> submit anyway with explicit confirmation
  |
  v
POST /complaints
```

The duplicate check is advisory. It should not silently delete, merge, or modify an existing complaint.

## Duplicate detection design

The initial implementation should remain explainable and independently testable.

Suggested signals:
- normalized title similarity;
- normalized description similarity;
- exact/normalized location match;
- recency window.

A configurable threshold determines when a complaint is returned as a possible duplicate. The threshold and weights must be stored in configuration rather than scattered through application code.

Duplicate detection is intentionally separate from the three ML capabilities:
- Text classification
- Priority prediction
- Department routing

This keeps the ML scope controlled while still preventing repeated complaints about the same active issue.

## Applications

### Mobile
React Native + Expo + TypeScript.

### Admin
Next.js + TypeScript.

### API
FastAPI + Pydantic + SQLAlchemy + Alembic.

### Data
PostgreSQL.

### Storage
MinIO for local development; S3-compatible storage for production.

### ML
Python-based reproducible training and inference modules.

## Design principles

- Clear separation between presentation, API, domain logic, persistence, duplicate detection, and ML.
- Role-based authorization at the API boundary.
- Environment-based configuration.
- Automated tests for business-critical behavior.
- No dependency on undocumented manual state.
