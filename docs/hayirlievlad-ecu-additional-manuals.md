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

## Durum
Sadece ayrı bir geliştirme dalı ve PR. Üretim yayını, cihaz/ECU yazımı, mevcut D1 silme, gizli anahtar değişikliği yok.
