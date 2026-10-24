# NotebookLM MCP - Hayırlıevlad (opsiyonel, salt-okunur)

Bu entegrasyonun kaynak kodu ve paneli tek başına Google NotebookLM oturumu açmaz. Hayırlıevlad (Cloudflare Worker) ile NotebookLM arasında **ayrı, sürekli çalışan** notebooklm-py MCP sunucusu gereklidir. Kaynak proje: https://github.com/teng-lin/notebooklm-py . Topluluk projesinin MCP arayüzü deneysel olduğundan sürüm güncellemelerinde kontrol edilmelidir.

## Mevcut uygulama
- Oturum korumalı API yolları: `GET /api/notebooklm/status`, `GET /api/notebooklm/notebooks`, `GET /api/notebooklm/sources?notebook=...`, `POST /api/notebooklm/ask`.
- Yalnızca `notebook_list`, `source_list` ve `chat_ask` MCP araçlarını çağırır; dosya yükleme, silme, paylaşma, araştırma başlatma yetkisi yok.
- Hayırlıevlad sohbet arayüzünde **📚 NotebookLM** paneli. Sistemin yapılandırılmadığını açıkça gösterir.
- `NOTEBOOKLM_MCP_URL` yalnızca HTTPS `/mcp` olabilir; `NOTEBOOKLM_MCP_TOKEN` Workers secret olarak tutulur. Google oturum bilgileri Workers'a veya GitHub'a yüklenmez.
- Kaynaklardan gelen metin güvenilmeyen içeriktir; araç çağrısı/talimat olarak yürütülmemelidir.

## Güvenli sunucu kurulumu
Resmî olmayan MCP projesinin ayrıntılı talimatları: https://github.com/teng-lin/notebooklm-py/blob/main/deploy/README.md

1. Yalnızca NotebookLM için **ayrı bir Google hesabı** kullan. Bu hesabın notebook içeriği riskini kabul ederek tarayıcıda `notebooklm login --master-token --account ...` işlemini kendin gerçekleştir. `master_token.json` tam hesap yetkisidir; bunu sohbet, GitHub veya Cloudflare Worker secret'ı olarak paylaşma.
2. Her zaman açık bir **sunucu/VPS** üzerinde projenin sürümlenmiş Docker Compose dağıtımını kullan. Bilgisayar kapandığında NotebookLM'in çalışması isteniyorsa ev bilgisayarı host olarak uygun değildir.
3. Cloudflare Tunnel'da bütün hostu `http://notebooklm-mcp:9420` adresine yönlendir. Kamuya açık port açma. HTTPS host örneği: `https://notebooklm.example.com` (**gerçek bir adres değil**).
4. MCP sunucusu için iki ayrı erişim tanımla: `NOTEBOOKLM_MCP_TOKEN` (Hayırlıevlad sunucusu için uzun rastgele bearer token) ve `NOTEBOOKLM_MCP_OAUTH_PASSWORD` + `NOTEBOOKLM_MCP_OAUTH_BASE_URL` (destekleyen ChatGPT hesapları için OAuth). OAuth base URL yalnızca origin içerir, `/mcp` içermez.
5. Cloudflare Worker üzerinde `NOTEBOOKLM_MCP_URL=https://.../mcp` değişkenini ve `NOTEBOOKLM_MCP_TOKEN` secret'ını güvenli olarak tanımla. Bunları GitHub'daki kod dosyalarına yazma.
6. Önce staging ortamında `/api/notebooklm/status`, `/notebooks`, `/sources` ve `/ask` uçlarını oturum açmış olarak dene; kimlik doğrulama reddi ve sunucu kapalı senaryolarını kontrol et. Doğrulama öncesi main merge veya production deploy yapma.

## ChatGPT bağlantısı hakkındaki önemli not (24 Ekim 2026)
OpenAI güncel destek metninde özel MCP bağlantısının web sürümünde **Business, Enterprise/Edu** planları için bulunduğunu, **Pro** hesabında ise salt-okunur bağlantı desteği olduğunu belirtiyor; **Plus için mevcut erişimi doğrulamıyor**. Bu nedenle Plus hesabına özel NotebookLM MCP bağlıymış gibi davranma.

Desteklenen hesapta bağlantı kullanıcı tarafından yapılır: https://chatgpt.com/plugins > + > Add custom MCP server > HTTPS URL `https://.../mcp` > OAuth > yetkilendirme. Güncel OpenAI talimatı: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt . Bağlantıyı oluşturan kişinin risk bildirimi ve Google yetkisini bizzat onaylaması gerekir; bu oturumdan kullanıcı adına sessiz kurulum yapılamaz.

## Test
`npm run check` veya `node --test tests/notebooklm-mcp.test.js`

Testler mock MCP sunucusunu kullanır; canlı Google bağlantısını ispatlamaz. Bu PR yalnızca geliştirme dalında tutulmalıdır.
