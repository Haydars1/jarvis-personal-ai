# JARVIS ECU Local Bridge

Bu klasördeki bridge, Cloudflare'daki JARVIS ile kullanıcının Windows bilgisayarındaki gerçek araç arayüzü arasında taşıma katmanıdır.

## Mantık

1. JARVIS'te **ECU Studio → CİHAZ → YENİ BRIDGE TOKEN** ile bir bridge oluşturulur.
2. Token bilgisayarda ortam değişkeni olarak saklanır.
3. `ecu-bridge.mjs` JARVIS'e heartbeat gönderir ve yerel adapter'ın ilan ettiği yetenekleri bildirir.
4. JARVIS yalnızca adapter'ın açıkça desteklediği işleri bu bridge'e verir.
5. Bridge işi `ECU_ADAPTER_URL/execute` adresindeki yerel adapter'a gönderir.
6. Gerçek sonuç gelmeden job `completed` olmaz.

## Çalıştırma

Node.js 22+:

```powershell
$env:JARVIS_URL="https://haydojarvis.workers.dev"
$env:JARVIS_BRIDGE_TOKEN="<ECU Studio'nun verdiği token>"
$env:ECU_ADAPTER_URL="http://127.0.0.1:8765"
node .\local-bridge\ecu-bridge.mjs
```

Yerel adapter iki endpoint sağlamalıdır:

- `GET /capabilities` → `{"capabilities":["read_dtc","read_live_data",...]}`
- `POST /execute` → body içindeki `job` nesnesini çalıştırır ve `{"ok":true,"result":{...}}` döndürür.

Adapter hiçbir yetenek bildirmezse JARVIS **hiçbir cihaz işini claim ettirmez**. Bu özellikle yazma ve servis işlemlerinde güvenlik içindir.

## Donanım katmanı

Bridge donanım markasına bağlı değildir. ECU programlama aracı, J2534 pass-through, UDS/KWP/CAN adapter veya başka bir yerel servis ayrı bir adapter olarak eklenebilir. JARVIS donanım desteklenmiyorsa başarı uydurmaz; job bekler veya hata döner.
