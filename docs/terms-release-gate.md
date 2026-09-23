# Release constraints

This document summarizes external terms and operational limits that affect distribution and deployment of OpenSolar MCP.

Last reviewed: 2026-09-23

Sources and retrieval dates are recorded in [source-log.md](./source-log.md).

## API boundary

OpenSolar MCP uses the documented OpenSolar API under `https://api.opensolar.com/api/` or a configured equivalent. It does not scrape the OpenSolar web application or depend on undocumented HTML.

The implementation follows these contract rules:

- tool operations map to documented endpoints recorded in [api-contract-matrix.md](./api-contract-matrix.md);
- undocumented query parameters are not introduced as if they were supported API contracts;
- derived MCP tools may compose documented reads locally;
- multi-record writes are not hidden behind loops unless OpenSolar documents and the MCP exposes an actual bulk operation;
- Raw Data tools are available only when the caller's OpenSolar plan provides the required access.

## Rate and fair-use limits

OpenSolar publishes per-endpoint throttles and additional fair-use limits. The limits applicable to a deployment are controlled by OpenSolar and may change.

Examples recorded from the current documentation:

| Operation | Per user | Per organisation |
| --- | ---: | ---: |
| Create project | 10/min | 10,000/day |
| Update project | 10/min | 10,000/day |
| Read project | 100/min | 10,000/day |
| System details | 60/min | 10,000/day |
| Proposal/Raw Data login endpoint | 100/min | 10,000/day |

OpenSolar's User Terms also state separate fair-use ceilings for Google Solar API calls (1,000 a month, 200 a day) and webhook calls (2,000 a month), "unless otherwise agreed with us in writing (including under a commercial plan)". The API Access FAQ describes the plan as including unlimited API calls and webhook events. This repository does not expose Google Solar API tools.

The client uses bounded retry only for ordinary JSON GET requests that return HTTP 429. It does not attempt to maintain a quota ledger or bypass OpenSolar rate limits.

## Access plans

OpenSolar documents two relevant products:

- API Access;
- Raw Data API Access.

Raw Data API Access is required for the MCP tools that decode proposal data or project design.

Access can also be project-dependent. Enabling API Access for an organisation does not imply that every historical or future project is readable under every plan state.

## Self-hosted operation

The package is designed for self-hosted use:

- the operator supplies the OpenSolar organisation ID and credentials;
- credentials remain with the operator's process or MCP client;
- the repository does not provide a shared credential vault;
- the repository does not operate a multi-customer OpenSolar proxy.

### Authentication

| Deployment | Credential behavior |
| --- | --- |
| Stdio | Token is supplied through the local process environment |
| Loopback HTTP | Request Bearer token takes precedence; the environment token may be used as a local fallback |
| Non-loopback HTTP | Every MCP request must provide a Bearer token; the environment token is not used as a request fallback |

Host and Origin allowlists are transport safeguards, not authentication. Internet-facing traffic must be protected with TLS termination outside the built-in server.

## Local files

`create_private_file` is disabled unless `OPENSOLAR_UPLOAD_ROOT` is configured. Real-path resolution confines uploads to that directory.

Private-file downloads and system images are size-limited, and signed OpenSolar download URLs are not returned to model-facing output.

## Distribution and hosted services

OpenSolar's current User Terms include restrictions related to proxy, aggregator, and third-party service interfaces. Those restrictions are especially relevant to any service that would operate centrally for multiple OpenSolar customers.

The `0.1.0` package is self-hosted software and does not include such a managed service.

A future Align-operated shared or multi-customer service would require its own legal, contractual, security, and operational review before launch.

This document summarizes repository constraints and is not legal advice.
