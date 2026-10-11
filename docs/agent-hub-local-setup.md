# JARVIS Agent Hub — local PC starter

Bu dokuman mevcut JARVIS'in `capability-registry-v2`, `open-source-capabilities`, `local-bridge` ve `orchestration` altyapisini tamamlar; ikinci bir kayit sistemi kurmaz.

## Windows PC

1. Git for Windows ve Node.js 20+ kurulu olsun.
2. Bu branch'i klonla veya mevcut repoda `git fetch && git switch jarvis/agent-hub-local-setup` yap.
3. PowerShell ile `powershell -ExecutionPolicy Bypass -File .\local-bridge\setup-agent-hub.ps1` calistir.
4. `ollama run qwen2.5-coder:7b` ile yerel modeli dene.
5. Kaynak katalogu: `npm run sources:sync:dry`. Bu sadece mevcut tanimli depolari listeler, calistirmaz.
6. `npm install` ve `npm run check` ile projeyi dogrula.

## Guvenlik ve sinirlar

- GitHub'dan toplanan kaynak kodlarini guvenlik incelemesi olmadan otomatik calistirma.
- Ollama varsayilan olarak localhost'ta kalsin; `11434` portunu internete acma.
- Cloudflare Workers dogrudan PC localhost'una erisemez. Kimlik dogrulama ve arac izinleri olan bir local-bridge protokolu sonradan tasarlanmalidir. Bu branch'te uzaktan komut calistirma **etkinlestirilmedi**.
- Secrets, production deploy, main merge, ucretli API veya yikici islemler otomatiklestirilmedi.
- Ollama'nin yerel calismasi API kotasi gerektirmez ama GPU/RAM ve elektrik tuketir.
- Jcode Ollama konfigurasyonunu Jcode surumunun resmi komutlariyla ayrica dogrula. Burada Jcode ayarlari degistirilmedi.

## Sonraki entegrasyon

Local bridge icin izinli gorev kuyrugu (D1), imzali istekler, kisitli araclar, denetim gunlugu, onay kontrollu repository yazmalari ve test yapan runner gerekli. Bu adimlar mevcut cloud ve PC ortamlari test edildikten sonra uygulanmali.
