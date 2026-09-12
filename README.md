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
