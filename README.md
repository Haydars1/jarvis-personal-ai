# JARVIS Personal AI

Kisisel JARVIS asistani icin ana kaynak deposu.

## Teknoloji

- Cloudflare Workers
- D1 (`DB` binding)
- Workers AI (`AI` binding)
- Static PWA (`public/`)
- Opsiyonel R2 (`FILES` binding)
- GitHub Actions ile test/deploy/self-update

## Yerel kontrol

```bash
npm install
npm run check
npx wrangler deploy --dry-run
```

## Windows kurulum/deploy

`SETUP-AND-DEPLOY.cmd` Cloudflare oturumunu kontrol eder, D1 binding'ini yazar, semayi uygular, secret'lari olusturur, dry-run yapar ve deploy eder.

## GitHub Actions secret'lari

Deploy workflow icin repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `JARVIS_HEALTH_URL`

Uygulama API anahtarlari ve OAuth secret'lari repoya yazilmaz; JARVIS Credential Manager / Cloudflare secrets kullanilir.

## Self Update

JARVIS degisiklikleri `jarvis/*` branch'lerinde hazirlayip PR acacak sekilde tasarlanmistir. `.github/workflows/jarvis-self-update.yml` syntax/dry-run testlerinden sonra bu PR'lari birlestirebilir.

Ana repo: `Haydars1/jarvis-personal-ai`

## Code graph

Repository dependency/impact analysis is local-first and JARVIS-owned. The default graph build uses the native deterministic parser and requires no Graphify installation, Python runtime, hosted account or paid API.

```bash
npm run graph:build
npm run graph:check
npm run graph:query -- find orchestrator
npm run graph:query -- impact src/worker.js
```

The native engine scans supported repository files with bounded discovery and extracts JS/TS, Swift, SQL/D1 and repository config/workflow relationships into the normalized version-1 graph contract.

Graphify remains optional reference tooling only. If a raw Graphify JSON export is available, it can be normalized separately and compared without overwriting the native artifact:

```bash
npm run graph:build:graphify -- path/to/graphify.json
npm run graph:compare
```

Normal `npm run check`, Cloudflare Worker runtime and the required Code Graph CI path do not depend on Python or Graphify.
