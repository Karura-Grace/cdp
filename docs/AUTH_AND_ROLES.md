# CDP Platform: Authentication and Roles

**Date:** 4 October 2026
**Scope:** Who can sign in, what each role can do, and how access is enforced, as built in the demo slice
**Status:** Describes the code at commit `5fce17a`, as of 5 October 2026. Gaps are listed in section 11.

---

## 1. Summary

The platform has six staff roles and one token based respondent path. Staff sign in with an email address and password through Supabase Auth. Respondents never sign in: they hold a single use link.

Access is enforced in the database. Row level security (RLS) decides which rows each signed in user can read, and every write goes through the server, which checks the caller's role again before it acts. The role claims placed in the login token are only a convenience for screens, and no database rule trusts them.

> Multi factor authentication (TOTP) is not enforced yet. The gate exists as a single function that currently always passes. This is the largest open item in this document.

## 2. The roles

| Role | Belongs to | How the role is held | Who creates the account |
|---|---|---|---|
| Super Admin | PAC platform, no tenant | Row in `app.platform_admin` | Created directly in the database, not in the app |
| PAC Consultant | PAC, assigned to engagements | Rows in `app.engagement_assignment`, each with a start and end date | Super Admin |
| Client Admin | One tenant (client organisation) | Row in `app.membership` | Super Admin |
| Executive | One tenant | Row in `app.membership` | Super Admin or the tenant's Client Admin |
| People Leader | One tenant | Row in `app.membership` | Super Admin or the tenant's Client Admin |
| Coach | One tenant | Row in `app.membership` | Super Admin or the tenant's Client Admin |
| Respondent or rater | Not a user | A single use 128 bit token in the survey link | Issued at launch through the invitations route |

Rules that follow from the tables:

- A client user has exactly one tenant and one role.
- A PAC Consultant has no tenant. Their access to a tenant exists only through an active assignment to one of its engagements, and it stops when the assignment ends.
- A consultant assignment can last at most 366 days from the day it is made.

## 3. Signing in

- Staff sign in at `/login` with email and password. There is no single sign on, no magic link and no self service password reset yet, because the project has no email service configured.
- The browser session is a cookie managed by Supabase. API clients can send the access token as `Authorization: Bearer <token>` instead.
- A state changing call made with a cookie session must carry the header `x-cdp-csrf: 1`. Calls that use a Bearer token do not need it.
- Pages under `/dashboard`, `/reports`, `/users`, `/engagements`, `/organisations` and `/account` redirect to `/login` when nobody is signed in. The login page keeps a safe `next` address and shows one generic error for any failed attempt.
- After sign in, a staff page also checks the account profile. An inactive account is sent back to `/login`. An account with a temporary password is sent to `/account/password` until it is replaced.

## 4. Passwords and account lifecycle

- A new user gets a random 16 character temporary password. It is shown once to the admin who created it.
- The user must replace it at first sign in. The server confirms the password really changed by comparing hashes, so re entering the temporary one does not clear the flag.
- An admin can reset a user's password, which issues a new temporary one. Nobody can reset their own password this way, and the temporary password is never emailed.
- Deactivating a user takes effect in the database immediately, even while their token is still valid, because every access rule first checks that the profile is active.
- Every user management action is written to the append only audit log.

## 5. Who can manage whom

| Actor | Can create and manage | Cannot |
|---|---|---|
| Super Admin | PAC Consultants and any client user, including their engagement assignments | Create or change another Super Admin in the app |
| Client Admin | Executives, People Leaders and Coaches in their own tenant | Create or change a Client Admin, touch another tenant, or assign consultants |
| Everyone | Nothing on their own account except changing their password | Change their own role or active status |

Tenants and engagements are created by Super Admin only.

## 6. What each role can do

Read access below is what the database permits. Writes happen only through the application routes listed in section 7.

### Super Admin

