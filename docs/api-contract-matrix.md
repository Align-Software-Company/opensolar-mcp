# API contract matrix

One row per MCP tool or supporting OpenSolar endpoint. Implementation
work must use this file instead of guessing paths, plans, or query
parameters.

Retrieval dates: [source-log.md](./source-log.md). Empirical extras:
[api-quirks.md](./api-quirks.md).

Last reviewed: 2026-08-22

---

## Status values

| Status | Meaning |
|--------|---------|
| documented | Listed on developers.opensolar.com |
| live-verified | Confirmed against org 48389; see source-log |
| undocumented-observed | Seen in live responses or tests; not in the official query/field tables |
| deprecated | Official deprecation notice |
| deferred | Explicitly out of v1, or not to be implemented until independently live-verified |

A row may carry more than one status when the endpoint is documented but
a field or query parameter is not. The **Status** column names the
primary marker; extra markers appear in **Response notes**.

Throttle source: [Throttle Limits](https://developers.opensolar.com/api/throttle/).
Unlisted endpoints still have a quota ("all endpoints have a throttle
quota even if they are not listed"). Unlisted → `undocumented quota`.

Plan values: `api_access`, `raw_data`, `none` (auth endpoints).

---

## v1 tools

| Tool | Status | Method | Path | Query parameters | Required fieldset | Write payload | Plan | Documented throttle | Response notes | Source |
|------|--------|--------|------|------------------|-------------------|---------------|------|---------------------|----------------|--------|
| `list_projects` | live-verified | GET | `/api/orgs/:org_id/projects/` | `page`, `limit`, `fieldset` (`list`, `studio`) | none for default list | n/a | api_access | undocumented quota | Official list example is a **bare array**. `fieldset=list` is documented for list pagination conventions. Current tool does not send `fieldset`. | [Projects](https://developers.opensolar.com/api/projects/) |
| `get_project` | live-verified | GET | `/api/orgs/:org_id/projects/:id/` | none documented | none | n/a | api_access; `design` requires raw_data | 100/min user, 10,000/day org | `design` omitted or null on API Access. `stage` deprecated (see below). `usage` present on detail. `events` (URL refs) and `events_data` (inlined). | [Projects](https://developers.opensolar.com/api/projects/), [API Access Plans](https://developers.opensolar.com/api/api-access-plans/) |
| `create_project` | documented | POST | `/api/orgs/:org_id/projects/` | none | none | JSON object; example includes `identifier`, `is_residential`, `lead_source`, `notes`, `lat`, `lon`, `address`, `locality`, `state`, `country_iso2`, `zip`, `number_of_phases`, `roof_type` (URL), `assigned_role` (URL), `contacts_new` (array of contact objects). Trailing slash required. | api_access | 10/min user, 10,000/day org | Wallet empty blocks **new** project creation; existing API access continues. | [Projects](https://developers.opensolar.com/api/projects/), [API Access FAQs](https://developers.opensolar.com/api/api-access-faqs/) |
| `update_project` | documented | PATCH | `/api/orgs/:org_id/projects/:id/` | none | none | Partial project JSON. Do not expose PUT in the MCP. Trailing slash required. | api_access | 10/min user, 10,000/day org (PATCH row) | PUT is documented in throttle tables (`10/min`) but is out of the v1 tool surface. | [Projects](https://developers.opensolar.com/api/projects/), [Throttle](https://developers.opensolar.com/api/throttle/) |
| `update_project_stage` | documented | PATCH | `/api/orgs/:org_id/projects/:id/` | none | none | See [Workflow stage replacement](#workflow-stage-replacement). Do **not** PATCH deprecated `stage`. | api_access | 10/min user, 10,000/day org | Same endpoint as `update_project`; constrained input (stage IDs only) is an MCP choice, not an API path. | [Projects](https://developers.opensolar.com/api/projects/) |
| `list_contacts` | live-verified | GET | `/api/orgs/:org_id/contacts/` | documented: `page`, `limit`. observed: `ordering` (`first_name`, `family_name`, `email`; `-` = descending). `ordering=-id` silently ignored. | none | n/a | api_access | undocumented quota | Bare JSON array, no `count`/`next`. No `created_date` / `modified_date` on the entity. | [Contacts](https://developers.opensolar.com/api/contacts/), [api-quirks.md](./api-quirks.md) |
| `search_contacts` | deferred | GET | `/api/orgs/:org_id/contacts/` | Official table: `page`, `limit` only. Roadmap assumed `?search=`. **Do not assume server-side search until independently live-verified.** | none | n/a | api_access | undocumented quota | Not documented. Not live-verified. Implementation must not add a `search` query parameter on speculation. | [Contacts](https://developers.opensolar.com/api/contacts/) |
| `get_contact` | live-verified | GET | `/api/orgs/:org_id/contacts/:id/` | none | none | n/a | api_access | undocumented quota | Same entity gaps as list (no created/modified timestamps). | [Contacts](https://developers.opensolar.com/api/contacts/) |
| `create_contact` | documented | POST | `/api/orgs/:org_id/contacts/` | none | none | Official page shows no request example. Project create uses `contacts_new` with `first_name`, `family_name`, `email`, `phone`, `date_of_birth`, `gender`. Confirm standalone POST body against a live sandbox before shipping. Trailing slash required. | api_access | undocumented quota | PUT/DELETE exist on the resource; v1 does not expose them. | [Contacts](https://developers.opensolar.com/api/contacts/) |
| `list_project_systems` | documented | GET | `/api/orgs/:org_id/systems/` | `fieldset=list` **required**, `page`, `limit`, `project` (id) | `fieldset=list` | n/a | api_access | undocumented quota | Bare array in the official example. Filter with `project`. Roadmap also cited `GET /projects/:project_id/systems/`; that nested path is **not** on the Systems page — use `?project=` unless live-verified otherwise. | [Systems](https://developers.opensolar.com/api/system/) |
| `get_system` | documented | GET | `/api/orgs/:org_id/systems/:id/` | `fieldset=list` **required** | `fieldset=list` | n/a | api_access | undocumented quota | Uniform across plans per FAQs. | [Systems](https://developers.opensolar.com/api/system/), [API Access FAQs](https://developers.opensolar.com/api/api-access-faqs/) |
| `get_system_details` | documented | GET | `/api/orgs/:org_id/projects/:project_id/systems/details/` | `limit_to_sold`, `include_parts`, `exclude_parts` (mutually exclusive) | none | n/a | api_access; `custom_data` requires raw_data | 60/min user, 10,000/day org | Known timeouts on large projects; default a curated `include_parts`. Teams-shared projects cannot use this endpoint. | [System Details](https://developers.opensolar.com/api/system-details/), [API Access Plans](https://developers.opensolar.com/api/api-access-plans/) |
| `list_modules` | documented | GET | `/api/orgs/:org_id/component_module_activations/` | `page`, `limit` | none | n/a | api_access | undocumented quota | Bare array. Writes (POST/DELETE) deferred. | [Modules](https://developers.opensolar.com/api/modules/) |
| `list_inverters` | documented | GET | `/api/orgs/:org_id/component_inverter_activations/` | `page`, `limit` | none | n/a | api_access | undocumented quota | Bare array. Writes deferred. | [Inverters](https://developers.opensolar.com/api/inverters/) |
| `list_batteries` | documented | GET | `/api/orgs/:org_id/component_battery_activations/` | `page`, `limit` | none | n/a | api_access | undocumented quota | Bare array. Writes deferred. | [Batteries](https://developers.opensolar.com/api/batteries/) |
| `list_workflows` | documented | GET | `/api/orgs/:org_id/workflows/` | `page`, `limit`, `is_default`, `is_archived` | none | n/a | api_access | undocumented quota | Stages in `workflow_stages`; actions nested per stage. Needed to resolve names → `active_stage_id`. | [Workflows](https://developers.opensolar.com/api/workflows/) |
| `get_org` | live-verified | GET | `/api/orgs/:org_id/` | none | none | n/a | api_access | undocumented quota | Verbose payload includes `roles[].integration_json` (Python-literal) and `org_configs.integration_key_*` (Fernet). | [Orgs](https://developers.opensolar.com/api/orgs/) |
| `list_roles` | documented | GET | `/api/orgs/:org_id/roles/` | none on list. Detail `:id/` documents `fieldset` (`list`), `range`, `page`, `limit`, `ordering` (`id`, `is_admin`) | none on list | n/a | api_access | undocumented quota | Bare array. `api_key_chat` is a credential; redact. Query-param table on the official page is attached to the **detail** row; do not assume list accepts `ordering` without a check. | [Roles](https://developers.opensolar.com/api/roles/) |
| `get_event` | live-verified | GET | `/api/orgs/:org_id/events/:event_id/` | none documented on this page (page is an enum table) | none | n/a | api_access | undocumented quota | Org-level resource. Nested `/projects/:id/events/` returned 404. Inlined `events_data` on project differs from detail (see quirks). | [Events](https://developers.opensolar.com/api/events/), [api-quirks.md](./api-quirks.md) |
| `list_payment_options` | documented | GET | `/api/orgs/:org_id/payment_options/` | `page`, `limit`, `priority`, `auto_apply_enabled`, `payment_type` (`cash`, `loan`, `loan_advanced`, `ppa`, `regular_payment`, `lease`) | none | n/a | api_access | undocumented quota | Bare array. Writes deferred. | [Payment Options](https://developers.opensolar.com/api/payment-options/) |

---

## Supporting endpoints

| Name | Status | Method | Path | Query | Fieldset | Write payload | Plan | Throttle | Notes | Source |
|------|--------|--------|------|-------|----------|---------------|------|----------|-------|--------|
| Bearer token | documented | POST | `/api-token-auth/` | n/a | n/a | `{ username, password, token? }` (`token` = MFA) | none | undocumented quota | MCP does not call this. Users paste a token. Machine-user recommended (7-day expiry otherwise). | [Getting Bearer Tokens](https://developers.opensolar.com/api/getting-bearer-tokens/) |
| Fetch token | documented | GET | `/api/fetch_token/` | `org_id` optional | n/a | n/a | none | undocumented quota | Session/token refresh. Not used in v1. | [Getting Bearer Tokens](https://developers.opensolar.com/api/getting-bearer-tokens/) |
| Workflow by id | documented | GET | `/api/orgs/:org_id/workflows/:id/` | none | none | n/a | api_access | undocumented quota | | [Workflows](https://developers.opensolar.com/api/workflows/) |
| Trailing slashes | documented | POST/PUT/PATCH/DELETE | all mutating paths | — | — | — | — | — | Trailing `/` enforced except on GET. | [API Conventions](https://developers.opensolar.com/api/api-conventions/) |

---

## Deferred endpoints (do not implement in v1)

| Name | Status | Method | Path | Query | Fieldset | Write payload | Plan | Throttle | Notes | Source |
|------|--------|--------|------|-------|----------|---------------|------|----------|-------|--------|
| Proposal data | deferred | GET | `/api/user_logins/` | `project_ids` (required), `expo_enabled`, `compress_data`, `include_unsold`, `language` | n/a | n/a | **raw_data** | 100/min user, 10,000/day org | HTTP **402** without Raw Data. HTTP **403** if any requested project is inaccessible (batch is fragile). Includes `usage`, compressed `design` when `compress_data` set. | [Proposal Data](https://developers.opensolar.com/api/proposal-data/) |
| Batch / bulk project ops | deferred | — | none | — | — | — | — | create is 10/min | OpenSolar has no batch project API. Do not loop inside a tool. | [Schema overview](https://developers.opensolar.com/api/schema-overview/), [Throttle](https://developers.opensolar.com/api/throttle/) |
| Google Solar API | deferred | — | not exposed as an MCP tool | — | — | — | — | ToS: 1,000/month and 200/day | Contractual ceiling, not only an HTTP throttle. | [User Terms §17.8](https://www.opensolar.com/terms-conditions/), [terms-release-gate.md](./terms-release-gate.md) |
| Connected orgs | deferred | GET/POST/PATCH | `/api/orgs/:org_id/connected_orgs/` | — | — | — | api_access | 100/day user and org | | [Throttle](https://developers.opensolar.com/api/throttle/) |
| Private files | deferred | GET/POST/PATCH | `/api/orgs/:org_id/private_files/` | `project` filter documented on Projects | — | — | api_access | 1000/day org; 1000/hour user | v2 candidate. | [Projects](https://developers.opensolar.com/api/projects/), [Throttle](https://developers.opensolar.com/api/throttle/) |
| Component activation writes | deferred | POST/DELETE | `/api/orgs/:org_id/component_*_activations/` | — | — | — | api_access | undocumented quota | High-stakes catalog changes. | module/inverter/battery pages above |

---

## Project `stage` deprecation

Official notice: [Projects § Deprecations](https://developers.opensolar.com/api/projects/).

The `stage` field is **deprecated**. It now represents the project's
workflow **milestone** id, not a custom workflow stage.

| Legacy `stage` | Milestone |
|----------------|-----------|
| 0 Designing | 0 Presale |
| 1 Selling | 1 Lock Pricing |
| 2 Installing | 2 Sold |
| 3 Maintaining | 3 Installed |
| 4 Other | 4 Others |

Detail responses include `stage_warning` telling clients to migrate.

**Replacement:** manage progress with `workflow.active_stage_id` (and
`workflow_id` when assigning a workflow).

Current skeleton still reads and returns `stage` on `get_project` curated
output. It does not read `workflow.active_stage_id`. That is recorded
here; it is not changed in this snapshot.

Status: **deprecated** (`stage`) + **documented** (`workflow.active_stage_id`).

---

## Workflow stage replacement

`update_project_stage` (not yet implemented) must PATCH the project, not
a nested stage URL.

Official example:

```json
{
  "workflow": {
    "active_stage_id": 433194,
    "workflow_id": 84617
  },
  "active_stage_id": 433194
}
```

`list_workflows` supplies `workflow_stages[].id` and titles for name → id
resolution. Resolve names before PATCH. Do not send `stage: <n>` for this
tool.

Source: [Projects — Updating a Project](https://developers.opensolar.com/api/projects/).

---

## Project `usage` payload

PATCH `/api/orgs/:org_id/projects/:id/` with:

```json
{
  "usage": {
    "usage_data_source": "<source>",
    "values": <number | number[] | "Low" | "Medium" | "High">
  }
}
```

| Data source | `usage_data_source` | `values` |
|-------------|---------------------|----------|
| Annual kWh | `kwh_annual` | integer |
| Monthly kWh | `kwh_monthly` | 12 integers |
| Bi-monthly kWh | `kwh_every_second_month` | 6 integers |
| Quarterly kWh | `kwh_quarterly` | 4 integers |
| Daily kWh per month | `kwh_daily_per_month` | 12 integers |
| Annual bill | `bill_annual` | integer |
| Monthly bills | `bill_monthly` | 12 integers |
| Bi-monthly bills | `bill_every_second_month` | 6 integers |
| Quarterly bills | `bill_quarterly` | 4 integers |
| Estimate | `estimate` | `"Low"` \| `"Medium"` \| `"High"` |

Where `usage` appears:

| Surface | Notes |
|---------|--------|
| `GET .../projects/:id/` | `usage` plus `usage_annual_or_guess` |
| Proposal data `GET /api/user_logins/` | `usage`, `usage_annual_or_guess`, `usage_normalized` — Raw Data only |
| Project webhooks | `project.usage` listed in default payload fields |

There is no dedicated usage endpoint. Reads today go through `get_project`
(verbose). Writes would be a PATCH on the project; v1 has no usage tool.

Source: [Projects — Updating a Project's Energy Consumption](https://developers.opensolar.com/api/projects/).

---

## Raw Data–only fields

From [API Access Plans](https://developers.opensolar.com/api/api-access-plans/)
and [API Access FAQs](https://developers.opensolar.com/api/api-access-faqs/).
If both wallet products are enabled, OpenSolar charges Raw Data.

| Field / endpoint | API Access | Raw Data API Access |
|------------------|------------|---------------------|
| `GET .../projects/:id/` → `design` | omitted or null | gzip+base64 JSON (magic `H4sI`) |
| `GET .../systems/details/` → `custom_data` | omitted | present |
| `GET /api/user_logins/` | HTTP 402 | full proposal payload |

`design` contents (after gunzip): scene/3D, systems, components, pricing,
energy, layout. Not suitable as LLM context in raw form.

HTTP 402 on proposal data means "plan insufficient", not a generic payment
error. Distinct from 401 (auth) and 403 (no access to that resource).

---

## Contact search (not assumed)

Official [Contacts](https://developers.opensolar.com/api/contacts/) query
parameters for list: **`page`, `limit`**.

`search_contacts` in the v1 roadmap assumed `GET .../contacts/?search=`.
That parameter is not in the official table and has not been live-verified.

**Rule:** do not implement server-side contact search, and do not pass
`search`, until a live check against a sandbox org is recorded in
[source-log.md](./source-log.md) with status `live-verified`.

---

## Pagination and ordering (shared)

[API Conventions](https://developers.opensolar.com/api/api-conventions/):

- `limit`, `page`, `range` (URL-encoded JSON `[0,19]`)
- `ordering`: docs say `-` means **ascending**. Private Files docs and
  live contacts/projects behavior say `-` means **descending**. Treat `-`
  as descending until a runtime ordering test says otherwise. See
  [api-quirks.md](./api-quirks.md).

Prefer `limit` + `page` in tools. Avoid `range` unless required.

List response shapes are inconsistent: some resources are `{ count, next,
previous, results }`; projects (default), contacts, roles, payment options,
and component activations are documented as **bare arrays**.
