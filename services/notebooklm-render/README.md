# NotebookLM MCP — ücretsiz Render Free + Cloudflare Workers Free

Bu çözüm Cloudflare Workers Paid/Containers gerektirmez. Halihazırda ücretsiz Render hesabında **ayrı bir Free Web Service** kullanır. Cloudflare üzerinde hayırlıevlad, NotebookLM MCP'nin HTTPS endpointine bağlanır.

## Güvenlik
- Bir Google hesabının oturum çerezleri **asla GitHub'a veya ChatGPT sohbetine yüklenmez**.
- NotebookLM MCP sunucusu internete açık olsa da `NOTEBOOKLM_MCP_TOKEN` bearer kimlik doğrulaması ile korunur. İki secret tanımlanana kadar sunucu **MCP isteklerini 503 ile reddeder**.
- Ana hayırlıevlad Worker sadece üç aracı kullanır: `notebook_list`, `source_list`, `chat_ask`.
- Bu açık kaynak NotebookLM istemcisi deneysel ve Google tarafından desteklenmiyor. Ayrı bir Google hesabı önerilir.

## Render tarafı
- GitHub repo: `Haydars1/jarvis-personal-ai`
- Branch: `feature/notebooklm-mcp-readonly-20261024`
- Dockerfile: `services/notebooklm-render/Dockerfile`
- Bölge: Frankfurt
- Plan: `free` ($0).
- Render Environment değerleri: `NOTEBOOKLM_AUTH_JSON` (yerel bilgisayarda `notebooklm login` tarafından oluşturulan `storage_state.json` içeriği), `NOTEBOOKLM_MCP_TOKEN` (rastgele, en az 32 byte bearer token).
- Bunlar kullanıcı tarafından **Render Dashboard > Environment** ekranına girilir; sohbetten veya GitHub'dan aktarılmaz. Token ile Google oturumu ikisi de tanımlanınca Render uygulama yeniden başlatıldığında gerçek `notebooklm-mcp` süreci açılır.

## Cloudflare tarafı
- `NOTEBOOKLM_MCP_URL=https://<Render-service>.onrender.com/mcp`
- `NOTEBOOKLM_MCP_TOKEN` aynı bearer token, Cloudflare Worker secret olarak.
- Main'e merge / production deploy ve Cloudflare secret değişiklikleri ayrıca güvenli doğrulamadan sonra yapılmalıdır.

## Ücretsiz planın sınırları
Render 750 free instance-hours/ay limiti **aynı çalışma alanındaki tüm ücretsiz web servisleri arasında paylaşır**. Servisler 15 dakika boş kalınca kapanır ve yeniden açılmaları yaklaşık bir dakika sürebilir. İlk MCP bağlantısı için hayırlıevlad client zaman aşımı buna göre yükseltilmiştir. Çalışma saatlerini tüketmemek için ücretsiz servise periyodik ping gönderme.

Render ücretsiz web servisi üretim seviyesi kullanılabilirlik için garanti sunmaz ve internet trafiğine göre askıya alınabilir. Render'da halihazırda başka ücretsiz servis varsa bu limit paylaşılır.

## Doğrulama
`npm run check` ve GitHub CI testlerini çalıştır. Render `/health` endpointi ön kurulumda `{"status":"setup_required","live_notebooklm":false}` döndürür; bunun canlı NotebookLM bağlantısı anlamına gelmediğini unutma. Google oturumu girildikten sonra gerçek `GET /api/notebooklm/notebooks` ve `POST /api/notebooklm/ask` uçtan uca test edilmelidir.