- Creates tenants and their engagements, and hands an engagement to a consultant.
- Creates and manages PAC Consultants and client users, and assigns consultants to engagements.
- Reads tenants, engagements, the instrument and rules, and the audit log.
- Reads the structure of an organisation graph, but no people rows.
- Does not read setup records, assessments, scores or reports.

### PAC Consultant (on assigned engagements only)

- Runs the whole delivery pipeline: setup sections, agreeing sections, consent text, transfer basis, pre flight, launch, invitations, freeze, scoring, score freeze, findings, report drafting and release.
- Edits the organisation graph and maps leaders to teams. Only a consultant can record an override of a graph defect, with a reason.
- Reads the setup records, assessments, scores, findings, reports and the audit log of assigned engagements.
- Is the only role that can release a report to the client.

### Client Admin

- Reads the tenant, its engagements, setup records, assessments and the tenant's audit log.
- Loads and edits the organisation graph and leader mapping for the tenant.
- Reads scores, findings and reports only after a report is released.
- Manages Executives, People Leaders and Coaches in the tenant.

### Executive

- Reads the tenant's engagements and setup records.
- Reads the structure of the organisation graph, but no people rows.
- Reads scores, findings and reports only after release.

### People Leader

- Reads the tenant's engagements.
- Reads the released organisational report only.
- A view limited to the leader's own team is specified but not built.

### Coach

- Reads the tenant's engagements. Sees no reports in this slice.

### Respondent or rater

- Opens the survey link, which carries the token after the `#` so it is not sent to servers in normal page loads or logs.
- Records consent first, then answers the survey. Free text answers are encrypted before storage.
- Nobody, in any role, can read an individual response. The tables that hold them are in a database schema that the app and every signed in role have no access to.

## 7. API access by route

All routes are under `/v1`. A failed check returns `401 UNAUTHENTICATED` when nobody is signed in, or `403 FORBIDDEN` when the role or scope does not permit the call. A consultant check also answers `403` for engagements outside the caller's scope.

| Route group | Who may call it |
|---|---|
| `tenants`, `tenants/{id}`, `tenants/{id}/engagements` | Super Admin |
| `users`, `users/{id}`, `users/{id}/reset-password`, `users/{id}/assignments`, `assignments/{id}` | Super Admin or Client Admin, within the limits in section 5 |
| `me/password-changed` | Any signed in user, for their own account |
| `engagements/{id}/assessments` | PAC Consultant on the engagement |
| `engagements/{id}/setup/{section}` and `.../agree` | PAC Consultant on the engagement |
| `engagements/{id}/org-graph` and `.../leaders` | Edit: PAC Consultant or Client Admin. Read: those two plus Super Admin and Executive |
| `engagements/{id}/org-graph/overrides` | PAC Consultant only |
| `assessments/{id}/preflight`, `launch`, `consent-text`, `consent-text/approve`, `transfer-basis`, `invitations` | PAC Consultant on the assessment |
| `assessments/{id}/freeze`, `score`, `score/freeze`, `evaluate`, `reports` | PAC Consultant on the assessment |
| `reports/{id}/sections`, `reports/{id}/release` | PAC Consultant on the engagement |
| `reports/{id}/export` | Any signed in role that can read the released report. Released versions only |
| `survey`, `survey/consent` | Anyone holding a valid token. No login |

## 8. What the database enforces

These rules hold even if a route handler were wrong.

| Object | Super Admin | PAC Consultant | Client Admin | Executive | People Leader | Coach |
|---|---|---|---|---|---|---|
| Tenant | Read | Read (assigned) | Read (own) | None | None | None |
| Engagement | Read | Read (assigned) | Read (own tenant) | Read (own tenant) | Read (own tenant) | Read (own tenant) |
| Instrument and rules | Read | Read | None | None | None | None |
| Setup record | None | Read, write (assigned) | Read, write (own tenant) | Read (own tenant) | None | None |
| Assessment | None | Read (assigned) | Read (own tenant) | None | None | None |
| Score and findings | None | Read (assigned) | After release | After release | None | None |
| Report | None | Read (assigned) | Released only | Released only | Released organisational report | None |
| Audit log | Read | Read (assigned) | Read (own tenant) | None | None | None |
| Individual responses | None | None | None | None | None | None |

