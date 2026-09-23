# Release constraints

Contractual and operational gates for publishing or hosting this MCP.
Architecture detail: `dev-docs/decisions/004-byo-token.md` (local).
Sources and dates: [source-log.md](./source-log.md).

Last reviewed: 2026-09-23

---

## Official API only

Tools call documented OpenSolar HTTP endpoints under
`https://api.opensolar.com/api/` (or a configured equivalent). They do
not scrape `app.opensolar.com`, parse undocumented HTML, or invent query
parameters.

Binding rules:

- Map each tool to a row in [api-contract-matrix.md](./api-contract-matrix.md).
- If the matrix marks a parameter `deferred` or not live-verified, do not
  ship that parameter. OpenSolar `GET /contacts/?search=` stays deferred.
  `search_contacts` is a separate derived tool: it pages the documented
  list and matches locally.
- Do not hide bulk work inside a tool (N sequential POSTs presented as
  one call). OpenSolar has no batch project API; looping belongs with
  the caller so per-item failures stay visible.
- `get_proposal_data` calls `GET /api/user_logins/` with one project id. It requires Raw Data API Access and returns HTTP 402 otherwise.

User Terms clause 17 also forbids robots/scrapers without written
permission and forbids bypassing access controls.

---

## Rate and fee safeguards

Two layers, both binding.

**Contractual (User Terms 17.8), unless OpenSolar agrees otherwise in
writing:**

| Channel | Ceiling |
|---------|---------|
| Google Solar API | 1,000 calls per calendar month and 200 per calendar day |
| Webhooks | 2,000 calls per calendar month |
| All other API usage | [documented per-endpoint throttles](https://developers.opensolar.com/api/throttle/) |

Exceeding these is a terms breach (17.6), not only an HTTP 429.
OpenSolar may throttle, suspend, or terminate under clauses 13 or 15.

**Operational throttles (examples):**

| Action | Per user | Per org |
|--------|----------|---------|
| POST project | 10/min | 10,000/day |
| PATCH/PUT project | 10/min | 10,000/day |
| GET project | 100/min | 10,000/day |
| GET system details | 60/min | 10,000/day |
| GET `/api/user_logins/` | 100/min | 10,000/day |

Unlisted endpoints still have a quota.

MCP policy:

- Honor 429 on ordinary JSON GET. The client retries at most three attempts. `Retry-After` is used when it is at most 5 seconds. Without that header the waits are 200 ms and then 400 ms. A longer `Retry-After` is returned as 429 with no sleep. Writes, form upload, file GET, and download are not retried.
- Fail fast rather than retry past a per-minute ceiling inside one tool
  call.
- Do not ship Google Solar API tools. The 200/day cap is too tight
  for typical agent traffic.
- API Access uses project-level paid entitlement while enabled. A new
  project can be blocked when the wallet is empty. Other calls continue.
  Do not retry `create_project` in a tight loop when the wallet is empty.

---

## Self-hosted distribution and managed hosting

This repository distributes a self-hosted client. It does not operate a multi-tenant OpenSolar proxy.

| Area | Requirement |
|------|-------------|
| Stdio auth | The local process receives `OPENSOLAR_API_TOKEN`. No OAuth, disk persistence, or token logs. |
| Loopback HTTP auth | A request `Authorization: Bearer` token takes precedence; the local env token may be used as fallback. |
| Non-loopback HTTP auth | Every MCP request must supply `Authorization: Bearer <OpenSolar token>`. The server deliberately ignores `OPENSOLAR_API_TOKEN` as a request fallback. `MCP_HTTP_ALLOWED_HOSTS` is Host/DNS-rebinding protection, not authentication. Public traffic must be protected by TLS termination. |
| Local uploads | `create_private_file` is disabled unless `OPENSOLAR_UPLOAD_ROOT` is set, and resolved paths must remain inside that root. |
| Package distribution | README identifies the project as unofficial and self-hosted. Secret scans and artifact smoke tests run before release. |
| Machine user | Document that default tokens expire in 7 days; recommend a dedicated machine user. Do not PATCH `is_machine_user` for the operator. |
| Future managed hosting | Any Align-operated shared/multi-customer service is a separate operating model and must be reviewed separately before it goes live. |

A user running this package enables API Access for **their** OpenSolar org,
supplies their own credentials, and points their own MCP client at the
process. Package publication and any future Align-operated managed service
are separate release decisions. This document does not make a legal
conclusion about whether distributing the self-hosted package requires
OpenSolar consent.

---

## Wallet and plan activation

From [API Access Plans](https://developers.opensolar.com/api/api-access-plans/)
and [FAQs](https://developers.opensolar.com/api/api-access-faqs/):

- Paid plan required from 17 March 2026. 30-day trial exists.
- Two products: API Access (core) and Raw Data API Access (core plus
  `design`, system-details `custom_data`, proposal data).
- If both products are enabled, OpenSolar charges Raw Data.
- After enabling a wallet product, changes can take **up to 5 minutes**.
- Disabling the wallet: projects created while it was enabled keep API
  access; later projects do not.

Do not treat "org has API Access" as "every project is readable."
