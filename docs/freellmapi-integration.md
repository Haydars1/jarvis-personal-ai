# FreeLLMAPI → hayırlıevlad (kişisel deneysel kullanım, opt-in)

Videodaki proje: https://github.com/tashfeenahmed/freellmapi

## Neden ekledik?
FreeLLMAPI, ayrı ayrı sahip olunan ücretsiz AI API kotalarını bir OpenAI-uyumlu `/v1` uçta toplayan **kişisel self-hosted** yönlendiricidir. Projenin tanıttığı 7,4 milyar token **kullanıcının otomatik sahip olduğu limit değildir**: sağlayıcıların teorik ücretsiz toplam kapasitesidir. Gerçek kota, sağlayıcılarda açtığın hesap/API anahtarları ve şartlarına bağlıdır. Ücretli sağlayıcıları bağlarsan gerçek ücret oluşabilir.

Sistem zaten (FreeLLMAPI olmadan da) Gemini, Groq, Mistral, OpenRouter, Cerebras, NVIDIA vb. API'lere bağlanıp failover yapabiliyor. Bu katkı, kullanıcı kendi FreeLLMAPI sunucusunu çalıştırdığında onu **ek bir seçenek** olarak kullanmayı sağlar; mevcut yönlendirmeyi zorla değiştirmez.

## Eklenen kod
- `src/lib/freellmapi.js`: yalnızca dışarıdan ulaşılabilir, güvenli HTTPS `/v1` adreslerini kabul eder; yerel/LAN adresleri ve URL içine gömülü şifreleri engeller. `GET /v1/models` ile birleşik token'ı doğrular.
- `src/lib/credentials.js`: özel sağlık kontrolü; yalnız başarılı ve boş olmayan model kataloğunu **sağlıklı** sayar.
- `src/application/chat/smart-router.js`, `src/lib/orchestration.js`: `freellmapi` sağlayıcısını kullanıcı seçimine ve otomatik yedek havuzuna ekler; `model=auto` varsayılan, başarısızsa mevcut sağlayıcılara geçer.
- `public/provider-catalog.js`: mobilde Ayarlar / AI Sağlayıcıları içinde FreeLLMAPI kartı, HTTPS API adresi ve birleşik anahtar girişi.
- API anahtarı hayırlıevlad'ın mevcut **şifrelenmiş D1 kasasında** tutulur. GitHub'a veya Cloudflare `wrangler.jsonc` dosyasına anahtar yazılmaz.

## Mobil bağlantı adımları
1. *Önce* FreeLLMAPI uygulaması senin kontrol ettiğin, kimlik doğrulamalı bir sunucuda kurulmalı ve Google/Groq/Mistral gibi sağlayıcıların ücretsiz API anahtarları ona eklenmeli. **Bu PR böyle bir sunucu kurmaz** ve hazır token sağlamaz.
2. FreeLLMAPI panelindeki Keys bölümünden **birleşik API anahtarı** al.
3. Yalnız kendi HTTPS üzerinden sunulan `https://<senin-güvenli-alan-adın>/v1` adresini kullan; Cloudflare Worker `http://localhost:3001` adresine ulaşamaz.
4. Hayırlıevlad > Ayarlar > AI Sağlayıcıları > FreeLLMAPI kartına HTTPS /v1 adresini, `auto` modelini ve birleşik anahtarı gir; **BAĞLA + TEST**'e bas.
5. İstekleri `AUTO` modunda bırakabilir ya da model seçiminden yeni FreeLLMAPI sağlayıcısını seçebilirsin. Sağlayıcı listesi ve istek logu, gerçekleşen model geçişini göstermelidir.

## Güvenlik ve sınırlamalar
- **Ücretli API açma**, sağlayıcı anahtarı üretme, gizli değerlerin paylaşılması, otomatik production deploy yapılmadı.
- FreeLLMAPI'yi yetkisiz erişime açık public proxy olarak yayımlama. HTTPS tek başına yeterli değildir; dashboard oturumu, API token doğrulaması ve güvenilir ağ erişimi gerekir.
- Google Drive belgeleri, ECU yazılımları, müşteri kişisel verileri, kimlik bilgileri gibi özel içerikleri üçüncü taraf ücretsiz modellere izinsiz gönderme. Yönlendirme otomatik olduğu için veriler birden çok farklı sağlayıcıya ulaşabilir.
- Projenin geliştiricisi **kişisel deney/öğrenme** kullanımını belirtiyor; iş/müşteri verileri veya production hizmeti için önerilmez.
- `model=auto` yalnız senin FreeLLMAPI sunucunda sağlıklı sağlayıcılar varsa yanıt üretir; `GET /v1/models` başarılı olması tek başına **gerçek chat isteği testi değildir**.
- Render Free'un geçici dosya sistemi üzerinde şifrelenmiş SQLite veritabanı kalıcı olarak güvence altında değildir. Böyle bir sistemi hazırlıksız Render Free dağıtımıyla kalıcı çalışıyor diye göstermiyoruz.

## ChatGPT
FreeLLMAPI upstream projesinin deneysel **MCP** entegrasyonu var. ChatGPT uygulamasına yeni bir MCP bağlantısı kurmak ayrıca hesabının özel sunucu ekleme yetkisi ve kendi kimlik doğrulamalı MCP endpointini gerektirir. Bu PR ChatGPT hesabına uygulama **yüklemez**; hayırlıevlad'a OpenAI-uyumlu AI sağlayıcısı ekler.

## Test
`node --test tests/freellmapi.test.js`, `npm run check`. Bunlar sahte HTTP yanıtları ile API güvenliğini ve geçerli model listelemeyi test eder; canlı FreeLLMAPI sunucusu ve gerçek ücretsiz modeller henüz bağlanmadı.

Kaynak: https://github.com/tashfeenahmed/freellmapi/blob/main/README.md
