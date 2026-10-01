# PDF kaynakları, THINKDIAG2 ve kalibrasyon — 1 Ekim 2026

## Uygulanan bağlantılar

- Üç yüklenen PDF'nin gerçek GitHub bağlantılarından 214 benzersiz repo çıkarıldı. `data/pdf-repository-provenance.json` her bağlantının PDF adı ve sayfasını korur.
- GitHub metaverisi toplama döngüsü artık ayrı OBD listesini de içerir: toplam 223 kaynak. Önceden yalnız 154 genel seed taranıyordu.
- CI her PDF reposunun erişilebilirliğini, güncel commit'ini ve o commit'teki README'nin SHA-256'sını tek tek doğrular. Eksik repo ve README eksikliği ayrı sonuçtur. Upstream install scriptleri çalıştırılmaz.
- Araçlar → PDF GitHub Becerileri 214 repo için lisans/metaveri ve bağlantı durumunu gösterir. Kaynak inceleme işi gerçekten bulut kuyruğuna gider; sonuçlar ayrı alınır. Bir kaynak bağlantısı, projenin uygulamasının kurulmuş olduğu anlamına gelmez.
- THINKDIAG2 + ThinkDiag+ + iOS profili kullanıcı ekranlarıyla doğrulandı. Seri numarası ve hesap bilgileri repoya eklenmedi.
- `cubigato/thinkcar-tc-reader` biçim belgesine dayalı JavaScript format adaptörü eklendi; Apache lisansı korundu. Gerçek upstream örnekte 203 kayıt/32 sütun ve yinelenen parametrelerin farklı birimleri doğrulandı. CSV/JSON aktarımı, min/max/ortalama ve ECU sohbet kaydı çalışır. Tarayıcı okuyucusu dosyayı cihaz içinde işler.
- PDF.js 6.3.289 ile metin PDF raporu yerelde okunur. P/B/C/U arıza kodları, subtype ve bağlam çıkarılır. Taranmış PDF için OCR gerektiği gösterilir; sahte okuma sonucu üretilmez.
- iOS Share Extension PDF/TC dosyalarını App Group üzerinden JARVIS'e bekleyen ek olarak aktarır. PDFKit PDF metnini yerelde çıkarır. Dosya gönderimi kullanıcı tarafından yapılır. Dosyalar 10 MB ile sınırlandırılır.
- ECU Studio ayrı ORI/MOD yükleme ve aynı boyut/adres kontrolü, Intel HEX checksum/adres/EOF/overlap doğrulaması, ORI hash'iyle eşleşen JSON map tanımı, ölçek/endian/sınır doğrulaması ve proje değişiklik raporu içerir.

## Map tanımı

Bu sürümün düzenleme adaptörü JSON tanımı kullanır. A2L/XDF/RomRaider depoları kaynak bağlantısı olarak katalogdadır; bu formatların parser'ı bu sürümde hazır sayılmaz. Map adresi dosya içi offset'tir; Intel HEX taban adresi ayrıca raporlanır.

```json
{
  "version": 1,
  "original_sha256": "ORI dosyasının 64 karakter SHA-256 değeri",
  "maps": [{"id":"example","name":"Doğrulanmış map adı","address":"0x100","rows":1,"columns":4,"type":"u16","endian":"le","factor":0.1,"offset":0,"min":0,"max":500,"unit":"birim"}]
}
```

## Açık sınırlar

THINKCAR'ın doğrulanmış SDK/protokolü ve fiziksel cihaz testi olmadan doğrudan THINKDIAG2 Bluetooth kumandası veya flash desteği iddia edilmez. ELM327/J2534/SocketCAN repoları bu cihazla native uyumlu kabul edilmez. ThinkDiag+ paylaşım formatı app sürümüne göre değişebilir; TC örneği upstream cihaz kaydıdır, kullanıcının kendi cihazı henüz test edilmedi.

ECU checksum algoritması, ECU HW/SW'ye uygun doğrulanmış map tanımı, güvenilir yazma cihazı ve gerçek doğrulama gerektirir. Intel HEX satır checksum'ı ECU checksum'ı değildir. Bu sürüm otomatik Stage 1, A2L/XDF import veya KT200 flash sürücüsü içermez. Güç hesabı için kayıt zamanını tahmin etmez.

Yerel GPU/LLM/otomasyon projeleri ayrı çalışma ortamı ister. OpenAI uyumlu LLM bağlantısı yapılandırılabilir; laptop kapalıyken laptop servisi çalışmaz. Kaynakların hepsinin işlevlerinin kurulmuş olduğu iddia edilmez.

## Doğrulama

154 birim/davranış testi geçti. Tam Worker HTTP hattına ThinkDiag profili, kayıt importu, rapor ayrıştırma, sohbet saklama ve 214-repo katalog kontrolleri eklendi. CI gerçek tarayıcıda TC/PDF dosya seçimi, map hücresi düzenleme, ORI/MOD ve mobil katalog testlerini; Apple runner'da iOS build'i çalıştırır. Son CI/dağıtım kanıtları tamamlandıktan sonra bu rapora eklenir.
