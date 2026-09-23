# Source log

This file records the external sources and live checks used to define OpenSolar MCP's API contracts. It is an evidence index, not an implementation history.

No credentials, customer data, signed file URLs, or live response bodies are stored here.

Last reviewed: 2026-09-23

## OpenSolar API documentation

Base: https://developers.opensolar.com/api/

| Topic | URL | Last checked |
| --- | --- | --- |
| API introduction | https://developers.opensolar.com/api/ | 2026-08-22 |
| API conventions | https://developers.opensolar.com/api/api-conventions/ | 2026-08-22 |
| Throttle limits | https://developers.opensolar.com/api/throttle/ | 2026-08-22 |
| Errors | https://developers.opensolar.com/api/error/ | 2026-08-22 |
| API access plans | https://developers.opensolar.com/api/api-access-plans/ | 2026-08-22 |
| API access FAQs | https://developers.opensolar.com/api/api-access-faqs/ | 2026-08-22 |
| Bearer tokens | https://developers.opensolar.com/api/getting-bearer-tokens/ | 2026-08-22 |
| Schema overview | https://developers.opensolar.com/api/schema-overview/ | 2026-08-22 |
| Projects | https://developers.opensolar.com/api/projects/ | 2026-09-22 |
| Contacts | https://developers.opensolar.com/api/contacts/ | 2026-08-22 |
| Systems | https://developers.opensolar.com/api/system/ | 2026-08-22 |
| System details | https://developers.opensolar.com/api/system-details/ | 2026-08-22 |
| Organisations | https://developers.opensolar.com/api/orgs/ | 2026-09-22 |
| Roles | https://developers.opensolar.com/api/roles/ | 2026-08-22 |
| Workflows | https://developers.opensolar.com/api/workflows/ | 2026-09-22 |
| Events | https://developers.opensolar.com/api/events/ | 2026-08-22 |
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
| Webhook logs | https://developers.opensolar.com/api/webhooks-logs/ | 2026-09-22 |
| Webhook queue | https://developers.opensolar.com/api/webhooks-queue/ | 2026-09-22 |
| Teams overview | https://developers.opensolar.com/api/teams-overview/ | 2026-09-22 |
| Create connection request | https://developers.opensolar.com/api/creating-a-connection-request/ | 2026-09-22 |
| Shared projects and entities | https://developers.opensolar.com/api/accessing-shared-projects-and-entities/ | 2026-09-22 |
| Connected-org schema | https://developers.opensolar.com/api/connected-org-record-schema/ | 2026-09-22 |
| Pending connection requests | https://developers.opensolar.com/api/fetch-pending-requests/ | 2026-09-22 |
| Accept connection request | https://developers.opensolar.com/api/accept-a-pending-connection-request/ | 2026-09-22 |
| Established connections | https://developers.opensolar.com/api/listing-established-connections/ | 2026-09-22 |
| Share project | https://developers.opensolar.com/api/sharing-a-project/ | 2026-09-22 |
| Bulk entity sharing | https://developers.opensolar.com/api/sharing-entities-to-a-connected-org-bulk/ | 2026-09-22 |
| Disable connection | https://developers.opensolar.com/api/disabling-a-connection/ | 2026-09-22 |
| Delete connection | https://developers.opensolar.com/api/deleting-a-connection/ | 2026-09-22 |
| Custom Teams permission | https://developers.opensolar.com/api/custom-permission-for-teams/ | 2026-09-22 |

## Contract notes

| Area | Documented evidence | Repository treatment |
| --- | --- | --- |
| Component activation create | Endpoint family lists POST, but the request body and required fields are not established | Create tools are not registered |
| Pricing scheme create | POST is listed without a sufficiently clear request contract | Create tool is not registered |
| Payment option create | POST is listed without a sufficiently clear request contract | Create tool is not registered |
| Costing create | POST is listed without a sufficiently clear request contract | Create tool is not registered |
| Workflow update | PUT is listed, but replacement semantics and request shape are not established in enough detail | Update tool is not registered |
| Organisation update | PUT is listed without a sufficiently clear request contract | Update tool is not registered |
| Contact server-side search | `GET /contacts/?search=` is not present in the documented query table | `search_contacts` scans documented list pages locally |
| Private-file paging | The private-files query table does not list `page` or `limit` | The tool sends bounded page parameters; live verification confirmed a paged response |
| Webhook delete | No DELETE operation is documented | No delete tool is registered |
| Webhook `headers` | Present in a sample request but not the parameter table | Not accepted or returned by the MCP tools |
| Project design component/energy keys | Documentation describes the data but does not name stable keys | Those sections remain explicitly unmapped |

## OpenSolar terms

| Source | URL | Last checked |
| --- | --- | --- |
| User Terms & Conditions | https://www.opensolar.com/terms-conditions/ | 2026-09-22 |

The release constraints document references terms covering access controls, unreasonable load, service-interface restrictions, and fair-use limits. See [terms-release-gate.md](./terms-release-gate.md).

## MCP sources

| Source | Version or URL | Last checked |
| --- | --- | --- |
| `@modelcontextprotocol/server` | 2.x | 2026-09-23 |
| `@modelcontextprotocol/client` | 2.x | 2026-09-23 |
| `@modelcontextprotocol/hono` | 2.x | 2026-09-23 |
| TypeScript SDK v2 docs | https://ts.sdk.modelcontextprotocol.io/v2/ | 2026-08-22 |
| MCP specification | https://spec.modelcontextprotocol.io/ | 2026-08-22 |

## Live verification

Live verification uses non-customer fixture records and stores only the asserted behavior.

| Date | Area | Verified behavior |
| --- | --- | --- |
| 2026-05 | Contacts and projects | Contacts list is a bare array; `ordering=-field` is descending; `ordering=-id` is ignored; synthetic `@os.code` emails occur; events are org-level; project `design` is gzip+base64; selected integration fields contain encrypted or non-JSON values |
| 2026-09-22 | Events and contact ordering | Org event lookup succeeded for an event referenced by project data; contact family-name descending ordering was confirmed; `ordering=-id` matched default ordering |
| 2026-09-22 | Contact writes | Fixture contact create, partial update behavior, full supported-field update, and delete succeeded |
| 2026-09-22 | Project document generation | HTML proposal generation with `action=save` returned a private-file identifier |
| 2026-09-22 | System image | A 500x500 request returned `image/jpeg`; the response did not expose a private-file identifier; a corresponding System Image file appeared in the project file list |
| 2026-09-22 | Local search | Project and contact searches returned expected list records; incomplete scans were not reported as unique or absent |
| 2026-09-22 | Project snapshot | Snapshot preserved the project identity when a secondary section failed and did not expose raw design, signed URLs, configuration blobs, or credentials |
| 2026-09-22 | System comparison | Returned system IDs matched the project systems list; the details endpoint was used only when hardware groups were missing |
| 2026-09-22 | Project design | Raw Data summary matched the decoded structure; unmapped sections stayed unmapped; geometry coordinates were not returned |

## Not live-verified

These behaviors rely on published documentation and offline contract tests rather than a live OpenSolar call:

- component activation create requests;
- pricing scheme create requests;
- payment option create requests;
- costing create requests;
- workflow update requests;
- organisation update requests;
- private-file create, update, delete, and content download;
- PDF and DOCX project-document generation;
- system-image content download;
- webhook response bodies and queue paging behavior;
- Teams writes and project-share preflight;
- project-stage mutation.

The exact status of each MCP operation is maintained in [api-contract-matrix.md](./api-contract-matrix.md).
