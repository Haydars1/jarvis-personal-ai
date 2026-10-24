# NotebookLM MCP — hayırlıevlad (Cloudflare Containers)

[Kurulum: Cloudflare Containers](../services/notebooklm-cloudflare/README.md)

## Mimari
Hayırlıevlad'ın mevcut Cloudflare Worker'ı, başka bir VPS olmadan, **Cloudflare Service Binding** yoluyla `hayirlievlad-notebooklm-mcp` adlı özel Worker'a ulaşır. O Worker, Cloudflare Containers içinde sürümü sabitlenmiş Python `notebooklm-py[mcp]` servisini çalıştırır. Servis gerektiğinde ayağa kalkar; sürekli açık bir ev bilgisayarı veya VPS gerekli değildir.

- **Kullanıcı arayüzü:** 📚 NotebookLM paneli, notebook seçimi ve kaynaklara soru sorma
- **Erişim kontrolü:** Kullanıcı oturum kontrolü + iki seviyeli MCP araç beyaz listesi
- **İzin verilenler:** `notebook_list`, `source_list`, `chat_ask`
- **Yasaklar:** Silme, belge ekleme/düzenleme, paylaşım, tüm diğer MCP araçları
- **Secrets:** Ana Worker ve özel servis `NOTEBOOKLM_MCP_TOKEN` kullanır. Özel servis ayrıca `NOTEBOOKLM_AUTH_JSON` adında Google Web oturum çerezlerini taşır. Hiçbiri GitHub/Docker görüntüsünde tutulmaz.
- **Maliyet:** Cloudflare Workers Paid ve Container kullanım ücreti; dağıtım öncesi hesap ve bütçe onayı gerekir
- **Oturum:** İlk Google girişi kullanıcı tarafından yerel tarayıcıda yapılır. Web çerezleri sürelidir; 1-2 haftada bir veya gerektiğinde yenilenmesi gerekebilir

## Gereken kullanıcı işlemleri
1. Cloudflare Workers Paid / Containers durumunu kontrol etmek
2. Ayrı bir Google hesabında `notebooklm login` yapmak
3. İki Cloudflare secret'ı güvenli şekilde tanımlamak; aynı bearer token'ı ana Worker'a da koymak
4. Staging aşamasında bağımsız Container Worker'ı çalıştırmak ve uçtan uca doğrulamak

**Bu işlemler otomatik yapılmadı.** Ana sürümün dağıtımı, secret değişikliği, para harcanması ve başka dış işlemler için açık onay gerekir.

## Mevcut API
- `GET /api/notebooklm/status`
- `GET /api/notebooklm/notebooks`
- `GET /api/notebooklm/sources?notebook=<id>`
- `POST /api/notebooklm/ask` (JSON: `{"notebook":"<id>","question":"..."}`)

## ChatGPT sınırı
Bu özel Service Binding ChatGPT'ye public MCP sunmaz. ChatGPT Plus hesabında **özel MCP ekleme** yeteneği olmadığı için ayrıca direkt ChatGPT entegrasyonu devreye alınamaz. Destekleyen planlarda ek OAuth / public MCP sunucusu ayrıca tasarlanmalıdır.

## Doğrulama
`npm run check` (birim/sözdizimi testleri), `npx wrangler deploy --config services/notebooklm-cloudflare/wrangler.jsonc --dry-run` (Container paketleme; Docker gerekir). Bu testler NotebookLM Google hesabı girişinin çalıştığını kanıtlamaz.

Kaynaklar:
- https://developers.cloudflare.com/containers/
- https://developers.cloudflare.com/containers/platform/pricing/
- https://github.com/teng-lin/notebooklm-py/blob/main/docs/mcp-guide.md
- https://github.com/teng-lin/notebooklm-py/blob/main/docs/configuration.md
