# Source log

Retrieval dates for OpenSolar and MCP sources used to write the contract
matrix, quirks ledger, and release gate. Re-fetch a row before treating
it as current.

No tokens, passwords, or response bodies are stored here.

Last reviewed: 2026-09-22

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
| Projects | https://developers.opensolar.com/api/projects/ | 2026-09-22 |
| Contacts | https://developers.opensolar.com/api/contacts/ | 2026-08-22 |
| Systems | https://developers.opensolar.com/api/system/ | 2026-08-22 |
| System details | https://developers.opensolar.com/api/system-details/ | 2026-08-22 |
| Orgs | https://developers.opensolar.com/api/orgs/ | 2026-09-22 |
| Roles | https://developers.opensolar.com/api/roles/ | 2026-08-22 |
| Workflows | https://developers.opensolar.com/api/workflows/ | 2026-09-22 |
| Events (type ids) | https://developers.opensolar.com/api/events/ | 2026-08-22 |
| Modules | https://developers.opensolar.com/api/modules/ | 2026-09-22 |
| Inverters | https://developers.opensolar.com/api/inverters/ | 2026-09-22 |
| Batteries | https://developers.opensolar.com/api/batteries/ | 2026-09-22 |
| Other components | https://developers.opensolar.com/api/other-components/ | 2026-09-22 |
| Payment options | https://developers.opensolar.com/api/payment-options/ | 2026-09-22 |
| Pricing schemes | https://developers.opensolar.com/api/pricing-schemes/ | 2026-09-22 |
| Costing | https://developers.opensolar.com/api/costing/ | 2026-09-22 |
| Roof types | https://developers.opensolar.com/api/roof-types/ | 2026-09-22 |
| File tags | https://developers.opensolar.com/api/file-tags/ | 2026-09-22 |
| Proposal data | https://developers.opensolar.com/api/proposal-data/ | 2026-09-22 |
| Private files | https://developers.opensolar.com/api/private-files/ | 2026-09-22 |
| Generating project files | https://developers.opensolar.com/api/generating-project-files/ | 2026-09-22 |
| System image | https://developers.opensolar.com/api/system-image/ | 2026-09-22 |
| Webhooks | https://developers.opensolar.com/api/webhooks/ | 2026-09-22 |
| Webhooks logs | https://developers.opensolar.com/api/webhooks-logs/ | 2026-09-22 |
| Webhooks queue | https://developers.opensolar.com/api/webhooks-queue/ | 2026-09-22 |
| Teams overview | https://developers.opensolar.com/api/teams-overview/ | 2026-09-22 |
| Creating a connection request | https://developers.opensolar.com/api/creating-a-connection-request/ | 2026-09-22 |
| Connected org record schema | https://developers.opensolar.com/api/connected-org-record-schema/ | 2026-09-22 |
| Fetch pending requests | https://developers.opensolar.com/api/fetch-pending-requests/ | 2026-09-22 |
| Accept a pending connection request | https://developers.opensolar.com/api/accept-a-pending-connection-request/ | 2026-09-22 |
| Listing established connections | https://developers.opensolar.com/api/listing-established-connections/ | 2026-09-22 |
| Sharing a project | https://developers.opensolar.com/api/sharing-a-project/ | 2026-09-22 |
| Sharing entities to a connected org (bulk) | https://developers.opensolar.com/api/sharing-entities-to-a-connected-org-bulk/ | 2026-09-22 |
| Disabling a connection | https://developers.opensolar.com/api/disabling-a-connection/ | 2026-09-22 |
| Deleting a connection | https://developers.opensolar.com/api/deleting-a-connection/ | 2026-09-22 |
| Custom permission for Teams | https://developers.opensolar.com/api/custom-permission-for-teams/ | 2026-09-22 |

Re-read on 2026-09-22 during the phase-1 audit and P1-11. The August pages were not re-fetched into git. Pricing schemes, costing, roof types, file tags, and other components were read on 2026-09-22 for the phase-2 reads. No response bodies stored.

