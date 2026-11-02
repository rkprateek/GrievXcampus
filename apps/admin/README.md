# GrievX Campus Admin and Operations

Next.js + TypeScript web application for campus complaint operations.

## Routes

- / — administrator complaint queue, complaint details, status/priority/department/staff assignment, analytics, CSV export and manual-location campus heatmap.
- /staff — administrator-only staff directory for assigning staff and department heads to a department.
- /department — staff and department-head workspace. Row Level Security determines which complaints are visible and which updates are permitted.

## Local setup

1. Copy .env.example to .env.local.
2. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
3. Install dependencies with npm install.
4. Start the application with npm run dev.

Open http://localhost:3000.

## Authorization

The role check in the browser is for navigation and user feedback only. Supabase Row Level Security is the actual access boundary. Review and apply the Week 13 scoped staff access migration before using the staff or department routes against a shared database.

## Deployment

The recommended deployment target is Vercel with apps/admin as the project root. Configure the two public Supabase environment variables in the hosting provider. Never add a service-role key to this application.