Other guarantees in the database:

- The audit log cannot be updated or deleted by anyone.
- A frozen score cannot be changed.
- A tenant's hosting region and privacy regime cannot change after the first launch.
- Setup records and the organisation graph are locked once an assessment is launched, and the graph is also locked while any engagement of the tenant is in the field.
- Anything without an explicit policy is denied.

## 9. How the three keys are used

| Key | Where it lives | What it can do |
|---|---|---|
| Publishable (anon) key | Sent to browsers | Only what RLS allows for the signed in user |
| User access token | Cookie or Bearer header | The signed in user's own RLS scope |
| Service role key | Server environment only, never in the browser | Bypasses RLS. Used only after a route has checked the caller, and by database functions that check the acting user again |

The service role key is stored as a sensitive variable on Vercel. Deployed pages and routes never receive it in the browser.

## 10. The login token claims hook

Supabase can call a database function when a user signs in and add claims to their token. This project has one, `app.custom_access_token_hook`, which adds `app_role`, `tenant_id`, `is_people_lead` and `person_id`. It was enabled in the Supabase dashboard under Authentication, then Hooks.

- The claims are a convenience for the screens. No RLS rule and no route handler reads them. Role and scope are always looked up in the database for the current user, so a missing or stale claim cannot widen access.
- Because of this, the demo works with or without the hook. The hook becomes more important once tenant specific single sign on and the leader scopes are built.

## 11. Known gaps

1. **No multi factor authentication.** `app.mfa_ok()` always allows access except for inactive profiles. The spec requires TOTP at assurance level 2 for every staff policy. The line to add is noted in the function.
2. **Forced password change is enforced on pages only.** A user in the middle of a forced change still passes the database rules.
3. **No rate limiting of our own on sign in.** Only Supabase Auth's built in limits apply.
4. **No invitation or reset email.** Passwords are handed over by an admin. The sender will be `hello@pac.africa` once an email service exists.
5. **No Super Admin creation screen.** Super Admins are added directly in the database.
6. **No last admin protection.** The last Client Admin of a tenant can be deactivated by a Super Admin.
7. **People Leader scoped views are not built.** A leader sees the organisational report only. The link from a login to a person record is also not built.
8. **No Coach account exists in the demo data.** The Coach rules are in the database but are not exercised by the demo accounts.
9. **No single sign on.** OIDC and SAML per tenant are specified but not built.
10. **Roles are not tested cell by cell.** The role matrix is exercised by the release, UI, export, user and organisation test scripts. A suite with one test for every cell of the permissions matrix is still to do.
11. **Test accounts.** One real Super Admin exists (created 5 October, one time password, forced change at first sign in). Demo logins also exist for Super Admin, PAC Consultant, Client Admin, Executive and People Leader, plus about 50 throwaway client admin logins from test runs. Their passwords are in a local file outside git. Remove the throwaway ones, and replace the rest, before real client data is used.

## 12. Files to read

| Topic | File |
|---|---|
| Roles, membership, helper functions, claims hook | `supabase/migrations/20261002123351_foundation_tenancy.sql` |
| Row level security policies | `supabase/migrations/20261002123402_rls_policies.sql` |
| Profiles, user management, session gate | `supabase/migrations/20261003090000_user_management.sql` |
| Route guards for consultants, graph editors, Super Admin | `apps/web/lib/staff.ts`, `apps/web/lib/users.ts` |
| Page gate (active account, forced password change) | `apps/web/lib/session.ts` |
| Page protection and session refresh | `apps/web/middleware.ts` |
| Permissions matrix status | `docs/CONFORMANCE.md`, section 2 |
