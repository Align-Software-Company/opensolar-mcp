# Release constraints

Contractual and operational gates for publishing or hosting this MCP.
Architecture detail: `dev-docs/decisions/004-byo-token.md` (local).
Sources and dates: [source-log.md](./source-log.md).

Last reviewed: 2026-09-22

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

## Managed and public activation

This package is a self-hosted template. It is not a multi-tenant proxy.

| Gate | Requirement |
|------|-------------|
| Auth | Bring-your-own token. Env `OPENSOLAR_API_TOKEN`, or HTTP `Authorization: Bearer` on that request. No OAuth, no disk persistence, no token logs. |
| Hosting | Users run their own process (stdio, Docker, or their HTTP deploy). A hosted service that brokers many customers' OpenSolar accounts needs OpenSolar's prior written consent (User Terms 17.7). |
| npm / GHCR publish | Redaction rules covered in ADR 005; no secrets in git; 401, 402, and 403 stay distinct; README states unofficial status. Not published. |
| Machine user | Document that default tokens expire in 7 days; recommend a dedicated machine user. Do not PATCH `is_machine_user` for the operator. |

Public activation means: the operator of **their** OpenSolar org enables
API Access in Wallet, generates a token, and points this binary at it.
It does not mean Align runs OpenSolar on their behalf.

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
