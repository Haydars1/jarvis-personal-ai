# JARVIS Free Integration Hub Design

Date: 2026-10-03
Status: Design for review

## Objective
Integrate the useful tools shown in the supplied plugin/MCP screenshots into JARVIS and ChatGPT without adding paid-only dependencies. JARVIS must distinguish real executable integrations from catalog-only references, required account connections, and unavailable providers.

## User constraints
- Install/integrate free and free-plan tools only.
- Do not install tools explicitly marked paid in the supplied screenshots.
- Do not spend money, start subscriptions, or change billing.
- Do not claim an integration is active unless it has a working adapter/connector or an explicitly connected ChatGPT plugin.
- Preserve the existing JARVIS repo/skill execution model and specialist-agent architecture.

## Excluded paid tools
The following screenshot-labelled paid tools are excluded from automatic installation/integration:
- ScreensDesign MCP
- Higgsfield MCP
- Plaud
- ManyChat

Other tools that require payment at runtime must remain `paid-or-account-required` and inactive until the user explicitly chooses them later.

## Existing ChatGPT integrations already installed
- Figma
- Canva
- Notion
- Google Drive
- Vercel
- GitHub
- Firecrawl
- Todoist
- Gmail
- Google Calendar
- Consensus

These should be reused rather than duplicated.

## Missing ChatGPT integrations currently eligible for user connection
- Slack (free-plan use only)

## Not admitted to free set yet
- HeyGen (do not treat as free until usage/pricing eligibility is verified)

ChatGPT plugin installation/connection remains a user action. JARVIS must not pretend a connector is connected until connector state confirms it.

## JARVIS architecture
Add a Free Integration Hub on top of the existing repository catalog, cloud execution, native skill executor, and specialist-agent routing.

Each integration record stores:
- id / display name
- role/team: build, design, growth, operations, scale
- source type: chatgpt-plugin, mcp, github-skill, api, local-runtime
- capabilities
- pricing state: free, free-plan, unknown, paid
- auth state: none, connection-required, connected
- runtime state: ready, degraded, unavailable, reference-only
- adapter id / route
- health check
- fallback order
- provenance / license metadata when repository-backed

## Team routing
### Build
Use existing or free/open tooling such as Superpowers, GitHub, Playwright MCP, Graphify/native code graph, Context/documentation adapters, security checks, and Vercel where available.

### Design
Use installed Figma and Canva connectors plus open/free design skills. Paid-only visual providers remain disabled.

### Growth / Research
Use Firecrawl, connected Consensus, the existing YouTube Teaching system, source-backed research/search, and free/open repository skills.

### Operations
Use Notion, Google Drive, Slack when connected, and free/open workflow tooling. Do not route through paid-only Plaud.

### Scale / Social / Finance
Use free-plan/open social or workflow capabilities when verified. Paid-only ManyChat is excluded. Payment providers such as iyzico are not auto-connected unless a free connector/API is verified and the user explicitly connects credentials.

## Runtime rules
1. A task is classified into a specialist role.
2. Router chooses the highest-ranked `ready` free integration.
3. If connection is required, surface that state instead of pretending success.
4. If an adapter fails, try the next verified free fallback.
5. Catalog-only entries never count as executable capability.
6. Paid integrations are skipped automatically.
7. Every execution records tool, adapter, result, failure reason, and fallback trace.

## UI
Add a compact Integration Hub status view showing:
- Active
- Connection needed
- Free but not yet adapted
- Reference only
- Paid/excluded
- Unavailable

The user should be able to filter by Build / Design / Growth / Operations / Scale.

## Verification
Implementation is complete only when:
- Existing regression tests pass.
- Free/paid filtering is covered by tests.
- Router never selects `paid` or `paid-or-account-required` entries automatically.
- Existing installed ChatGPT connectors are not duplicated.
- At least one executable free integration in each supported team is exercised in a test or runtime smoke path.
- Capability dashboard reports truthful state.

## Deployment safety
- Feature branch first.
- No production deploy, main merge, billing, subscription, or secret changes without separate explicit approval.
- External account connections remain user-controlled.
