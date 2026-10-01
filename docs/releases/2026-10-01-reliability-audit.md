# Jarvis doğrulama ve geliştirme — 1 Ekim 2026

Başlangıç sürümü: `f0cbc9eb6b97070856880218bf2c0378ac9e01f5`.

## Uygulanan düzeltmeler

- Yedek AI yalnız mevcut başarısız cevabı değiştirir; geçmişteki doğru cevapları korur.
- Sohbet gönderme ve ECU kanal uçları, uygulama katmanında sahibin oturumunu doğrular. Bridge token doğrulaması ayrı kalır.
- Claude çağrıları Messages protokolünü kullanır. Uzman yönlendirici aynı sağlayıcı çağrı yolunu kullanarak başarı/hata/gecikme ölçümlerini kaydeder.
- OpenAI uyumlu tam `/chat/completions` adresine aynı yol ikinci kez eklenmez. Bilinen sağlayıcılar için varsayılan temel adresler korunur.
- ECU girişleri boş, bozuk Base64 ve 12 MiB üzeri içerik için yazma başlamadan reddedilir. Dosya boyutu çözülmüş byte sayısından hesaplanır.
- MIME türü olmayan `.mod` ve `.ecu` ekleri tanınır.
- Uzun ECU geçmişlerinde en yeni 1.000 mesaj, zaman ve eklenme sırasıyla döner.
- ORI/MOD farkları, hash, boyut ve offset bilgileri `analysis` alanında yapılandırılmış olarak döner. Gizlenen bölgeler doğru belirtilir.
- Tüm JavaScript modülleri için ek syntax taraması ve PR için yalnız doğrulama yapan CI workflow eklendi.

## Doğrulama kanıtları

| Kontrol | Sonuç |
|---|---|
| Başlangıç `npm run check` | 126/126 test başarılı |
| Son `npm run check` | 140/140 test başarılı; atlanan test yok |
| Ek JavaScript syntax taraması | Başarılı |
| Shell scriptleri `bash -n` | Başarılı |
| Cloudflare `wrangler deploy --dry-run` | Başarılı |
| SQLite üzerinde `schema.sql` iki kez uygulama | Başarılı |
| Wrangler yerel D1 şema uygulama | Başarılı |
| ECU dosya → kanal → saklanan geçmiş | SQLite üzerinde başarılı |
| Bridge kayıt → token heartbeat → job claim → simüle sonuç | SQLite üzerinde başarılı; gerçek araç kullanılmadı |
| Canlı `/api/health` | HTTP 200, `ok: true` |
| Mevcut main deployment CI | Başarılı: run `36825178408`, başlangıç commit'i |
| Son mevcut native iOS build | Başarılı: run `36588863927`, commit `af7390f6`; bu çalışmada tekrar derlenmedi |

14 yeni davranış testi, önceki testlere ek olarak gerçek Request/Response nesneleri, SQLite şeması ve sahte sağlayıcı yanıtlarıyla çalışır. Sağlayıcı anahtarları test fixture değerleridir; ücretli API çağrısı yapılmadı.

## Henüz doğrulanamayanlar

- Yerel Wrangler HTTP sunucusu bu yürütme ortamında erişilebilir olmadı (`uv_interface_addresses` ortam hatası; ayrıca localhost bağlantısı reddedildi). Tarayıcıdan tam uygulama uçtan uca kontrolü başarılı sayılmadı.
- Gerçek ThinkDiag/KT200 bağlantısı, araçtan DTC/VIN/PID/freeze-frame okuma ve cihaz üzerinde işlemler bu ortama bağlı donanım olmadığından doğrulanmadı.
- Yeni Claude protokolü ve hata metrikleri fixture yanıtlarıyla doğrulandı; gerçek hesap kotası, model erişimi ve ücretli AI istekleri doğrulanmadı.
- iPhone mikrofonu, sesli konuşma, APNs bildirimi ve gerçek cihazdaki uygulama davranışı doğrulanmadı.
- Giriş yapılmış canlı hesapla sohbet, Google/Gmail/Drive ve sosyal/video servisleri çalıştırılmadı.
- BIN/HEX dosyasının byte analizi, ECU'ya özgü checksum doğrulaması veya Intel HEX adres kayıtlarının parse edilmesi anlamına gelmez. Bunlar bu pakette eklenmedi.

Bu rapor tüm Jarvis özelliklerinin tamamlandığı iddiası değildir. Yeni geliştirmeler ayrı PR'dadır; canlıya aktarılmaları bu raporun yerel test sonucuyla kanıtlanmış sayılmaz.
