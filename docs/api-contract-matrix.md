# API contract matrix

One row per MCP tool or supporting OpenSolar endpoint. Implementation
work must use this file instead of guessing paths, plans, or query
parameters.

Retrieval dates: [source-log.md](./source-log.md). Empirical extras:
[api-quirks.md](./api-quirks.md).

Last reviewed: 2026-09-22

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
| `list_projects` | live-verified | GET | `/api/orgs/:org_id/projects/` | `page`, `limit`, `fieldset` (`list`, `studio`) | none for default list | n/a | api_access | undocumented quota | Official list example is a **bare array**. `fieldset=list` is documented for list pagination conventions. Current tool does not send `fieldset`. MCP output is always `{ projects, page, limit }`. Default `projects` rows are curated (`id`, `title`, `address`, `created_date`, `modified_date`, deprecated `stage`, `stage_milestone` when known, `workflow.workflow_id` / `workflow.active_stage_id` when OpenSolar sent them). `verbose: true` puts full redacted list objects in `projects`. | [Projects](https://developers.opensolar.com/api/projects/) |
| `get_project` | live-verified | GET | `/api/orgs/:org_id/projects/:id/` | none documented | none | n/a | api_access; `design` requires raw_data | 100/min user, 10,000/day org | `design` omitted or null on API Access. `stage` deprecated (see below). `usage` present on detail. `events` (URL refs) and `events_data` (inlined). Curated MCP output includes `workflow` (`workflow_id`, `active_stage_id`) and `stage_milestone` when present; deprecated `stage` is still returned. Verbose MCP output redacts compressed `design` to `[REDACTED]`. | [Projects](https://developers.opensolar.com/api/projects/), [API Access Plans](https://developers.opensolar.com/api/api-access-plans/) |
| `create_project` | documented | POST | `/api/orgs/:org_id/projects/` | none | none | JSON object; example includes `identifier`, `is_residential`, `lead_source`, `notes`, `lat`, `lon`, `address`, `locality`, `state`, `country_iso2`, `zip`, `number_of_phases`, `roof_type` (URL), `assigned_role` (URL), `contacts_new` (array of contact objects). Trailing slash required. | api_access | 10/min user, 10,000/day org | MCP tool implemented. Integer `roof_type` and `assigned_role` become the documented URLs. `contacts_new` uses the four `create_contact` fields. Output is `id` and `address`. Wallet empty blocks **new** project creation; existing API access continues. Not live-verified. | [Projects](https://developers.opensolar.com/api/projects/), [API Access FAQs](https://developers.opensolar.com/api/api-access-faqs/) |
| `update_project` | documented | PATCH | `/api/orgs/:org_id/projects/:id/` | none | none | Partial project JSON. Do not expose PUT in the MCP. Trailing slash required. | api_access | 10/min user, 10,000/day org (PATCH row) | MCP tool implemented. Same allowlist as create, minus `contacts_new`. At least one field. `stage`, `design`, `workflow`, and `usage` are rejected. PUT stays out of the tool surface. Not live-verified. | [Projects](https://developers.opensolar.com/api/projects/), [Throttle](https://developers.opensolar.com/api/throttle/) |
| `update_project_stage` | documented | PATCH | `/api/orgs/:org_id/projects/:id/` | none | none | See [Workflow stage replacement](#workflow-stage-replacement). Do **not** PATCH deprecated `stage`. | api_access | 10/min user, 10,000/day org | MCP tool implemented. Input is `project_id`, `workflow_id`, and `active_stage_id`. Not live-verified. | [Projects](https://developers.opensolar.com/api/projects/) |
| `update_project_usage` | documented | PATCH | `/api/orgs/:org_id/projects/:id/` | none | none | `{ usage: { usage_data_source, values } }` only. Annual sources are one integer. Period sources are 12, 6, or 4 integers. `estimate` is `Low`, `Medium`, or `High`. | api_access | 10/min user, 10,000/day org | MCP tool implemented. No other project field is sent. Output is `project_id` and `usage_data_source`. Not live-verified. | [Projects](https://developers.opensolar.com/api/projects/) |
| `delete_project` | documented | DELETE | `/api/orgs/:org_id/projects/:id/` | none | none | none | api_access | undocumented quota | MCP tool implemented. Input is `project_id`. Result is `{ id, deleted: true }`. The upstream body is not returned. Not live-verified. | [Projects](https://developers.opensolar.com/api/projects/) |
| `list_contacts` | live-verified | GET | `/api/orgs/:org_id/contacts/` | documented: `page`, `limit`. observed: `ordering` (`first_name`, `family_name`, `email`; `-` = descending). `ordering=-id` silently ignored. | none | n/a | api_access | undocumented quota | Bare JSON array, no `count`/`next`. No `created_date` / `modified_date` on the entity. | [Contacts](https://developers.opensolar.com/api/contacts/), [api-quirks.md](./api-quirks.md) |
| `search_contacts` | deferred | GET | `/api/orgs/:org_id/contacts/` | Official table: `page`, `limit` only. Roadmap assumed `?search=`. **Do not assume server-side search until independently live-verified.** | none | n/a | api_access | undocumented quota | Not documented. Not live-verified. Implementation must not add a `search` query parameter on speculation. | [Contacts](https://developers.opensolar.com/api/contacts/) |
| `get_contact` | live-verified | GET | `/api/orgs/:org_id/contacts/:id/` | none | none | n/a | api_access | undocumented quota | Same entity gaps as list (no created/modified timestamps). | [Contacts](https://developers.opensolar.com/api/contacts/) |
| `create_contact` | live-verified | POST | `/api/orgs/:org_id/contacts/` | none | none | MCP sends only `first_name`, `family_name`, `email`, and `phone`. `date_of_birth` and `gender` are not sent. Trailing slash required. | api_access | undocumented quota | Org 48389 accepted that body on 2026-09-22. Output is the curated contact. | [Contacts](https://developers.opensolar.com/api/contacts/) |
| `update_contact` | live-verified | PUT | `/api/orgs/:org_id/contacts/:id/` | none | none | Same four fields as `create_contact`. At least one required. The contacts page documents PUT, not PATCH. | api_access | undocumented quota | Org 48389 accepted that body on a fixture contact on 2026-09-22. Output is the curated contact. | [Contacts](https://developers.opensolar.com/api/contacts/) |
| `delete_contact` | live-verified | DELETE | `/api/orgs/:org_id/contacts/:id/` | none | none | none | api_access | undocumented quota | MCP tool implemented. Input is `contact_id`. Result is `{ id, deleted: true }`. Org 48389 accepted DELETE of a fixture contact on 2026-09-22. The upstream body is not returned. | [Contacts](https://developers.opensolar.com/api/contacts/) |
| `list_project_systems` | documented | GET | `/api/orgs/:org_id/systems/` | `fieldset=list` **required**, `page`, `limit`, `project` (id) | `fieldset=list` | n/a | api_access | undocumented quota | Bare array in the official example. MCP sends `fieldset=list`, `project`, `page`, and `limit`. Curated row: `id`, `uuid`, `name`, `kw_stc`, `module_quantity`, `battery_total_kwh`, `output_annual_kwh`, `price_including_tax`. Nested `/projects/:project_id/systems/` is not the list path. | [Systems](https://developers.opensolar.com/api/system/) |
| `get_system` | documented | GET | `/api/orgs/:org_id/systems/:id/` | `fieldset=list` **required** | `fieldset=list` | n/a | api_access | undocumented quota | MCP sends `fieldset=list`. Same curated fields as a list row, plus `modules`, `inverters`, and `batteries` as `code`, `manufacturer_name`, and `quantity` when present. | [Systems](https://developers.opensolar.com/api/system/), [API Access FAQs](https://developers.opensolar.com/api/api-access-faqs/) |
| `get_system_details` | documented | GET | `/api/orgs/:org_id/projects/:project_id/systems/details/` | `limit_to_sold`, `include_parts`, `exclude_parts` (mutually exclusive) | none | n/a | api_access; `custom_data` requires raw_data | 60/min user, 10,000/day org | MCP default `include_parts` is `modules,inverters,batteries,module_groups,incentives`. A call that sets both part filters is rejected before HTTP. Timeout is 120 seconds. Curated output omits `custom_data`. Teams-shared projects cannot use this endpoint. | [System Details](https://developers.opensolar.com/api/system-details/), [API Access Plans](https://developers.opensolar.com/api/api-access-plans/) |
| `get_system_image` | documented | GET | `/api/orgs/:org_id/projects/:project_id/systems/:uuid/image/` | `width`, `height` (both required) | none | n/a | api_access | undocumented quota | The server follows redirects. The first call can create a private file. Default result is `id` when a `private_files` id is exposed, plus `content_type`. `include_contents: true` returns the image and refuses a body over 10 MB. The image URL is not returned. Timeout is 120 seconds. Live-checked 2026-09-22 on org 48389: a 500×500 call returned `image/jpeg` and no private file id. A following private-files list included a new System Image file. `include_contents` was not called. | [System Image](https://developers.opensolar.com/api/system-image/) |
| `list_modules` | documented | GET | `/api/orgs/:org_id/component_module_activations/` | `page`, `limit` | none | n/a | api_access | undocumented quota | Bare array. MCP output is `{ modules, page, limit }`. Curated row: `id`, `code`, `manufacturer_name`, `is_default`, `is_archived`. The `data` spec blob is omitted. | [Modules](https://developers.opensolar.com/api/modules/) |
| `get_module` | documented | GET | `/api/orgs/:org_id/component_module_activations/:id/` | none | none | n/a | api_access | undocumented quota | One curated activation row. The `data` spec blob is omitted. | [Modules](https://developers.opensolar.com/api/modules/) |
| `list_inverters` | documented | GET | `/api/orgs/:org_id/component_inverter_activations/` | `page`, `limit` | none | n/a | api_access | undocumented quota | Bare array. MCP output is `{ inverters, page, limit }`. Same curated row as modules. `data` is omitted. | [Inverters](https://developers.opensolar.com/api/inverters/) |
| `get_inverter` | documented | GET | `/api/orgs/:org_id/component_inverter_activations/:id/` | none | none | n/a | api_access | undocumented quota | One curated activation row. `data` is omitted. | [Inverters](https://developers.opensolar.com/api/inverters/) |
| `list_batteries` | documented | GET | `/api/orgs/:org_id/component_battery_activations/` | `page`, `limit` | none | n/a | api_access | undocumented quota | Bare array. MCP output is `{ batteries, page, limit }`. Same curated row as modules. `data` is omitted. | [Batteries](https://developers.opensolar.com/api/batteries/) |
| `get_battery` | documented | GET | `/api/orgs/:org_id/component_battery_activations/:id/` | none | none | n/a | api_access | undocumented quota | One curated activation row. `data` is omitted. | [Batteries](https://developers.opensolar.com/api/batteries/) |
| `list_other_components` | documented | GET | `/api/orgs/:org_id/component_other_activations/` | `page`, `limit` | none | n/a | api_access | undocumented quota | Bare array. MCP output is `{ other_components, page, limit }`. Same curated row as modules. `data` is omitted. | [Other components](https://developers.opensolar.com/api/other-components/) |
| `get_other_component` | documented | GET | `/api/orgs/:org_id/component_other_activations/:id/` | none | none | n/a | api_access | undocumented quota | One curated activation row. `data` is omitted. | [Other components](https://developers.opensolar.com/api/other-components/) |
| `list_workflows` | documented | GET | `/api/orgs/:org_id/workflows/` | `page`, `limit`, `is_default`, `is_archived` | none | n/a | api_access | undocumented quota | Bare array. MCP list sends `page` and `limit` only. Curated stages are `id`, `title`, `milestone`, and `order`. Actions are omitted. | [Workflows](https://developers.opensolar.com/api/workflows/) |
| `get_workflow` | documented | GET | `/api/orgs/:org_id/workflows/:id/` | none | none | n/a | api_access | undocumented quota | One curated workflow. Same stage fields as the list. Actions are omitted. | [Workflows](https://developers.opensolar.com/api/workflows/) |
| `create_workflow` | documented | POST | `/api/orgs/:org_id/workflows/` | none | none | `title` (required), optional `is_default`, optional `description` | api_access | undocumented quota | MCP tool implemented. Sample fields only. Result is the curated workflow, including assigned stages. Actions are omitted. Not live-verified. | [Workflows](https://developers.opensolar.com/api/workflows/) |
| `update_workflow` | documented | PUT | `/api/orgs/:org_id/workflows/:id/` | none | none | none published | api_access | undocumented quota | Page says PUT replaces the entity, including stages and actions, and shows no request example (retrieved 2026-09-22). No update tool. No body guessed. | [Workflows](https://developers.opensolar.com/api/workflows/), [source-log.md](./source-log.md) |
| `delete_workflow` | documented | DELETE | `/api/orgs/:org_id/workflows/:id/` | none | none | none | api_access | undocumented quota | MCP tool implemented. Input is `id`. Result is `{ id, deleted: true }`. The upstream body is not returned. Not live-verified. | [Workflows](https://developers.opensolar.com/api/workflows/) |
| `get_org` | live-verified | GET | `/api/orgs/:org_id/` | none | none | n/a | api_access | undocumented quota | Verbose payload includes `roles[].integration_json` (Python-literal) and `org_configs.integration_key_*` (Fernet). | [Orgs](https://developers.opensolar.com/api/orgs/) |
| `update_org` | documented | PUT | `/api/orgs/:org_id/` | none | none | none published | api_access | undocumented quota | Page lists Update Org and shows no request example (retrieved 2026-09-22). No update tool. No body guessed. | [Orgs](https://developers.opensolar.com/api/orgs/), [source-log.md](./source-log.md) |
| `list_roles` | documented | GET | `/api/orgs/:org_id/roles/` | none on list | none on list | n/a | api_access | undocumented quota | Bare array. MCP list sends no query. Curated row: `id`, `display`, `email`, `phone`, `job_title`, `is_admin`. `api_key_chat` is absent, not redacted in place. | [Roles](https://developers.opensolar.com/api/roles/) |
| `get_role` | documented | GET | `/api/orgs/:org_id/roles/:id/` | optional `fieldset=list` only | none | n/a | api_access | undocumented quota | Same curated fields as the list. `api_key_chat` is absent. MCP does not send `ordering`, `range`, `page`, or `limit`. | [Roles](https://developers.opensolar.com/api/roles/) |
| `get_event` | live-verified | GET | `/api/orgs/:org_id/events/:event_id/` | none documented on this page (page is an enum table) | none | n/a | api_access | undocumented quota | Org-level resource. Nested `/projects/:id/events/` returned 404. Inlined `events_data` on project differs from detail (see quirks). | [Events](https://developers.opensolar.com/api/events/), [api-quirks.md](./api-quirks.md) |
| `list_event_types` | documented | — | none | none | none | n/a | none | n/a | Copied events-page id table. MCP returns `{ event_types }` as `id` and `title`. Gaps are kept. No HTTP call. | [Events](https://developers.opensolar.com/api/events/) |
| `list_payment_options` | documented | GET | `/api/orgs/:org_id/payment_options/` | `page`, `limit`, `priority`, `auto_apply_enabled`, `payment_type` (`cash`, `loan`, `loan_advanced`, `ppa`, `regular_payment`, `lease`) | none | n/a | api_access | undocumented quota | Bare array. MCP output is `{ payment_options, page, limit }`. Curated row: `id`, `title`, `payment_type`, `priority`, `auto_apply_enabled`, `is_archived`. `configuration_json` is omitted. Optional filters are sent only when set. | [Payment Options](https://developers.opensolar.com/api/payment-options/) |
| `get_payment_option` | documented | GET | `/api/orgs/:org_id/payment_options/:id/` | none | none | n/a | api_access | undocumented quota | One curated payment option. `configuration_json` is omitted. No list filters. | [Payment Options](https://developers.opensolar.com/api/payment-options/) |
| `create_payment_option` | documented | POST | `/api/orgs/:org_id/payment_options/:id/` | none | none | none published | api_access | undocumented quota | Page lists `POST` on `/:id` and shows no request example (retrieved 2026-09-22). No create tool. No body guessed. | [Payment Options](https://developers.opensolar.com/api/payment-options/), [source-log.md](./source-log.md) |
| `delete_payment_option` | documented | DELETE | `/api/orgs/:org_id/payment_options/:id/` | none | none | none | api_access | undocumented quota | MCP tool implemented. Input is `id`. Result is `{ id, deleted: true }`. The upstream body is not returned. Not live-verified. | [Payment Options](https://developers.opensolar.com/api/payment-options/) |
| `list_pricing_schemes` | documented | GET | `/api/orgs/:org_id/pricing_schemes/` | `page`, `limit`, `priority` (int), `auto_apply_enabled` (`true`, `false`), `pricing_formula` (`Markup Percentage`, `Price Per Watt`, `Price Per Watt By Size`, `Fixed Price`) | none | n/a | api_access | undocumented quota | Bare array. MCP output is `{ pricing_schemes, page, limit }`. Curated row: `id`, `title`, `pricing_formula`, `priority`, `auto_apply_enabled`, `is_archived`. `pricing_formula` is a string so values outside the filter list still parse. `configuration_json` is omitted. Optional filters are sent only when set. | [Pricing schemes](https://developers.opensolar.com/api/pricing-schemes/) |
| `get_pricing_scheme` | documented | GET | `/api/orgs/:org_id/pricing_schemes/:id/` | none | none | n/a | api_access | undocumented quota | One curated pricing scheme. `configuration_json` is omitted. No list filters. | [Pricing schemes](https://developers.opensolar.com/api/pricing-schemes/) |
| `create_pricing_scheme` | documented | POST | `/api/orgs/:org_id/pricing_schemes/:id/` | none | none | none published | api_access | undocumented quota | Page lists `POST` on `/:id` and shows no request example (retrieved 2026-09-22). No create tool. No body guessed. | [Pricing schemes](https://developers.opensolar.com/api/pricing-schemes/), [source-log.md](./source-log.md) |
| `delete_pricing_scheme` | documented | DELETE | `/api/orgs/:org_id/pricing_schemes/:id/` | none | none | none | api_access | undocumented quota | MCP tool implemented. Input is `id`. Result is `{ id, deleted: true }`. The upstream body is not returned. Not live-verified. | [Pricing schemes](https://developers.opensolar.com/api/pricing-schemes/) |
| `list_costings` | documented | GET | `/api/orgs/:org_id/costings/` | `page`, `limit`, `priority` (`true`, `false`) | none | n/a | api_access | undocumented quota | Bare array. `priority` on this page is a boolean, not an int. MCP output is `{ costings, page, limit }`. Curated row: `id`, `title`, `description`, `priority`. Per-unit rate fields are omitted. The boolean filter is sent only when set. | [Costing](https://developers.opensolar.com/api/costing/) |
| `get_costing` | documented | GET | `/api/orgs/:org_id/costings/:id/` | none | none | n/a | api_access | undocumented quota | One curated costing. Per-unit rate fields are omitted. No list filters. | [Costing](https://developers.opensolar.com/api/costing/) |
| `create_costing` | documented | POST | `/api/orgs/:org_id/costings/:id/` | none | none | none published | api_access | undocumented quota | Page lists `POST` on `/:id` and shows no request example (retrieved 2026-09-22). No create tool. No body guessed. | [Costing](https://developers.opensolar.com/api/costing/), [source-log.md](./source-log.md) |
| `delete_costing` | documented | DELETE | `/api/orgs/:org_id/costings/:id/` | none | none | none | api_access | undocumented quota | MCP tool implemented. Input is `id`. Result is `{ id, deleted: true }`. The upstream body is not returned. Not live-verified. | [Costing](https://developers.opensolar.com/api/costing/) |
| `list_roof_types` | documented | — | none | none | none | n/a | none | n/a | Copied roof-type table. MCP returns `{ roof_types }` as `id` and `title` (docs column is Definition). No HTTP call. | [Roof Types](https://developers.opensolar.com/api/roof-types/) |
| `list_file_tags` | documented | — | none | none | none | n/a | none | n/a | Copied file-tag titles. MCP returns `{ file_tags }` as `title` only. The title is the identifier. No HTTP call. | [File Tags](https://developers.opensolar.com/api/file-tags/) |
| `list_private_files` | documented | GET | `/api/orgs/:org_id/private_files/` | documented: `project`, `user_id`, `file_tags`, `file_tags_exclude`, `search`, `ordering`. Tool also sends `page` and `limit` (not on the query table; retrieved 2026-09-22). | none | n/a | api_access | 1000/day org | Bare array. MCP output is `{ private_files, page, limit }`. Curated row: `id`, `title`, file-tag titles, `project_id`. `file_contents` is omitted. Optional filters are sent only when set. `project_id` is sent as `project`. | [Private Files](https://developers.opensolar.com/api/private-files/), [source-log.md](./source-log.md) |
| `get_private_file` | documented | GET | `/api/orgs/:org_id/private_files/:file_id/` | none | none | n/a | api_access | 1000/day org | One curated file plus `size` (`filesize`) and `content_type` when present. `include_contents: true` downloads `file_contents` on the server. Structured contents are text or base64. Text copied into model context is capped at 100,000 characters and sets `truncated`. Images are also an MCP image block. PDFs also include extracted text and an `application/pdf` resource at `opensolar://private-files/{id}`. Bodies over 10 MB are refused. The download URL is not returned. Not live-verified. | [Private Files](https://developers.opensolar.com/api/private-files/) |
| `create_private_file` | documented | POST | `/api/orgs/:org_id/private_files/` | none | none | multipart `title`, `file_contents` | api_access | 1000/day org | MCP tool takes a filesystem path and `title`. The server streams the file. The create sample does not send `project` or `file_tags`, so those fields are not sent. Result is the curated file. The download URL is omitted. Not live-verified. | [Private Files](https://developers.opensolar.com/api/private-files/), [source-log.md](./source-log.md) |
| `update_private_file` | documented | PATCH | `/api/orgs/:org_id/private_files/:file_id/` | none | none | `{ title }` | api_access | 1000/day org | The published sample sends only `title`. Result is the curated file. The download URL is omitted. Not live-verified. | [Private Files](https://developers.opensolar.com/api/private-files/) |
| `delete_private_file` | documented | DELETE | `/api/orgs/:org_id/private_files/:file_id/` | none | none | none | api_access | 1000/day org | Input is `id`. Result is `{ id, deleted: true }`. The upstream body is not returned. Not live-verified. | [Private Files](https://developers.opensolar.com/api/private-files/) |
| `generate_project_document` | documented | POST | `/api/orgs/:org_id/projects/:project_id/generate_document/:document_type/` and the `_pdf` and `_docx` variants | `action=save` | none | no JSON body | api_access | undocumented quota | `format` selects the path: `html` is `generate_document`, `pdf` is `generate_document_pdf`, `docx` is `generate_document_docx`. The tool sends `action=save` and returns `{ id }`. File bytes are not returned. The page shows no response body. Live-checked 2026-09-22 on org 48389: proposal with format `html` returned a private file id. pdf and docx were not called. | [Generating Project Files](https://developers.opensolar.com/api/generating-project-files/), [source-log.md](./source-log.md) |
| `list_webhooks` | documented | GET | `/api/orgs/:org_id/webhooks/` | none | none | n/a | api_access | User Terms 2,000 events/month | The page shows no response JSON and no page parameters. MCP output is `{ webhooks }`. Curated row: `id`, `endpoint`, `enabled`, `debug`, `trigger_fields`, `payload_fields`. `headers` is omitted. Not live-verified. | [Webhooks](https://developers.opensolar.com/api/webhooks/), [source-log.md](./source-log.md) |
| `create_webhook` | documented | POST | `/api/orgs/:org_id/webhooks/` | none | none | `endpoint`, `enabled`, `debug`; optional `trigger_fields`, `payload_fields` | api_access | User Terms 2,000 events/month | Required fields match the parameters table. Unset field lists are omitted so OpenSolar applies its defaults. The create curl also sends `headers`; the tool does not. Result is the curated webhook. Not live-verified. | [Webhooks](https://developers.opensolar.com/api/webhooks/), [source-log.md](./source-log.md) |
| `update_webhook` | documented | PATCH | `/api/orgs/:org_id/webhooks/:id/` | none | none | any of `endpoint`, `enabled`, `debug`, `trigger_fields`, `payload_fields` | api_access | User Terms 2,000 events/month | The sample sends `enabled`, `trigger_fields`, and `payload_fields`. The parameters table also lists `endpoint` and `debug`, so those are accepted. At least one field besides id. A blank field list on an existing webhook is treated as null. No delete tool. Not live-verified. | [Webhooks](https://developers.opensolar.com/api/webhooks/), [source-log.md](./source-log.md) |
| `list_webhook_logs` | documented | GET | `/api/orgs/:org_id/webhook_process_logs/` | `page`, `limit`, optional `search` | none | n/a | api_access | User Terms 2,000 events/month | Bare array. MCP output is `{ webhook_logs, page, limit }`. Curated row: `id`, `webhook_id`, `event_queue_name`, `created_date`, `modified_date`, `event_timestamp`. An empty page can return HTTP 500. Delivery notes are omitted. `format=csv` is not sent. Not live-verified. | [Webhooks Logs](https://developers.opensolar.com/api/webhooks-logs/) |
| `list_webhook_queue` | documented | GET | `/api/orgs/:org_id/webhook_queue_models/` | tool sends `page` and `limit` (not on the page; retrieved 2026-09-22) | none | n/a | api_access | User Terms 2,000 events/month | Bare array. MCP output is `{ webhook_queue, page, limit }`. Curated row: `id`, `webhook_id`, `event_queue_name`, `next_attempt_at`, `processing_started_at`. Attempt counts and model fields are omitted. `format=csv` is not sent. Not live-verified. | [Webhooks Queue](https://developers.opensolar.com/api/webhooks-queue/), [source-log.md](./source-log.md) |
| `get_proposal_data` | documented | GET | `/api/user_logins/` | `project_ids` (one id) | none | n/a | raw_data | 100/min user, 10,000/day org | One project id. HTTP 402 without Raw Data. HTTP 403 if that project is inaccessible. Curated systems: name, annual kWh, monthly kWh, payback year, net present value, IRR, return on investment. A string `data.output` is gzip+base64 and is decoded before those numbers are read. Design, panel coordinates, pricing objects, and compressed strings are omitted. `expo_enabled`, `compress_data`, `include_unsold`, and `language` are not sent. Not live-verified. | [Proposal Data](https://developers.opensolar.com/api/proposal-data/), [source-log.md](./source-log.md) |
| `get_project_design` | documented | GET | `/api/orgs/:org_id/projects/:id/` | none | none | n/a | raw_data | 100/min user, 10,000/day org | Reads `design`. Missing or null returns `design_available: false`. A string is gzip+base64. Summary is `system_count` and `system_price_including_tax` on each `systems` item. The decompress section does not name keys for module quantity, component codes, or annual production, so those are not returned. The compressed string is not returned. `get_project` verbose still replaces `design` with `[REDACTED]`. Not live-verified. | [Projects](https://developers.opensolar.com/api/projects/), [source-log.md](./source-log.md) |
| `list_connected_orgs` | documented | GET | `/api/orgs/:org_id/connected_orgs/` | `fieldset=list`, `page`, `limit` | list | n/a | api_access | 100/day user and org | The sample also sends `ordering` and `range`. Those are not sent. Curated row: `id`, `org_name`, `partner_org_id`, `permission_role_id`, `notify_roles`, `is_active`, `is_other_active`, `is_other_enabled`. URLs are not returned. Not live-verified. | [Listing established connections](https://developers.opensolar.com/api/listing-established-connections/), [source-log.md](./source-log.md) |
| `list_connection_requests` | documented | GET | `/api/orgs/:org_id/connected_orgs/pending/` | none | none | n/a | api_access | 100/day user and org | Bare array. Curated row: `item_id`, `org_from_id`, `org_from_name`, `org_to_id`. Not live-verified. | [Fetch pending requests](https://developers.opensolar.com/api/fetch-pending-requests/) |
| `create_connection_request` | documented | POST | `/api/orgs/:org_id/connected_orgs/` | none | none | `org_name`; optional `notify_roles`, `is_active`, `permission` | api_access | 100/day user and org | `permission` is built from `permission_role_id`. Unset optional fields are omitted. Result is the curated connection. Not live-verified. | [Creating a connection request](https://developers.opensolar.com/api/creating-a-connection-request/) |
| `accept_connection_request` | documented | POST | `/api/orgs/:org_id/connected_orgs/accept_connection/` | none | none | `org_to_id` | api_access | 100/day user and org | The page shows no response JSON. Result is `{ org_to_id }`. Not live-verified. | [Accept a pending connection request](https://developers.opensolar.com/api/accept-a-pending-connection-request/) |
| `update_connection` | documented | PATCH | `/api/orgs/:org_id/connected_orgs/:id/` | none | none | `is_active` | api_access | 100/day user and org | `false` disables sharing both ways. `true` enables it again. Result is the curated connection. Not live-verified. | [Disabling a connection](https://developers.opensolar.com/api/disabling-a-connection/) |
| `delete_connection` | documented | DELETE | `/api/orgs/:org_id/connected_orgs/:id/` | none | none | none | api_access | 100/day user and org | Result is `{ id, deleted: true }`. The upstream body is not returned. Not live-verified. | [Deleting a connection](https://developers.opensolar.com/api/deleting-a-connection/) |
| `share_project` | documented | PUT | `/api/orgs/:org_id/projects/:id/` | none | none | `shared_with` (`org_id`, `permission`, optional `is_shared`) | api_access | 100/min user, 10,000/day org | One org per call. `permission` is built from `permission_role_id`. Omitted `is_shared` is left off the body. The project body is not returned. Not live-verified. | [Sharing a Project](https://developers.opensolar.com/api/sharing-a-project/) |
| `share_entities` | documented | PUT | `/api/orgs/:org_id/bulk/:entity_type/` | none | none | `share_with_ids`, `unshare_with_ids`, `resource`, `ids` | api_access | undocumented quota | `resource` is the same value as `entity_type`. The page's sample URL is missing a slash; the tool uses the documented path. The upstream body is not returned. Not live-verified. | [Sharing entities (bulk)](https://developers.opensolar.com/api/sharing-entities-to-a-connected-org-bulk/) |
| `create_permission_role` | documented | POST | `/api/orgs/:org_id/permissions_role/` | none | none | `role_type`, `title`, `permissions` | api_access | undocumented quota | `role_type` is always 1. `permissions` is the page's key set, stringified. Result is `{ id, title }`. Not live-verified. | [Custom permission for Teams](https://developers.opensolar.com/api/custom-permission-for-teams/) |

---

## Supporting endpoints

| Name | Status | Method | Path | Query | Fieldset | Write payload | Plan | Throttle | Notes | Source |
|------|--------|--------|------|-------|----------|---------------|------|----------|-------|--------|
| Bearer token | documented | POST | `/api-token-auth/` | n/a | n/a | `{ username, password, token? }` (`token` = MFA) | none | undocumented quota | MCP does not call this. Users paste a token. Machine-user recommended (7-day expiry otherwise). | [Getting Bearer Tokens](https://developers.opensolar.com/api/getting-bearer-tokens/) |
| Fetch token | documented | GET | `/api/fetch_token/` | `org_id` optional | n/a | n/a | none | undocumented quota | Session/token refresh. Not used in v1. | [Getting Bearer Tokens](https://developers.opensolar.com/api/getting-bearer-tokens/) |
| Trailing slashes | documented | POST/PUT/PATCH/DELETE | all mutating paths | — | — | — | — | — | Trailing `/` enforced except on GET. | [API Conventions](https://developers.opensolar.com/api/api-conventions/) |

---

## Deferred endpoints (do not implement in v1)

| Name | Status | Method | Path | Query | Fieldset | Write payload | Plan | Throttle | Notes | Source |
|------|--------|--------|------|-------|----------|---------------|------|----------|-------|--------|
| Google Solar API | deferred | — | not exposed as an MCP tool | — | — | — | — | ToS: 1,000/month and 200/day | Contractual ceiling, not only an HTTP throttle. | [User Terms §17.8](https://www.opensolar.com/terms-conditions/), [terms-release-gate.md](./terms-release-gate.md) |
| Batch / bulk project ops | deferred | — | none | — | — | — | — | create is 10/min | OpenSolar has no batch project API. Do not loop inside a tool. | [Schema overview](https://developers.opensolar.com/api/schema-overview/), [Throttle](https://developers.opensolar.com/api/throttle/) |
| Component activation creates | documented | POST | `/api/orgs/:org_id/component_*_activations/:id/` | none | none | none published | api_access | undocumented quota | Pages list `POST` on `/:id` and show no request example (retrieved 2026-09-22). No create tool. No body guessed. | [Modules](https://developers.opensolar.com/api/modules/), [Inverters](https://developers.opensolar.com/api/inverters/), [Batteries](https://developers.opensolar.com/api/batteries/), [Other components](https://developers.opensolar.com/api/other-components/), [source-log.md](./source-log.md) |
| Component activation deletes | documented | DELETE | `/api/orgs/:org_id/component_*_activations/:id/` | none | none | none | api_access | undocumented quota | MCP delete tools implemented. Input is `id`. Result is `{ id, deleted: true }`. The upstream body is not returned. Not live-verified. | same component pages |

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

Curated `list_projects` and `get_project` return `workflow` ids
(`workflow_id`, `active_stage_id`) when OpenSolar sent them, plus
`stage_milestone` for the numeric `stage`. Deprecated `stage` is still
present on those curated objects.

Status: **deprecated** (`stage`) + **documented** (`workflow.active_stage_id`).

---

## Workflow stage replacement

`update_project_stage` is implemented. It PATCHes the project, not
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
(verbose). `update_project_usage` PATCHes this object and nothing else.
That write was not live-verified.

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
component activations, workflows, pricing schemes, and costings are
documented as **bare arrays**.