Modules, inverters, batteries, and other components were re-read on 2026-09-22 for component activation writes. Each page lists `POST` and `DELETE` on `/:id`. The only sample is a GET list. That material does not establish the request body, required fields, or field semantics, so no create body was guessed.

Pricing schemes were re-read on 2026-09-22 for P4-02. The page lists `POST` and `DELETE` on `/:id`. The only sample is a GET list. That material does not establish the request body, required fields, or field semantics, so no create body was guessed.

Payment options and costings were re-read on 2026-09-22 for P4-03 and P4-04. Each page lists `POST` and `DELETE` on `/:id`. The only sample is a GET list. That material does not establish the request body, required fields, or field semantics, so no create body was guessed.

Workflows were re-read on 2026-09-22 for P4-05. The create sample sends `title`, `is_default`, and `description` on `POST /workflows/`. The page lists `PUT /workflows/:id/` and says a PUT replaces the entity, including stages and actions. The PUT request contract is not established with sufficient confidence. No update body was guessed.

Orgs were re-read on 2026-09-22 for P4-06. The page lists `PUT /orgs/:org_id/` as Update Org. The only sample is Get Org Details, and that response is truncated. The PUT request contract is not established with sufficient confidence, so no update body was guessed.

Private files were read on 2026-09-22 for P5-01. The query table lists `project`, `user_id`, `file_tags`, `file_tags_exclude`, `search`, and `ordering`. It does not list `page` or `limit`. `list_private_files` still sends `page` and `limit` because the task requires a bounded page. `file_contents` is a download URL that expires after one hour. No response body was stored. Model-facing text, image blocks, and PDF resources are this server's delivery. They are not OpenSolar fields. PDF text uses `unpdf`.

Private files were re-read on 2026-09-22 for P5-02. The create sample is multipart `title` and `file_contents=@path`. It does not send `project` or `file_tags`, so those fields are not on `create_private_file`. The update sample is JSON `{"title": "new title"}`. Delete has no body. Those writes were not called on a live org.

Generating project files and system image were read on 2026-09-22 for P5-03 and P5-04. The generate samples are POST with query parameters and no JSON body. A private file reference is documented when `action=save` is set. The page shows no response JSON. The system image sample is `GET .../image/?width=500&height=500` and says to follow redirects. Both calls were then made on org 48389, project 10616552. The proposal `generate_document` path returned a private file id. The 500×500 image returned `image/jpeg` and did not expose a `/private_files/{id}` reference; a following private-files list for that project included a new file tagged System Image. pdf and docx were not called. No response body or image bytes were stored.

Webhooks, webhook logs, and the webhook queue were read on 2026-09-22 for P6-01. The webhooks page documents GET, POST, and PATCH. It does not document DELETE. The create sample sends `endpoint`, `headers` as a stringified JSON object, `enabled`, `debug`, `trigger_fields`, and `payload_fields`. The parameters table does not list `headers`. The plan allowlist does not include it, so `create_webhook` and `update_webhook` do not send or return `headers`. The page shows no webhook response JSON. Logs document `page`, `limit`, and `search`, and say an empty page returns HTTP 500. The queue page does not list `page` or `limit`. `list_webhook_queue` still sends them because the task says the queue is paginated. These calls were not made on a live org. No response body was stored.

Proposal data was re-read on 2026-09-22 for P8-01. `GET /api/user_logins/?project_ids=` takes one project id. The example names `systemOutputAnnualkWh`, `output_monthly_json`, `systemPaybackYear`, `systemNetPresentValue`, `systemIrr`, and `systemReturnOnInvestment`. `data.pricing`, `line_items`, and `payment_options` appear as unexpanded objects, so those objects are not returned. `data.output` may be a gzip+base64 string. The tool decodes that string and does not return it. `compress_data` is not sent. The call was not made on a live org. No response body was stored.

