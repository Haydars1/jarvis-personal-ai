# JARVIS ECU Teknik Bilgi Kütüphanesi — 10 PDF

## Amaç
Kullanıcının gönderdiği **10 kılavuzu / 908 PDF sayfasını** mevcut ECU Kataloğu içinde ayrı bir teknik bilgi kaynağına dönüştürmek. Amaç bir sorguda yeniden PDF taramak değil; **bir defa içe alıp sürekli ve kaynaklı bilgi olarak kullanmak**.

### Kapsam
| Kaynak ID | PDF adı | Sayfa |
|---|---|---:|
| edc15p_suite | EDC15PSuite manual.pdf | 31 |
| bosch_ms4 | ecu_ms_4_sport_en.pdf | 23 |
| megasquirt3_setup | Megasquirt3_Setting_Up-1.5.pdf | 179 |
| emu_pro_gdi | How-to_Tune_the_GDI_Engine_in_EMU_PRO.pdf | 47 |
| motronic_313331_checksum | Motronic checksum correction.pdf | 4 |
| motronic_155_checksum | m1.5.5.pdf | 5 |
| emu_pro_software | EMU_PRO_Software_Guide.pdf | 168 |
| megasquirt3_tunerstudio | Megasquirt3_TunerStudio_MS_Lite_Reference-1.5.pdf | 356 |
| vag_edc15p_maps | VAG EDC15 Maps.pdf | 21 |
| bosch_me_motronic | me-motronic-seinni.pdf | 74 |

Metinlerin tamamı burada sohbet dosyalarından çıkarılarak **1041 parça** olarak özel bir import paketine aktarıldı. Sayfa, parça, kaynak PDF, SHA-256, görsel uyarısı ve kaynak etiketleri tutulur. Diyagramların tam yorumu ayrıca orijinal PDF'de kontrol edilmelidir.

## İki katmanlı öğrenme

1. **Kavramsal uzun süreli öğrenme:** `manual-learning-foundations.js` kaynak kitaplara bağlı, yeniden yazılmış teknik prensipleri içerir. `POST /api/ecu/manual-library/activate` bu prensipleri yeni `source_type='ecu-manual'` satırları olarak *zaten mevcut* `learning_sources` ve `learning_chunks` hafızasına **yalnızca ekler**. JARVIS'in mevcut sohbet öğrenme mantığı bu bilgileri başka kod değişikliğine gerek kalmadan kullanabilir. *Bu model ağırlıklarını yeniden eğitmek değildir.*
2. **Kaynakların bütün metninin kalıcı kitaplığı:** `JARVIS_ECU_10_PDF_BILGI_PAKETI.json` dosyası yalnızca giriş yapılmış JARVIS ekranından içe aktarılır. D1'de `ecu_manual_library_documents` ve `ecu_manual_library_passages` tabloları oluşturulur. **Aynı aktarımda tüm sayfa metinleri küçük parçalar halinde mevcut `learning_sources` ve `learning_chunks` hafızasına da eklenir.** JARVIS'in önceden var olan öğrenme mekanizması, sonraki uygun sohbetlerde bilgiye ulaşabilir; her ECU eyleminden önce yeni PDF tarama kodu eklenmemiştir. Başka hiçbir ECU tablosu veya ECU binary güncellenmez. 1041 parça / 908 PDF sayfası tam aktarılana kadar durum eksik olarak gösterilir.

## Giriş ve güvenlik
- GitHub **herkese açık** olduğundan tam PDF metinleri, sayfa dökümleri veya orijinal kitap dosyaları GitHub commit'lerinde yoktur. Yalnızca özgün özetler ve çalışma kodu eklidir.
- Özel JSON paketi kullanıcıya burada teslim edilir; yüklemek için `ECU Kataloğu > ECU Teknik Bilgi Kütüphanesi > ŞİMDİ ÖĞREN / KAYDET` yolu kullanılır.
- API: `GET /api/ecu/manual-library/concepts`, `GET /stats`, `GET /search?q=`, `GET /page?doc=&page=`, `POST /activate`, `POST /import`. Her birinde JARVIS oturumu doğrulanır.
- `POST /import` 8'e kadar kayıt alır; arayüz Cloudflare D1 sınırlarına uyum için 6 kayıtlık paketlerle aktarır, SHA-256 sürüm uyuşmazlıklarını engeller. Tekrar gönderim kayıtları çoğaltmaz.
- Öğrenilmiş açıklamalar doğrulanmamış ECU yazılımına doğrudan kalibrasyon değişikliği yapmaz. Motor, araç ve HW/SW versiyonu uyumu ayrıca doğrulanır.
- PDF metinleri olası talimat enjeksiyonuna karşı **güvenilmeyen kaynak verisi** olarak değerlendirilmelidir.
- Eski bilgi kanalları, tuning haritaları, checksum araçları, KT200 ve Thinkdiag işlevleri aynı kalır.
- **Mevcut her ECU eylemi öncesinde özel PDF araması eklenmedi**; kavramsal prensipler zaten mevcut JARVIS öğrenme hafızasında tutulur. Ayrıntılı sayfa araması kullanıcı isterse kitabın kendi panelinde yapılır.

## Kurulum ve doğrulama
1. `npm run check` ve Cloudflare dry-run testlerini GitHub PR'da kontrol et.
2. Yeni modülü kullanıma almak için PR'ları **inceleyip isteğe bağlı** birleştir/deploy et; bu adımlar otomatik yapılmaz.
3. JARVIS ECU Kataloğu'nu açınca kavramsal öğrenme otomatik etkinleşir.
4. Özel `JARVIS_ECU_10_PDF_BILGI_PAKETI.json` dosyasını bir kez yükle. Sonuç `10 PDF / 908 sayfa / 1041 parça` olmalı.
5. `torque limiter`, `lambda`, `checksum`, `GDI` aramalarıyla bilginin kaynak sayfaya bağlı olduğunu doğrula.

**Durum:** PR açıkken kod henüz canlı JARVIS'de etkin değildir ve özel PDF paketi Cloudflare D1'e yüklenmiş sayılmaz.
