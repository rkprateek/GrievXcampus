# Roles and Permissions

| Capability | Student | Staff | Department Head | Admin |
|---|---|---|---|---|
| Register/login | Yes | Yes | Yes | Yes |
| Create complaint | Yes | No* | No* | Operational only |
| View own complaints | Yes | No | No | Yes |
| View assigned/department complaints | No | Yes | Yes | Yes |
| Update assigned complaint | No | Yes | Yes | Yes |
| Assign department | No | No | Department scope | Yes |
| Assign staff | No | No | Department scope | Yes |
| Manage priority | No | Limited/authorized | Yes | Yes |
| Manage lifecycle | No | Authorized states | Authorized states | Yes |
| Operational analytics | No | Scoped | Department scope | Yes |
| Review duplicate-check activity | Own submission result | Scoped if needed | Department scope | Yes |

* If future requirements allow staff/department-head complaint creation, the API policy can be extended explicitly.

## Authorization rule

Permissions must be enforced by the backend, not only hidden in the UI.