Teams pages were read on 2026-09-22 for P7-01. Create sends `org_name`, and optional `notify_roles`, `is_active`, and `permission`. The tool takes a permission role id and builds that URL. Accept sends `org_to_id`. Disable sends `is_active`. Delete has no body. Share project sends `shared_with` with `org_id`, a permission role URL, and optional `is_shared`. Share entities sends `share_with_ids`, `unshare_with_ids`, `resource`, and `ids`. `resource` is the same value as `entity_type`. The custom-permission sample sends `role_type` 1, `title`, and `permissions` as a JSON string of the printed keys. The list sample also sends `ordering=-id` and `range`. `list_connected_orgs` sends `fieldset=list`, `page`, and `limit`. These calls were not made on a live org. No response body was stored.

Projects were re-read on 2026-09-22 for P8-02, decompress section. The code sample reads `design.systems`. The "What's Inside" list names `system_price_including_tax` on per-system pricing. It describes module quantities, component details, and annual production without naming keys. `get_project_design` returns the system count and that price key. It does not invent the unnamed keys. The call was not made on a live org. No design body was stored.

---

## OpenSolar User Terms

| Source | URL | Retrieved | Notes |
|--------|-----|-----------|-------|
| User Terms & Conditions | https://www.opensolar.com/terms-conditions/ | 2026-08-22 | Clause 17 Access, Fair Use and Interference |
| User Terms & Conditions | https://www.opensolar.com/terms-conditions/ | 2026-09-22 | Re-read in audit + P1-11; clause 17.7 still blocks a shared multi-customer server. No body stored. |

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
The May rows were **not** re-run on 2026-08-22. Event URL and contact
ordering were re-checked on 2026-09-22 via `pnpm test:integration`
(`.env.local`; no bodies stored).

| Org | When | Endpoints / behavior |
|-----|------|----------------------|
| 48389 | 2026-05 (quirks last reviewed 2026-05-12) | Contacts list is a bare array; `ordering=-field` is descending; `ordering=-id` ignored; no contact timestamps; `@os.code` emails; events are org-level (`/projects/:id/events/` → 404); `events_data` vs `/events/:id/` field split; `design` gzip+base64; `integration_json` Python-literal; `integration_key_*` Fernet |
| 48389 | 2026-09-22 | `GET /orgs/48389/events/{id}/` returned the event whose id came from project `events_data` (HTTP success, matching `id`). `GET /orgs/48389/contacts/?ordering=-family_name` was descending by `family_name`. `ordering=-id` produced the same id sequence as the default contacts list (ignored). |
| 48389 | 2026-09-22 | `POST /orgs/48389/contacts/` with `first_name`, `family_name`, `email`, and `phone` was accepted. No other fields were sent. No response body stored. |
| 48389 | 2026-09-22 | `PUT /orgs/48389/contacts/{id}/` with `first_name`, `family_name`, `email`, and `phone` was accepted. The contact was a fixture created for this check. No other fields were sent. No response body stored. |
| 48389 | 2026-09-22 | One fixture contact was created, updated, and deleted (`POST`, `PUT`, then `DELETE` `/orgs/48389/contacts/{id}/`) using `first_name`, `family_name`, `email`, and `phone`. No response body stored. |
| 48389 | 2026-09-22 | `POST /orgs/48389/projects/10616552/generate_document/proposal/?action=save` returned a private file id. The pdf and docx paths were not called. No response body stored. |
| 48389 | 2026-09-22 | `GET /orgs/48389/projects/10616552/systems/20d0ad9c-7d92-4078-b8a3-6051f4a08439/image/?width=500&height=500` returned `image/jpeg`. The final URL and headers did not contain `/private_files/{id}`. A following private-files list for that project included a new file tagged System Image. `include_contents` was false. No image bytes stored. |

**Not live-verified (do not assume):**

