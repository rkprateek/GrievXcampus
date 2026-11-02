# GrievX Campus — Security Review

## Implemented hardening scope
- Validate production configuration before starting the API.
- Restrict CORS to explicit trusted origins and Host headers to configured domains.
- Disable interactive API documentation in production unless explicitly enabled through a controlled release process.
- Add API security response headers.
- Bound image reads to the configured upload limit and verify file signatures as well as declared MIME type.
- Generate storage object names on the server and derive extensions from validated content types.
- Run application containers as non-root users.

## Required before public launch
1. Use unique production credentials stored in the hosting provider's secret manager.
2. Set exact CORS origins and allowed hostnames.
3. Confirm RLS is enabled on every table exposed through the Supabase API.
4. Review student ownership and staff/admin access policies for every table and RPC.
5. Keep the evidence bucket private and use short-lived signed URLs after authorization.
6. Configure provider-level rate limiting for authentication, duplicate checks and uploads.
7. Enable platform logs, alerts, backups and a tested restore procedure.
8. Restrict database and storage network access to required services.
9. Confirm no backend-only credentials are present in Git history, client bundles or logs.

## Final security verification
- [ ] Production configuration rejects placeholders and wildcard CORS/hosts.
- [ ] Untrusted Host headers are rejected.
- [ ] Security headers are present.
- [ ] Student A cannot access Student B's complaints, evidence, notifications or votes.
- [ ] Non-admin users cannot access admin analytics or controls.
- [ ] Staff access follows department/assignment rules.
- [ ] Oversized, empty, spoofed-MIME and unsupported uploads are rejected.
- [ ] Evidence storage is private and signed URLs expire.
- [ ] Backup restoration is demonstrated.

This checklist remains open until the final testing phase.