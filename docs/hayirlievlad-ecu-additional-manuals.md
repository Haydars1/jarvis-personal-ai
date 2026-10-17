# hayırlıevlad — 10 ek ECU PDF kaynağı (17 Ekim 2026)

Bu ekleme önceki 10 PDF kaynağını **silmez**. Yeni belge kimlikleri 10 ek kılavuzla toplam 20 kaynaktır.

- WinOLS başlangıç ve harita düzenleme örneği
- VAG EDC16 swirl flap / EDC16 tuning v1.1 / hot start
- MSA15 VP37 tuning kılavuzu
- Bosch EDC17 harita kılavuzu ve bir sayfalık ilişki şeması
- Bosch EDC15P+ örnek kalibrasyon tanıtımı
- VAG EDC16CP34 EGR/DPF görüntü örnekleri

## Öğrenme biçimi
`manual-learning-new10.js`: her kaynak için bağımsız, sayfa referanslı ve özgün teknik ilkeler.
`manual-study-context.js`: uygun ECU sorularında bu kısa ilkeleri **kalıcı kod bilgisinden** çağırır; her soruda PDF aramaz. Sorgunun özel ECU ailesi varsa aynı aileyi önceliklendirir. Hem ana sohbet hem ECU sohbeti için `src/worker.js` içine dahil edilmiştir.

Bu, model ağırlıklarının eğitilmesi değildir. PDF'teki değerlere körü körüne güvenilmez; donanım/yazılım uyumu ve yasal emisyon gerekleri ayrıca değerlendirilir.

## Tam 20 belge / PDF sayfa arşivi
Tam metin kamuya açık GitHub'a konulmaz. Kullanıcının özel JSON paketleri `/api/ecu/manual-library/import` uç noktasına giriş yapan hesap sahibi tarafından 8 kayıtlık partilerle aktarılır. `activate` isteği kaynaklı ilkeleri mevcut D1 öğrenme hafızasına kaydeder. PDF ekran görüntülerindeki okunamayan ayrıntılar için görsel doğrulama gerekir.

## Canlı dağıtım ve özel arşiv
20 kaynak/57 özgün not için `scripts/prepare-ecu-study-seed.mjs` bir D1 SQL içe aktarım dosyası hazırlar. Cloudflare D1 uzaktan aktarımında açık `BEGIN TRANSACTION` veya `COMMIT` kullanılmaz; işlemi D1 yönettiği için kaynak SQL'inde yalnızca idempotent UPSERT kayıtları bulunur. Canlıya alındıktan sonra D1 sorgusunda `learned_ecu_sources=20` doğrulanmalıdır.

**Ayrım:** 20 kaynağın teknik prensipleri otomatik D1'de saklanır; telifli tam PDF metinleri yalnızca hesap sahibi oturumuyla özel kütüphane panelinden JSON olarak içe alınır. Bu ikinci aktarım bitmeden 1.152 parçanın canlı D1'e geldiği iddia edilmez. Hiçbir ECU cihazına yazma, silme veya D1 tablosu düşürme yapılmaz.


## Canlı Worker sağlık tanılaması
Canlı Worker HTTP 500 hatasında, `src/app-entry.js` istek işleyicisi genel bir 500 yanıtı üretir. Yalnızca `/api/health` kaynaklı işlenmeyen hatanın sınıfı ve sınırlı stack açıklaması özel D1 `logs` tablosuna `worker-runtime-exception` etiketiyle kaydedilir. Dağıtım akışı bunların son üçünü okuyabilir ve sağlık testi başarısızsa otomatik rollback yapar. Kullanıcı PDF içeriği veya istek başlıkları bu tanılama kaydına yazılmaz.

## Worker hizmet adı eşitleme
Cloudflare hesabında mevcut Worker hizmeti `hayirlievlad` olarak adlandırılmıştır. Canlı dağıtımın `wrangler.jsonc` adı, sağlık testi URL'si ve çalışan Cloudflare Worker adı birbiriyle aynı olmalıdır. `haydojarvis.workers.dev` hesap alt alanı ve `jarvis-db` D1 kimliği değiştirilmez. Canlı `/api/health` HTTP 200 doğrulaması olmadan dağıtım başarılı kabul edilmez.