| Item | Reason |
|------|--------|
| Component activation create body | Modules, inverters, batteries, and other-components pages list `POST /:id` (retrieved 2026-09-22). The request contract is not established with sufficient confidence. No body was guessed. |
| Pricing scheme create body | The pricing-schemes page lists `POST /:id` (retrieved 2026-09-22). The request contract is not established with sufficient confidence. No body was guessed. |
| Payment option create body | The payment-options page lists `POST /:id` (retrieved 2026-09-22). The request contract is not established with sufficient confidence. No body was guessed. |
| Costing create body | The costing page lists `POST /:id` (retrieved 2026-09-22). The request contract is not established with sufficient confidence. No body was guessed. |
| Workflow update body | The workflows page lists `PUT /workflows/:id/` (retrieved 2026-09-22). The request contract is not established with sufficient confidence. No body was guessed. |
| Org update body | The orgs page lists `PUT /orgs/:org_id/` (retrieved 2026-09-22). The request contract is not established with sufficient confidence. No body was guessed. |
| Private file `page` and `limit` | The private files query table (retrieved 2026-09-22) does not list `page` or `limit`. `list_private_files` sends both because P5-01 requires a bounded page. A live list on org 48389 the same day sent `project`, `page`, `limit`, and `ordering=-created_date` and received a page. |
| Private file create, update, and delete | The page shows the multipart create sample and the JSON title patch (retrieved 2026-09-22). Those calls were not made against a live org. `get_private_file` with `include_contents` was not called either. |
| Generate document pdf and docx bodies | The html `generate_document` path returned an id on org 48389 on 2026-09-22. The pdf and docx paths were not called. The page still shows no response JSON. |
| System image contents | The 500×500 call on org 48389 on 2026-09-22 did not download bytes. `include_contents` and the 10 MB refusal were not live-checked. |
| Webhook response body | The webhooks page (retrieved 2026-09-22) shows request curls and no response JSON. `list_webhooks` expects a bare array and returns id, endpoint, enabled, debug, and the two field lists. |
| Webhook `headers` | The create curl sends `headers` as a stringified JSON object. The parameters table does not list it. The tool does not send or return it. |
| Webhook queue `page` and `limit` | The queue page (retrieved 2026-09-22) does not list `page` or `limit`. `list_webhook_queue` sends both because P6-01 says the queue is paginated. |
| Proposal pricing object keys | The proposal page (retrieved 2026-09-22) shows `data.pricing`, `line_items`, and `payment_options` without listing their keys. `get_proposal_data` does not return those objects. |
| Design module, code, and annual keys | The projects decompress section (retrieved 2026-09-22) names `systems` and `system_price_including_tax`. It does not name keys for module quantity, inverter or battery codes, or annual production. `get_project_design` does not invent them. |
| Connected org list `ordering` and `range` | The listing sample (retrieved 2026-09-22) also sends `ordering=-id` and `range`. `list_connected_orgs` sends `fieldset=list`, `page`, and `limit`. |
| Team writes | The team pages show request curls (retrieved 2026-09-22). Those calls were not made against a live org. Accept, share, and permission-role responses are not shown, so those tools return the request confirmation rather than the upstream body. |
| `GET /contacts/?search=` | Absent from official Contacts query table; no live check in this log. `search_contacts` does not send it. |
| Project list fields used by `search_projects` | Projects page retrieved 2026-09-22. The list example includes `title`, `address`, `business_name`, and `contacts_data` with `email`, `phone`, `first_name`, `family_name`, and `display`. Project `identifier`, `locality`, `state`, and `zip` are on the detail example, not the list example. No search call was made. No response body was stored. |
| Project snapshot fields | The same projects page shows detail fields `payment_option_sold`, `private_files_data`, `shared_with`, `usage`, `events_data`, and `assigned_role_data`. `get_project_snapshot` uses those. It was not called on a live org. No response body was stored. |
| Nested `GET /projects/:project_id/systems/` | Systems docs specify `GET /systems/?fieldset=list&project=` |
| Conventions doc claim that `-` means ascending | Contradicted by Private Files docs and org-48389 contacts |

To promote a row to `live-verified` in the contract matrix, add a dated
row here with org id, endpoint, and what was asserted. Keep payloads out
of git; put curls in `dev-docs/private/` if needed.
