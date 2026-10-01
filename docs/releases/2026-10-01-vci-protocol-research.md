# THINKDIAG2 sürücü araştırması ve paket alıcısı

Hedef değişmedi: mevcut THINKDIAG2 üzerinden Jarvis içinde gerçek DTC okuma/silme, kodlama, adaptasyon ve servis işlemleri. Bu çalışma hedefi tamamlamaz; iletişim analizindeki uygulanabilir kısmı ekler.

## İncelenen kaynakların somut sonucu

- `jakubsamaj-hue/ThinkDiag_iOS_Project/BLEOBDAdapter.swift`: connect/disconnect boş; sendCommand cihazla konuşmadan sabit OK döndürür. Çalışan sürücü olarak kullanılmadı. Blob: ce5a17cb76e1f09552b2a6488139fe121a739485.
- `timryder/OpenCar`: README açıkça ELM327 cihazı belirtir. THINKDIAG2 uyumluluğu kanıtı değildir.
- `bullpowerhubgit/supermegabot/windsurf/scripts/thinkdiag2-letzter-versuch.py`: AT komutları ve tahmini başlangıç dizilerini seri porta gönderen deneme kodudur. Başarılı THINKDIAG2 oturumu veya OEM kodlama desteği göstermez. Bu diziler Jarvis'e alınmadı. Blob: 57e42c6408f023d0ecfcd44d18b233fafcc00456.
- `EffortlessMetrics/SwiftMTP-dev/Docs/SwiftMTP.docc/Devices/launch-thinkdiag-2-010e.md`: proposed durumundaki USB/MTP kimlik kaydı; teşhis sürücüsü değildir. Blob: 9bd2a6ff9ece10572f9dda93e80ea574fdefd66e.
- `thisisthecoolesthting/x431-ai-scanner`: gerçek çerçeve codec taslağı ve protokol araştırması vardır. docs/VCI-SPIKE-REPORT.md (blob d42f482e7d7c61c64c4719c14c67f1ce095355e3) ve docs/VCI-SPIKE-VERDICT.md (blob 8fb0c3b84fbb4cf50a5b0000d69710b1a0632d02) cihaz doğrulaması, handshake ve wire opcode eksiklerini açıkça belirtir. Android SPP desteği, iPhone THINKDIAG2 BLE sürücüsüne eşit değildir. README'nin OEM uygulama otomasyonu Android Accessibility kullanır. Üçüncü şahıs özel repolarına erişilmeye çalışılmadı.
- LAUNCH patent CN119292240A: kamuya açık tam bir örnek yanıt paketinde 55 AA başlık, iki bayt alan, big endian uzunluk, veri ve XOR kontrolü görülebilir. Bu örnek THINKDIAG2 firmware kimliği veya tam komut haritası vermez. İngilizce açıklamada istek örneklerinin uzunluğu tutarsızdır; tutarlı yanıt örneği bağımsız test vektörü seçildi.

Kaynaklar:
https://github.com/jakubsamaj-hue/ThinkDiag_iOS_Project
https://github.com/timryder/OpenCar
https://github.com/bullpowerhubgit/supermegabot
https://github.com/EffortlessMetrics/SwiftMTP-dev
https://github.com/thisisthecoolesthting/x431-ai-scanner/blob/main/docs/VCI-SPIKE-REPORT.md
https://github.com/thisisthecoolesthting/x431-ai-scanner/blob/main/docs/VCI-SPIKE-VERDICT.md
https://patents.google.com/patent/CN119292240A/en

## Uygulanan kısım

iPhone bağlantı ekranında gerçek keşfedilen notify/indicate kanallarını kullanıcı seçerek izleyebilir. CBPeripheral bildirimleri saat, karakteristik UUID'si ve ham hex olarak kaydedilir. En fazla 128 paket ve toplam 64 KiB; sınırda abonelikler kapanır. Veriler telefonda kalır, kullanıcı ShareLink ile paylaşabilir. Araç komutu, AT dizisi veya bilinmeyen başlangıç paketi gönderilmez. Bildirim aboneliği Bluetooth kontrol işlemidir; araç teşhis komutu değildir.

VciFrameInspector bağımsız, salt okunur aday çerçeve inceleyicisidir. Kamu örneğindeki biçim için kesin uzunluk ve XOR kontrolü yapar; parçalı/birleşik veri veya ek baytları otomatik doğru kabul etmez. Komut/ECU/DTC anlamı üretmez. Yayınlanan örnek, bozulmuş veri, kesilmiş veri, ek baytlar, bilinmeyen biçim ve boş giriş gerçek Swift testinde kontrol edilir.

Önemli sınır: Jarvis'in BLE bağlantısına gelen bildirimleri görmek ThinkDiag+ bağlantısının trafik kaydını almak değildir. Bazı cihazlar oturum açılmadan hiç bildirim göndermeyebilir. Bu çalışma THINKDIAG2 araç oturumu, DTC okuma/silme, kodlama, adaptasyon veya servis sıfırlamayı etkinleştirmez. Fiziksel cihaz testi henüz yoktur.
