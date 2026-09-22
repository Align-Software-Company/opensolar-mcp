# Source log

Retrieval dates for OpenSolar and MCP sources used to write the contract
matrix, quirks ledger, and release gate. Re-fetch a row before treating
it as current.

No tokens, passwords, or response bodies are stored here.

Last reviewed: 2026-08-22

---

## OpenSolar API documentation

Base: https://developers.opensolar.com/api/

| Page | URL | Retrieved |
|------|-----|-----------|
| API introduction | https://developers.opensolar.com/api/ | 2026-08-22 |
| API conventions | https://developers.opensolar.com/api/api-conventions/ | 2026-08-22 |
| Throttle limits | https://developers.opensolar.com/api/throttle/ | 2026-08-22 |
| Errors | https://developers.opensolar.com/api/error/ | 2026-08-22 |
| API access plans | https://developers.opensolar.com/api/api-access-plans/ | 2026-08-22 |
| API access FAQs | https://developers.opensolar.com/api/api-access-faqs/ | 2026-08-22 |
| Getting bearer tokens | https://developers.opensolar.com/api/getting-bearer-tokens/ | 2026-08-22 |
| Schema overview | https://developers.opensolar.com/api/schema-overview/ | 2026-08-22 |
| Projects | https://developers.opensolar.com/api/projects/ | 2026-08-22 |
| Contacts | https://developers.opensolar.com/api/contacts/ | 2026-08-22 |
| Systems | https://developers.opensolar.com/api/system/ | 2026-08-22 |
| System details | https://developers.opensolar.com/api/system-details/ | 2026-08-22 |
| Orgs | https://developers.opensolar.com/api/orgs/ | 2026-08-22 |
| Roles | https://developers.opensolar.com/api/roles/ | 2026-08-22 |
| Workflows | https://developers.opensolar.com/api/workflows/ | 2026-08-22 |
| Events (type ids) | https://developers.opensolar.com/api/events/ | 2026-08-22 |
| Modules | https://developers.opensolar.com/api/modules/ | 2026-08-22 |
| Inverters | https://developers.opensolar.com/api/inverters/ | 2026-08-22 |
| Batteries | https://developers.opensolar.com/api/batteries/ | 2026-08-22 |
| Payment options | https://developers.opensolar.com/api/payment-options/ | 2026-08-22 |
| Proposal data | https://developers.opensolar.com/api/proposal-data/ | 2026-08-22 |

---

## OpenSolar User Terms

| Source | URL | Retrieved | Notes |
|--------|-----|-----------|-------|
| User Terms & Conditions | https://www.opensolar.com/terms-conditions/ | 2026-08-22 | Clause 17 Access, Fair Use and Interference |

Clause 17 items used in [terms-release-gate.md](./terms-release-gate.md):

- 17.1–17.5: no scraping, no unreasonable load, no bypass of access controls
- 17.6: no use that materially exceeds reasonable business use or bypasses usage limits, rate restrictions, or technical safeguards
- 17.7: no proxy, aggregator, or third-party service interface without prior written consent
- 17.8: fair-use ceilings — Google Solar API 1,000/month and 200/day; webhooks 2,000/month; all other API usage per https://developers.opensolar.com/api/throttle
- Breach may lead to throttle, restrict, suspend, or terminate under clauses 13 or 15

---

## MCP

| Source | Version / URL | Retrieved |
|--------|---------------|-----------|
| `@modelcontextprotocol/server` | `2.0.0` (package.json `^2.0.0`) | 2026-08-22 |
| `@modelcontextprotocol/client` | `2.0.0` (devDependency; protocol tests) | 2026-08-22 |
| `@modelcontextprotocol/hono` | `2.0.0` | 2026-08-22 |
| MCP TypeScript SDK v2 docs | https://ts.sdk.modelcontextprotocol.io/v2/ | 2026-08-22 |
| MCP specification | https://spec.modelcontextprotocol.io/ | 2026-08-22 (index; transport subpage timed out on fetch) |

---

## Live verification

Recorded from prior org-48389 work (also noted in [api-quirks.md](./api-quirks.md)).
These are **not** re-run on 2026-08-22.

| Org | When | Endpoints / behavior |
|-----|------|----------------------|
| 48389 | 2026-05 (quirks last reviewed 2026-05-12) | Contacts list is a bare array; `ordering=-field` is descending; `ordering=-id` ignored; no contact timestamps; `@os.code` emails; events are org-level (`/projects/:id/events/` → 404); `events_data` vs `/events/:id/` field split; `design` gzip+base64; `integration_json` Python-literal; `integration_key_*` Fernet |

**Not live-verified (do not assume):**

| Item | Reason |
|------|--------|
| `GET /contacts/?search=` | Absent from official Contacts query table; no live check in this log |
| Nested `GET /projects/:project_id/systems/` | Systems docs specify `GET /systems/?fieldset=list&project=` |
| Conventions doc claim that `-` means ascending | Contradicted by Private Files docs and org-48389 contacts |

To promote a row to `live-verified` in the contract matrix, add a dated
row here with org id, endpoint, and what was asserted. Keep payloads out
of git; put curls in `dev-docs/private/` if needed.
