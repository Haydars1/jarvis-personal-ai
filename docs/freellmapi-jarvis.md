# JARVIS ↔ FreeLLMAPI (bulut bağlantısı)

FreeLLMAPI upstream: https://github.com/tashfeenahmed/freellmapi

JARVIS, sağlayıcı kimlik bilgileri kasasından gelen HTTPS FreeLLMAPI geçidine OpenAI-compatible chat istekleri gönderebilir. FreeLLMAPI mevcut anahtarları ile otomatik model seçimi ve 429/5xx sonrası sağlayıcı değiştirme işlemini **geçidin kendisinde** yapar. JARVIS de geçit yanıt vermezse kendi bağlı sağlayıcılarına düşer ve aynı sohbet bağlamını iletir.

## Durum ve gereksinimler

- Cloudflare Workers üzerinde tam FreeLLMAPI sunucusu çalıştırılmaz. Yukarı akış Node.js, SQLite, persistent key store gerektirir.
- Harici bir **kullanıcı denetimindeki** HTTPS geçit servisi ve **birleşik API anahtarı** gereklidir. `localhost`, `http:` ve özel adresler kabul edilmez.
- Uzak geçit kurulmadıysa bağlantı durumu **bağlı değil**; hiçbir ücretsiz token kotası garanti değildir.
- JARVIS ayarlarında FreeLLMAPI kartından geçit URL'sini, model olarak `auto` ve birleşik anahtarını yazıp `BAĞLA + TEST` seçilebilir. Kaydedilen anahtar mevcut şifreli kasaya gider; API yanıtında geri dönmez.
- İşlenen kullanıcı mesajları ve sohbet bağlamı geçit ile onun seçtiği harici AI sağlayıcılarına gönderilir. Hassas verileri aktarmadan önce bu servise güvenildiğinden emin olun.
- `/v1/models` sorgusu başarılıysa servis sağlıklı olarak işaretlenir. Gerçek yanıtın `X-Routed-Via` başlığı varsa seçilen sağlayıcı gösterilir.
- Fiyat, kullanım kotası, ücretli lisans, garanti veya trafik yönlendirme politikası FreeLLMAPI sağlayıcısının şartlarına bağlıdır; yeni satın alma yapılmaz.
- GitHub üzerinde değişiklik yalnızca geliştirme PR'ında. Canlı yayın, secret ekleme ve main merge bu çalışmaya dahil değildir.

## Yerel kurulum olmadan

JARVIS tarafında bu adaptör yalnızca Cloudflare Worker kodudur. Windows kurulumu gerekmez. Tam FreeLLMAPI sunucusu için kalıcı bulut ortamı ayarlanmalı ve **kullanıcı tarafından** giriş anahtarları eklenmelidir; bu işlem mevcut PR tarafından otomatik yapılmaz.

## Güvenli çalışma sınırları

- URL doğrulaması public HTTPS kökenini zorunlu tutar.
- Üçüncü taraf kaynak kodları, curl/install betikleri, ücretli hizmetler otomatik çalıştırılmaz.
- Yanıt yoksa hata kontrollü şekilde üst yönlendiriciye iletilir.
- Bağlantı durumunu gösteren endpoint secrets içermez.
