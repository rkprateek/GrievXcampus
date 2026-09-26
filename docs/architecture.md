# Architecture

## High-level architecture

Student Mobile App → FastAPI API → PostgreSQL

Admin Web App → FastAPI API → PostgreSQL

FastAPI also integrates with:

- Redis for caching/realtime support where required.
- MinIO/S3-compatible object storage for complaint images.
- ML inference services/modules for classification, priority, and routing.

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

- Clear separation between presentation, API, domain logic, persistence, and ML.
- Role-based authorization at the API boundary.
- Environment-based configuration.
- Automated tests for business-critical behavior.
- No dependency on undocumented manual state.
