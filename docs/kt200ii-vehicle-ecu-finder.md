# KT200 II - Arac Bilgisinden ECU Adayi ve Okuma Yontemi

Amaç: Kullanıcı, ECU etiketini görmeden aracin marka/model/yil/motor/PS bilgisini yazarak olası ECU'ları bulsun ve doğru okuma yöntemini araştırabilsin.

## Nerede?

Jarvis masaustu ve mobil menülerinde **KT200 II ECU Bul**. Eski **ECU Kataloğu** özelliği değiştirilmedi.

## Otomatik adımlar

1. Marka + model girilir; yil, motor ve PS isteğe bağlıdır. İsteğe bağlı ECU parça, HW ve SW alanları da var.
2. `GET /api/ecu/compatibility/lookup` mevcut D1 `ecu_part_catalog` kayıtlarında olası ECU adaylarını arar. Yil kontrolü yapılamaz, çünkü mevcut katalog tablosunda model yil aralığı yoktur. Böyle bir sonuç **kesin ECU tespiti** sayılmaz.
3. Yapılandırılmışsa Jarvis'in mevcut Google Programmable Search API entegrasyonuyla `site:kt200ii.com` araştırması gösterilir. Arama sonuçları kaynak ipucu sayılır; protokol desteği otomatik olarak doğrulanmış sayılmaz. Google çalışmıyorsa resmi destek listesine bağlantı sunulur.
4. Kullanıcı ECU ID/HW/SW bilgisini Thinkdiag veya ECU tanılama işlevinden alarak eşleşmeyi doğrular.
5. KT200 II uygulaması ve [destek listesi](https://kt200ii.com/support-list/) kontrol edildikten sonra, kullanıcı **isteğe bağlı** bir protokol notu kaydedebilir: OBD/Bench/Boot/JTAG/BDM, gerçek okuma/VR/yalnız yazma, kaynak URL.
6. `POST /api/ecu/compatibility/note` yalnızca giriş yapılmış kullanıcı tarafından; ECU parça numarası + HW + SW + HTTPS kaynak + açık onayla yapılır. Not D1'in yalnızca yeni `ecu_kt200_protocol_notes` tablosuna yazılır. Notlar kullanıcı beyanıdır; güncel KT200 cihazına test edilmiş bağlantı olarak sunulmaz.
7. Kaydedilmiş bir not yalnızca aynı parça numarası, HW ve SW eşleştiğinde **operator_recorded_exact_id** olarak gösterilir. Her durumda protokolün uygulamadaki güncel durumu tekrar teyit edilmelidir.

## Sınırlar

- Hiçbir KT200 II cihazına uzaktan bağlanılmaz; ECU okunmaz veya yazılmaz.
- KT200 destek veritabanı kopyalanmaz; izinsiz scraping yoktur.
- `ecu_part_catalog` boş ise 'aday bulunamadı' mesajı gerçek uyumsuzluk anlamına gelmez.
- `VR` fabrika eşleşmeli dosyadır; araca takılı ECU'nun gerçek hafıza dökümü değildir.
- ECU üzerindeki tam donanım/yazılım kimliği ve güncel güvenlik kilitleri kontrol edilmeden OBD/Bench/Boot garantisi verilmez.
- Main merge, production deploy ve secret değişikliği bu özellik tesliminin dışında tutulur.

## Teknik doğrulama

- `npm test` ile `tests/ecu-compatibility-assistant.test.js` çalıştır.
- `node --check src/application/ecu/compatibility-assistant.js` ve `node --check public/ecu-compatibility-assistant.js`.
- D1 preview veritabanında yetkili GET lookup, boş katalog, kaynak notu kaydı, tam eşleşen ve eşleşmeyen HW/SW örneklerini dene.
- Browser ile mobil ve masaüstü menüyü, resmi kaynak linkini, Google API'nin açık/kapalı hâllerini doğrula.

## 2026-10-21: Canlı protokol sayfası ve ECU ID köprü bağlantıları

**KT200 II protokol yayını:** `src/application/ecu/kt200-live-source.js` tek sorguda resmi `https://kt200ii.com/support-list/` HTML tablosunu okumayı dener, cevapta görünür ECU satırlarını eşleştirir. Yalnızca yayınlanmış satırlar ve kaynak bağlantısı döndürülür. Site veri kümesini yalnız tarayıcı JavaScript'inden getiriyorsa API veya tam protokol veri aktarımı olduğu **iddia edilmez**; sonuç `VENDOR_TABLE_NOT_MACHINE_READABLE` olabilir. VR ile fiziksel okuma ayrımı korunur. Kapsam eksik olduğunda sonuçların yokluğu uyumsuzluk kanıtı değildir. Kaynakların yeniden kullanımı veya bulk veri toplama yok.

**ECU kimliği için gerçek köprü:** `read_ecu_identity` eylemi yalnızca doğrulanmış donanım adaptörü bu yeteneği açıkça duyurduğunda kullanılabilir. KT200 II ve ThinkDiag üretici SDK'larının genel erişime açık bir doğrulanmış USB sürücü arayüzü bu repoya bağlı değildir; böyle bir yetenek uydurulmaz.

`import_ecu_identity` eylemi **gerçek rapor verisi** kullanan, salt-okunur çalışan `local-bridge/ecu-identity-report-adapter.mjs` tarafından desteklenir. Windows bilgisayarda ECU kimliğini ThinkDiag veya KT200 yazılımıyla oku ve .txt/.json/.pdf olarak dışa aktar. PDF yalnızca metin tabanlıysa çalışır; taranmış görsel PDF OCR gerektirebilir ve desteklenmez.

### Windows çalıştırma

1. Repo klasöründe `npm install` çalıştır; Node.js ve `pdfjs-dist` gerekli.
2. Jarvis → **ECU Studio → CİHAZ** üzerinden yeni yerel bridge token oluştur.
3. Windows PowerShell'de repo kökünden çalıştır:
   `powershell -ExecutionPolicy Bypass -File .\\local-bridge\\start-ecu-identity-bridge.ps1 -ReportPath "C:\\ECU\\ECU-ID.pdf"`
4. Bridge token istendiğinde yapıştır; token kod deposuna kaydedilmez.
5. Jarvis menüsünde **KT200 II ECU Bul → BAĞLI CİHAZDAN ECU ID AL** düğmesine bas. Adaptör `read_ecu_identity` destekliyorsa canlı cihazdan ID; değilse açıkça `import_ecu_identity` olarak yerel dosyadan ID alınır. Ekranda donanım ve rapor kaynakları ayırt edilir.
6. ECU part number, HW, SW ve fiziksel araç eşleşmesini doğrula; ancak sonra dosya okuma yöntemini değerlendir.

**Not:** Cloudflare Worker kullanıcının PC USB bağlantısına tek başına erişemez. Yerel Node.js bridge süreci PC'de açık olmalıdır. Bu özellik ECU hafızasını okumaz/yazmaz, DTC silmez, hiç bir motor kontrol komutu göndermez.

### Denetimler

`tests/ecu-identity-and-protocol.test.js` metin/JSON raporu, dosya kaynağı, rapor eskimesi, yayınlanmış protokol tablosu ve otomatik doğrulanmayan kaynak durumlarını test eder. `npm run check` ve Github Actions reliability checks geçmeli. Bu yeni düzeneğe yönelik gerçek araç testi yapılmadıkça **canlı USB cihaz entegrasyonu doğrulandı** denemez.
