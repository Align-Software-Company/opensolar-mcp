# OpenSolar API quirks

Behaviors that are unclear in official docs, surprise on first encounter,
or contradict common API conventions. Add an entry when you find a new
one. Do not paper over it in tool code without recording it here.

Format: what it is, where it is documented (if anywhere), what this
codebase should do.

Last reviewed: 2026-09-23
Canonical path: `docs/api-quirks.md` (this file).

---

## Authentication

### Bearer tokens expire after 7 days by default

Standard user tokens are valid for 7 days. After expiry, every API call
returns 401. The token does not auto-refresh.

Set `is_machine_user: true` on the user via `PATCH /auth/users/:user_id/`.
Machine-user tokens do not expire. MFA-enabled users can also be machine
users (older docs may say otherwise).

This repository recommends a dedicated user for API use, converted to a
machine user, rather than converting a person's primary login. That is
project advice; the OpenSolar pages do not state it.

**Source:** [Getting Bearer Tokens](https://developers.opensolar.com/api/getting-bearer-tokens/), [How to Set Machine User](https://developers.opensolar.com/api/how-to-set-machine-user/)

**What to do:**

- User docs should walk through creating a machine user
  (`docs/authentication.md` when it exists).
- `--check` should warn if the token's user is not a machine user (requires
  `GET /auth/users/:user_id/`; defer if that is painful).
- 401 mapping in the client should point at the authentication doc, not a
  generic "unauthorized."

### `GET /fetch_token/` refreshes an existing token

If a user is already authenticated (session cookie or bearer token),
`GET /api/fetch_token/?org_id=<org_id>` returns a new or refreshed token,
optionally scoped to a specific org.

Not used in v1 (machine users instead of refresh). Recorded so it is not
reimplemented by accident.

