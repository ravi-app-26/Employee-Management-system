# Security Demonstration Script

This script demonstrates three controls in the current implementation. It uses seeded development accounts and synthetic data only. Run in a local/test environment, never against production.

## Prerequisites

```bash
npm ci
cp .env.example .env
# Set DATABASE_URL and a random JWT_ACCESS_SECRET (minimum 32 chars)
npm run migrate
npm run seed
npm run dev
```

Seed password is `DevPass#12345`; seed users are listed in `seeds/run.ts` and seeding refuses production. Set shell variables:

```bash
BASE_URL=http://localhost:3000
DEV_PASSWORD='DevPass#12345'
```

Get tokens, using the access token from the JSON `data.accessToken`. The login response also sets the refresh cookie in the command's cookie jar.

```bash
curl -i -c /tmp/employee-cookies.txt -X POST "$BASE_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"employee@example.test\",\"password\":\"$DEV_PASSWORD\"}"

curl -i -c /tmp/admin-cookies.txt -X POST "$BASE_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@example.test\",\"password\":\"$DEV_PASSWORD\"}"
```

Set tokens in the shell after reading responses:

```bash
EMPLOYEE_TOKEN='paste employee data.accessToken'
ADMIN_TOKEN='paste admin data.accessToken'
```

## A. Mass-Assignment Role Escalation Attempt

This request tries to change an employee's role by adding `"role":"admin"` to an employee update. Use a known employee UUID, for example the one returned by `/api/v1/auth/me` as `data.employeeId`.

```bash
EMPLOYEE_ID='paste employee data.employeeId'
curl -i -X PATCH "$BASE_URL/api/v1/employees/$EMPLOYEE_ID" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jobTitle":"Test title","role":"admin"}'
```

**Expected:** HTTP `403` for the seeded employee role because it lacks `employee:update`; the body is the standard forbidden error. To demonstrate schema mass-assignment rejection past the permission gate, repeat with the admin token and a valid target employee ID:

```bash
curl -i -X PATCH "$BASE_URL/api/v1/employees/$EMPLOYEE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jobTitle":"Test title","role":"admin"}'
```

Expected for the admin request: HTTP `400`, `error.code` is `VALIDATION_ERROR`, because the strict update schema has no `role` field. The role cannot be changed through employee PATCH. Role assignment is deliberately a separate endpoint, `PATCH /api/v1/users/:id/role`, guarded by `admin` and `user:assign_role`; an authorized admin can change roles there.

**Controls:** [employee.routes.ts](../src/routes/employee.routes.ts#L31-L36) requires `employee:update`; [employee.controller.ts](../src/controllers/employee.controller.ts#L32-L39) selects a strict validator; [employee.validator.ts](../src/validators/employee.validator.ts#L35-L49) rejects unknown fields. Dedicated role assignment is separately guarded in [user.routes.ts](../src/routes/user.routes.ts#L17-L24).

## B. Broken Object-Level Authorization Attempt

Create or identify an employee record outside the logged-in employee's own record and outside a manager's direct reports. With the seeded employee token, a UUID for the manager is a convenient target:

```bash
OTHER_EMPLOYEE_ID='paste another employee UUID, not your own'
curl -i "$BASE_URL/api/v1/employees/$OTHER_EMPLOYEE_ID" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
```

**Expected:** HTTP `403` for seeded employee because it lacks the directory `employee:read` permission. To exercise the actual object-level scope check, use a manager account that has `employee:read`, then request an unrelated employee UUID. Expected: HTTP `404` with `NOT_FOUND` to avoid revealing whether an out-of-scope employee exists. A manager request for a direct report or self is permitted by scope.

To get the seeded manager token, log in as `manager@example.test` with the same development password and set `MANAGER_TOKEN`. Then call the unrelated employee ID:

```bash
curl -i "$BASE_URL/api/v1/employees/$OTHER_EMPLOYEE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

**Controls:** route permission guard is in [employee.routes.ts](../src/routes/employee.routes.ts#L25-L30); record-level ownership/reporting check is in [employee.service.ts](../src/services/employee.service.ts#L81-L85) and [employee.service.ts](../src/services/employee.service.ts#L211-L221). Detail lookup is performed before the scope check, but inaccessible records are returned as not found by the service.

## C. Refresh-Token Replay, Including Simultaneous Requests

Login once and retain the cookie jar. Use the same original cookie twice concurrently:

```bash
curl -sS -b /tmp/employee-cookies.txt -c /tmp/refresh-a.txt \
  -X POST "$BASE_URL/api/v1/auth/refresh" -w '\nHTTP %{http_code}\n' > /tmp/refresh-a.out &
PID_A=$!
curl -sS -b /tmp/employee-cookies.txt -c /tmp/refresh-b.txt \
  -X POST "$BASE_URL/api/v1/auth/refresh" -w '\nHTTP %{http_code}\n' > /tmp/refresh-b.out &
PID_B=$!
wait "$PID_A"; wait "$PID_B"
cat /tmp/refresh-a.out /tmp/refresh-b.out
```

**Expected:** exactly one response is HTTP `200` and has a new access token; the other is HTTP `401` with `UNAUTHORIZED`. Which request wins is nondeterministic. The original token must not be reused successfully afterward; depending on which request won, replaying the old cookie returns `401` and revokes active tokens in that family.

Sequential replay check using the original cookie jar:

```bash
curl -i -b /tmp/employee-cookies.txt -X POST "$BASE_URL/api/v1/auth/refresh"
```

**Controls:** refresh validation and `401` handling are in [auth.service.ts](../src/services/auth.service.ts#L104-L140). Conditional revoke, affected-row check, family revocation, and replacement insert are in one transaction in [refresh-token.repository.ts](../src/repositories/refresh-token.repository.ts#L25-L52). The regression test runs two `Promise.all` HTTP requests and asserts `[200, 401]` in [auth.integration.test.ts](../tests/integration/auth.integration.test.ts#L26-L40).

## Result Capture

For each scenario, show the request, status/body, and cited backend control. The concurrency result may appear in either output file; verify one success and one unauthorized response, not which process won.
