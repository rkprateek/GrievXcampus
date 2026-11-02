# GrievX Campus — Deployment Guide

## Recommended hosting layout

| Component | Target | Notes |
|---|---|---|
| Student mobile app | Expo EAS Build / Submit | Configure public Supabase URL/key and optional API URL at build time. |
| Admin dashboard | Vercel or Node container host | Configure the two public Supabase environment variables. |
| FastAPI and ML inference | Render, Railway, Fly.io or another Docker host | Build from the repository root with services/api/Dockerfile. |
| Database and authentication | Supabase | Apply reviewed SQL migrations before application traffic is switched. |
| Evidence storage | Private Supabase Storage or HTTPS S3-compatible storage | Never make complaint evidence public. |
| Redis | Managed Redis, if enabled | Use TLS and private credentials. |

## API container

Build from the repository root:

    docker build -f services/api/Dockerfile -t grievx-api .

Configure production settings in the hosting provider's secret manager. Apply database migrations as a separate release step; do not run migrations automatically in every application replica.

## Admin dashboard

The Next.js app supports standalone output for a container deployment. It can alternatively be deployed with Vercel using apps/admin as the project root. Configure the Supabase URL and publishable key in the provider settings.

## Student app

1. Configure the Supabase URL and publishable key.
2. Configure the FastAPI URL only when the inference service is deployed.
3. Build Android/iOS binaries using the project's Expo EAS workflow.
4. Keep service-role keys and backend credentials out of Expo variables.

## Release order

1. Create the production Supabase project and private evidence bucket.
2. Review and apply SQL migrations in chronological order.
3. Deploy FastAPI with exact CORS/host allow-lists and production credentials.
4. Deploy the admin dashboard.
5. Build and distribute the mobile application.
6. Configure backups, monitoring, alerts and provider-level rate limits.
7. Complete end-to-end verification before calling the system production-ready.

The root Compose file is for local development infrastructure, not public production deployment.