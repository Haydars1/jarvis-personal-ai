# THINKDIAG2 doğrudan bağlantı çalışması

Hedef: iPhone JARVIS uygulamasından kullanıcının mevcut THINKDIAG2 cihazına bağlanıp desteklenen araçlarda teşhis, DTC silme, kodlama, adaptasyon, basic setting, aktüatör testi ve servis sıfırlama işlemlerini yürütmek.

## Eklenen gerçek bağlantı katmanı

iOS uygulamasında `+ → OBD cihazına bağlan` menüsü açılır. Kullanıcı Bluetooth taramasını başlatır, bulunan BLE cihazlarından kendi cihazını seçer, bağlantı kurulur ve gerçek GATT servis/karakteristik UUID'leri ile özellikleri keşfedilir. Kullanıcı bağlantıyı kesebilir ve keşif sonucunu paylaşabilir. Cihaz adı model kimliği olarak doğrulanmış kabul edilmez.

Tarama 15 saniye, bağlantı ve servis keşfi 12 saniye ile sınırlıdır. Yetki reddi, Bluetooth kapalı olması, bağlantı hatası ve kopma ayrı gösterilir. Ekran kapatılırken veya uygulama arka plana geçerken bağlantı ve tarama kapatılır. Liste en fazla 128 cihaz tutar. Kullanıcı seçmeden cihaza bağlantı kurulmaz. Veriler sunucuya otomatik gönderilmez.

## Tamamlanmayan cihaz sürücüsü

Bu katman BLE keşfi ve GATT bağlantısıdır; THINKDIAG2 araç oturumu değildir. UUID, kimlik doğrulama veya paket biçimi tahmin edilmez. Karakteristik yazma, bildirim aboneliği ve araç komutu gönderimi yoktur. Hata okuma/silme, kodlama, adaptasyon, basic setting, aktif test ve servis sıfırlama henüz çalışmaz. UI bu durumu açıkça bildirir.

Sonraki bağımlılık: doğrulanmış THINKDIAG2 iletişim protokolü/SDK, aktivasyon/oturum desteği, araç/ECU fonksiyon verileri ve fiziksel cihaz doğrulaması. TC dosya okuyucusu bu bağımlılığı karşılamaz. BLE bulunabilirliği ve üretici doğrulaması mevcut fiziksel cihazla henüz test edilmemiştir.

## Doğrulama

CI iOS simulator Debug ve iPhone Release uygulamalarını Apple runner'da derler; üretilen uygulamanın Bluetooth izin açıklamasını kontrol eder. Derleme, fiziksel Bluetooth veya araç işlemleri testi yerine geçmez.

Apple Core Bluetooth kaynakları: https://developer.apple.com/documentation/corebluetooth/ ve https://developer.apple.com/documentation/corebluetooth/cbcentralmanager/scanforperipherals(withservices:options:)