**Source:** [Getting Bearer Tokens § Option C](https://developers.opensolar.com/api/getting-bearer-tokens/#option-c-fetch-token-existing-session)

---

## Tier behavior

### HTTP 402 means "tier insufficient"

`GET /api/user_logins/` (proposal data) returns **HTTP 402 Payment Required**
when the org does not have Raw Data API Access. This is the only OpenSolar
endpoint documented to use 402.

Most APIs return 403 for plan restrictions. Do not treat 402 as a billing
UI error.

**Source:** [Proposal Data § Raw Data API Access Required](https://developers.opensolar.com/api/proposal-data/)

**What to do:**

- Map 402 to a tier-block message that names the required plan.
- Cache `api_access` when 402 is seen on this endpoint (definitively not
  Raw Data).
- Keep 402 distinct from 401 (auth) and 403 (permission).

### `design` field is "omitted or null" — both happen

On `GET /api/orgs/:org_id/projects/:id/`, API Access documents `design` as
"omitted or null". Both have been seen.

**Source:** [API Access Plans § Projects](https://developers.opensolar.com/api/api-access-plans/)

**What to do:**

- Tier detection must treat `design === null` and `'design' not in
  response` as the API Access signal.
- Do not assume only one of those shapes.

### Per-project access after disabling the wallet

If an org disables the API Access wallet product, projects purchased
*while the wallet was enabled* retain API access. All other projects lose
API access and webhook functionality.

Tier is not strictly org-level for orgs that toggled the product.

**Source:** [API Access FAQs § What happens after I disable](https://developers.opensolar.com/api/api-access-faqs/)

**What to do:**

- If `list_projects` succeeds but `get_project` on some IDs returns 403,
  mention this case rather than a generic permission failure.
- Do not model per-project wallet state in the tier cache.

### Activation delay up to 5 minutes

After enabling API Access or Raw Data API Access in Wallet, access
changes can take up to 5 minutes.

**Source:** [API Access Plans](https://developers.opensolar.com/api/api-access-plans/)

**What to do:**

- `--check` failures on a freshly enabled wallet should suggest waiting
  5 minutes. Include that hint on tier-related errors.

---

## URL and parameter conventions

### Trailing slashes required on non-GET methods only

Django REST Framework enforces trailing slashes on `POST`, `PUT`, `PATCH`,
`DELETE`. `GET` does not require a trailing slash.

Official examples still use trailing slashes on GET. Copying docs is
safe. Programmatic construction must follow the rule.

**Source:** [API Conventions § Overview](https://developers.opensolar.com/api/api-conventions/)

**What to do:**

- The HTTP client should append a trailing slash for non-GET requests.
- Cover this in a unit test on the wrapper.

### `ordering` parameter: docs disagree with observed behavior

The conventions page says `-` means **ascending** (`ordering: -id`).

The Private Files page says `-` means **descending**, and defaults to
`-modified_date` (newest first). That default only makes sense as
descending.

**Sources:**

- [API Conventions § Lists and Pagination](https://developers.opensolar.com/api/api-conventions/) — `-` is ascending
- [Private Files § Query parameters](https://developers.opensolar.com/api/private-files/) — `-` is descending

**What to do:**

- Treat `-` as **descending** until a runtime ordering test on a known
  endpoint proves otherwise.
- Pagination helpers should take `{ field, direction: 'asc' | 'desc' }`
  and emit the query string. Tool code should not build `ordering` by
  hand.
- Mapping: `desc` → `-field`; `asc` → `field`.

### `range` parameter is URL-encoded JSON

`[0,19]` becomes `%5B0%2C19%5D`. Unusual; most APIs use `offset`/`limit`.

**Source:** [API Conventions § Lists and Pagination](https://developers.opensolar.com/api/api-conventions/)

**What to do:**

- Prefer `limit` + `page` in tools.
- Support `range` in a shared helper if needed; tools should not reach
  for it first.

### `include_parts` and `exclude_parts` are mutually exclusive and only filter `data`

On `GET /projects/:project_id/systems/details/`, pass one or the other,
not both. The docs say both "only affect the contents of the system data
field". Top-level `modules`, `inverters`, `batteries`, `module_groups`,
`incentives`, `adders`, and `other_components` are returned regardless.
The only part name the docs show is `mcs`.

**Source:** [Systems Details](https://developers.opensolar.com/api/system-details/)

**What to do:**

- Enforce with a Zod refinement on `get_system_details`.

### Contacts ordering: `-` is descending; `id` is ignored

`GET /api/orgs/:org_id/contacts/` matches projects: `ordering=-first_name`
and `ordering=-email` are descending, contrary to the conventions page.

`ordering=-id` is silently ignored (field whitelist), not an error.

**Source:** Observed on a live verification org contacts.

**What to do:**

- Expose `first_name`, `family_name`, `email` only.
- Document `-field` as descending in the tool description.
- Do not expose `id` ordering on this endpoint.

---

## Response data

### `roles[].integration_json` is a Python literal, not JSON

Despite the name, the string uses Python `repr()` with single quotes:

```
{'sungage': {'<org-id>': {'sungage_email': 'user@example.com'}}, 'recheck': {...}}
```

`JSON.parse` throws.

Options: leave opaque (current: wholesale redaction in verbose mode);
write a careful literal-to-JSON converter; or ignore the field and use
`org_configs` / feature flags. Prefer the last if integration discovery
is needed — the field also contains PII.

**Source:** Observed in a live verification org verbose org response. Not in official docs.

### `org_configs.integration_key_<vendor>` is a Fernet bundle

For configured integrations, values look like Fernet (`gAAAA` prefix,
version byte `0x80`). Length varies with payload.

Redaction: surgical on `integration_key_<vendor>` — keep keys, replace
values. Pattern `^integration_key_/i` in `src/lib/redaction.ts` covers
new vendors without per-vendor rules.

**Source:** Observed in a live verification org verbose org response.

### `design` field is gzip+base64

Project `design` is base64(gzip(JSON)). Values start with `H4sI` (gzip
magic `1f 8b`).

Node decode: `Buffer.from(design, 'base64')` then `zlib.gunzipSync`, then
`JSON.parse`. On the order of 167KB compressed for a small residential
project; uncompressed is much larger. Server-side parse only; do not pass
the raw blob through LLM context.

Populated only on Raw Data. API Access: omitted or null.

v1: wholesale-redact in verbose mode. `get_project` verbose still replaces `design` with `[REDACTED]`. `get_project_design` gunzips the string. `summary` returns the system count and `system_price_including_tax`. `components` and `energy` stay unmapped: the decompress section still does not name keys for module quantity, component codes, or annual production. `geometry` reports whether `autoFacetsGeoJson` is present and does not return coordinates. `financials` copies finite numbers for pricing keys found on each system object.

Proposal `systems[].data.output` uses the same base64(gzip(JSON)) encoding when it is a string. `get_proposal_data` decodes that string to read annual and monthly kWh and does not return the string. The tool does not send `compress_data`.

**Source:** Observed in a live verification org verbose project response; official
decompress steps on [Projects](https://developers.opensolar.com/api/projects/).
Proposal output: [Proposal Data](https://developers.opensolar.com/api/proposal-data/), retrieved 2026-09-22.

### Contacts list is a bare array

`GET /api/orgs/:org_id/contacts/` returns a JSON array, not
`{ count, next, previous, results }`.

Infer "more pages" from `response.length === limit`. Exact multiples of
`limit` are an edge case.

**Source:** Observed on a live verification org.

### Contact entities have no `created_date` or `modified_date`

Missing on both list and detail. Events, projects, and orgs have those
fields. Closest recency signal is `id` (undocumented assumption).

**Source:** Observed on a live verification org.

### `@os.code` emails are synthetic MyEnergy accounts

`email` matching `<digits>@os.code` is created when a client opens a
proposal-share link without a MyEnergy account. Not deliverable.

Seen on `type: 0` (normal) and `type: 1` (proposal-share). Multiple
contacts can share the same `@os.code` address.

`list_contacts` / `get_contact` add `is_synthetic_email: true`.

**Source:** Observed on a live verification org.

### Events are org-level, not project sub-resources

Events live at `/api/orgs/:org_id/events/:event_id/`, linked via
`project_id` or `project` URL. A project's timeline is `events` (URL
refs) and `events_data` (inlined) on project detail.

`/api/orgs/:org_id/projects/:id/events/` returned 404.

**Source:** Observed on a live verification org.

### Inlined `events_data` vs detail-endpoint events

- `events_data` (from `get_project`): `project_id`, `is_read`,
  `action_id`, inlined `contact_data`.
- Detail `/events/:id/`: `project` URL, `project_data`, `action` URL,
  `contact` URL, `is_all_day`, `user` URL, `archive_for`,
  `location_override`, `repeat`.

Shared: `id`, `event_type_id`, `start`, `end`, `title`, `notes`, `who`,
timestamps.

MCP: `get_event` returns the detail shape plus `event_type_name`,
strips `url`/`org`, enriches `contact_data` when present. Curated
`get_project` includes slim `events`.

**Source:** Observed on a live verification org.

### Event `who` can be "Unknown User" / "Unknown Email"

External integrations (Sungage, DocuSign, …) have no OpenSolar user.
Not a deleted user or auth failure.

**Source:** Observed on two live events linked from one fixture project.

### `event_type_id` is a sparse enum

Ids 0–142 with gaps. Resolved locally in `src/lib/enums/event-types.ts`.
Unknown ids become `"Unknown event type"` rather than failing.

**Source:** Observed across a live verification org payloads; gaps catalogued in the
enum module. Official names: [Events](https://developers.opensolar.com/api/events/).

---

## Endpoint behavior

### `/systems/details/` times out on large projects

OpenSolar recommends scoping with `include_parts`.

**Source:** [Systems Details](https://developers.opensolar.com/api/system-details/)

**What to do:**

- Default `include_parts` to modules, inverters, batteries,
  module_groups, incentives. Because the filter applies only to `data`,
  which the curated output omits, this keeps the upstream response small
  without changing the returned hardware groups.
- Allow override, and describe the parameters as `data` filters.
- 504 messages should say large projects can time out and not to loop.

### 403 means no access, not proof that a record is missing

The Errors page defines 403 as "Not permitted for this user" and lists 404
without further detail. Proposal Data documents that one inaccessible
project in `project_ids` fails the whole request with 403. Treat 403 as a
permission problem; do not read it as evidence that the record does not
exist.

**Source:** [Errors](https://developers.opensolar.com/api/error/), [Proposal Data](https://developers.opensolar.com/api/proposal-data/)

**What to do:**

- Distinct messages for 403 vs 404.
- Proposal data: if *any* `project_ids` entry is inaccessible, the whole
  request fails 403.

### System image creates a file without exposing its id

On a live verification org, a fixture project, `GET .../systems/<fixture-system-uuid>/image/?width=500&height=500` on 2026-09-22 returned `image/jpeg`. The final URL and response headers did not contain `/private_files/{id}`. A following private-files list for that project included a new file tagged System Image.

**Source:** live call 2026-09-22. [System Image](https://developers.opensolar.com/api/system-image/) says the first call can create a private file and to follow redirects. The page shows no response body.

**What to do:** `get_system_image` returns `id: null` when no private file id is exposed. Find that file with `list_private_files`. Do not guess the id from the newest file inside the image tool.

### Contact PUT keeps omitted supported fields

The contacts page documents PUT as the update method and does not say whether omitted fields are cleared. On a live verification org, 2026-09-22, a disposable contact was created with `first_name`, `family_name`, `email`, and `phone`. A following PUT sent only a new `phone`. The next GET kept the other three values and showed the new phone. The fixture was deleted.

**Source:** live call 2026-09-22. [Contacts](https://developers.opensolar.com/api/contacts/)

**What to do:** `update_contact` sends only the supported fields the caller supplied. It does not GET and merge first.

### Webhook logs return HTTP 500 for an empty page

`GET /orgs/:org_id/webhook_process_logs/` documents that an empty `page` returns HTTP 500.

**Source:** [Webhooks Logs](https://developers.opensolar.com/api/webhooks-logs/), retrieved 2026-09-22.

**What to do:** `list_webhook_logs` still sends `page` and `limit`. The description tells the caller that an empty page can return HTTP 500. Do not retry that 500 as if the page exists.

### Webhook queue rows are shaped differently from log rows

Queue rows carry `number_of_attempts`, `next_attempt_at`,
`processing_started_at`, `model_name`, `model_pk`, `event`, and
`foreign_identifier`. `event_queue_name` appears only on log rows.

**Source:** [Webhooks Queue](https://developers.opensolar.com/api/webhooks-queue/), [Webhooks Logs](https://developers.opensolar.com/api/webhooks-logs/), retrieved 2026-09-23.

**What to do:** `list_webhook_queue` returns `model_name`, `event`, and `number_of_attempts` with the attempt timestamps. It does not return `event_queue_name`, `model_pk`, or `foreign_identifier`.

### Document generation: `generate_document` is the recommended endpoint

The page lists `generate_document` as "recommended", `generate_document_pdf` as "legacy", and `generate_document_docx`. `generate_document` takes an optional `file_format` of `pdf` or `csv`; the default depends on the document type (PDF for most, CSV for some). The docs do not describe HTML output.

**Source:** [Generating Project Files](https://developers.opensolar.com/api/generating-project-files/), retrieved 2026-09-23.

**What to do:** `generate_project_document` calls `generate_document` for the type default, `pdf`, and `csv`, and `generate_document_docx` for `docx`. It does not call the legacy PDF endpoint.

### Workflow stages carry `is_archived`

Each entry in `workflow_stages` has its own `is_archived` flag in the workflows sample, separate from the workflow's `is_archived`.

**Source:** [Workflows](https://developers.opensolar.com/api/workflows/), retrieved 2026-09-23.

**What to do:** Curated workflow stages include `is_archived`. `update_project_stage` never resolves `stage_name` to an archived stage; an archived stage can still be set explicitly with `active_stage_id`.

### Connection requests require `notify_roles`

The create-connection page marks only `is_active` and `permission` as optional. `org_name` and `notify_roles` have no optional label.

**Source:** [Creating a connection request](https://developers.opensolar.com/api/creating-a-connection-request/), retrieved 2026-09-23.

**What to do:** `create_connection_request` requires `notify_roles`.

### Sharing a project: `shared_with` replacement semantics are undocumented

The sharing sample sends `PUT /api/orgs/:org_id/projects/:project_id/` with a one-entry `shared_with` list. The page does not say whether shares with other orgs that are not in the body are kept or removed.

**Source:** [Sharing a Project](https://developers.opensolar.com/api/sharing-a-project/), retrieved 2026-09-23.

**What to do:** `share_project` sends the documented one-entry body. Before relying on one project being shared with several orgs, confirm the behavior on a dedicated fixture project and record the result here.

### Only entity sharing has a bulk endpoint

The one documented bulk route is `PUT /api/orgs/:org_id/bulk/:entity_type/`
for sharing entities with connected orgs, which `share_entities` uses.
Everything else is standard CRUD: fifty project creates are fifty POSTs at
10/min per user.

**Source:** [Sharing entities (bulk)](https://developers.opensolar.com/api/sharing-entities-to-a-connected-org-bulk/), [Schema overview](https://developers.opensolar.com/api/schema-overview/)

**What to do:**

- Do not loop inside a tool to fake bulk operations.
- Rate-limit handling belongs in the client.

---

## Rate limits and fair use

Two layers, both binding. Full gate: [terms-release-gate.md](./terms-release-gate.md).

### Contractual ceilings (User Terms 17.8)

- Google Solar API: 1,000/month, 200/day
- Webhooks: 2,000 calls/month
- Everything else: https://developers.opensolar.com/api/throttle

These apply "unless otherwise agreed with us in writing (including under a
commercial plan)". The API Access FAQ says the plan "includes unlimited API
calls and webhook events", so the webhook ceiling may not apply to an org
on API Access. Tool text states the Terms limit with that qualifier.

Exceeding these is a terms breach (17.6). OpenSolar may throttle,
suspend, or terminate under clauses 13 or 15.

### Per-endpoint limits

Published at https://developers.opensolar.com/api/throttle (per user and
per org). Example: create project 10/min per user, 10,000/day per org.

**What to do:**

- Honor 429 on ordinary JSON GET. The client retries at most three attempts. `Retry-After` is used when it is at most 5 seconds. Without that header the waits are 200 ms and then 400 ms. A longer `Retry-After` is returned as 429 with no sleep. POST, PUT, PATCH, DELETE, form upload, file GET, and download are not retried.
- Do not batch through a rate limit inside one tool call.
- Do not expose Google Solar API tools.

---

## Adding an entry

1. Pick a section (or add one).
2. One short paragraph for the quirk.
3. Cite a source URL, or "Observed on org NNNN, YYYY-MM-DD" with the curl
   in `dev-docs/private/` (gitignored).
4. Say what code should do (file, convention).
5. Keep this a reference, not a narrative.
