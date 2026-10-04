# 6006 PERFORMANCE — Floot'tan Cloudflare'a Geçiş Tasarımı

Tarih: 2026-10-04
Branch: `6006-performance`
Durum: Tasarım onayı sonrası yazılı spesifikasyon

## Amaç

6006 PERFORMANCE projesini Floot bağımlılığından tamamen çıkarmak; geliştirme, test, backend ve yayın akışını günlük işlem kotası olmayan, GitHub merkezli ve Cloudflare üzerinde çalışan kalıcı bir mimariye taşımak.

Başarı ölçütleri:

- Floot olmadan site geliştirilebilmeli, test edilebilmeli ve yayınlanabilmeli.
- `6006-performance` branch'i kaynak gerçekliği (source of truth) olmalı.
- Ana site, üç dil, arıza kütüphanesi, araç seçici, araç-özel sistem şemaları, müşteri chat'i ve admin işlevleri korunmalı.
- JARVIS `main` branch'ine hiçbir 6006 değişikliği karışmamalı.
- Production deploy, secret değişikliği ve destructive işlemler ayrı ve kontrollü kalmalı.

## Mimari

### 1. Kaynak kod

GitHub repo: `Haydars1/jarvis-personal-ai`

6006 için aktif branch: `6006-performance`

`main` JARVIS'e aittir ve 6006 ile birleştirilmeyecektir.

Geçiş tamamlandıktan sonra 6006 için ayrı repo oluşturulması tercih edilir; ancak bu, Cloudflare geçişini engelleyen bir önkoşul değildir. İlk hedef mevcut branch'i güvenli şekilde Cloudflare'a deploy edilebilir hale getirmektir.

### 2. Frontend

Mevcut 6006 React/TypeScript deneyimi korunur. Floot'a özgü importlar, yardımcılar ve runtime varsayımları sökülür.

Frontend aşağıdakileri içermeye devam eder:

- Premium koyu/ivory/gold/forest görsel sistem
- DE / TR / EN dil paketi
- Ana sayfa ve servis alanları
- Arıza kodu kütüphanesi
- Arıza detay sayfaları
- Marka → Model → Kasa/Seri → Yıl → Motor araç seçimi
- Araç profiline göre teknik sistem şemaları
- Desteklenmeyen araçta açık generic fallback
- Müşteri chat launcher
- Responsive mobil görünüm

### 3. Cloudflare hosting

Statik frontend Cloudflare Pages üzerinde yayınlanır.

API ve backend işlevleri Cloudflare Workers üzerinde çalışır.

İlk aşamada Cloudflare'ın mevcut `pages.dev` / `workers.dev` adresleri kullanılır. Özel domain daha sonra bağlanabilir.

### 4. Veritabanı

Cloudflare D1 kullanılacak.

Asgari tablolar:

#### conversations
- id
- created_at
- updated_at
- status: `ai_active | human_active | waiting | closed`
- page_path
- fault_code
- vehicle_profile_key
- raw_vehicle_text
- language
- visitor_session_id
- contact_name
- contact_phone
- contact_email
- preferred_contact
- assigned_to
- ai_resume_enabled

#### messages
- id
- conversation_id
- sender: `visitor | ai | owner | system`
- body
- created_at

#### notification_milestones
- id
- conversation_id
- milestone
- created_at
- unique constraint on `(conversation_id, milestone)`

#### push_subscriptions
- id
- owner_id
- endpoint
- p256dh
- auth
- created_at
- updated_at

#### admin_users
İlk sürümde kullanıcı şifresi uygulama DB'sinde tutulmak zorunda değildir; admin erişimi Cloudflare Access ile korunabilir.

### 5. KV kullanımı

Cloudflare KV yalnız hafif ve geçici veriler için kullanılır:

- rate limit sayaçları
- kısa süreli session yardımcı verileri
- AI/chat idempotency anahtarları
- feature/config cache

Kalıcı chat içeriği KV'de tutulmaz; D1 kaynak gerçekliğidir.

### 6. Admin erişimi

Floot'un `owner@6006.local` hesabı ve Floot auth sistemi kullanılmayacak.

Tercih edilen yaklaşım: Cloudflare Access ile `/admin` ve `/api/admin/*` rotalarını yalnız yetkili işletme e-postasına açmak.

Böylece uygulama içinde ayrıca parola saklama, parola reset ekranı ve parola hash yönetimi gerekmeyecek.

Admin özellikleri:

- aktif sohbet listesi
- sohbet detay ekranı
- `Chat übernehmen`
- owner mesajı gönderme
- `AI wieder aktivieren`
- araç / arıza / iletişim bağlamını görüntüleme
- push aboneliği yönetimi

### 7. Chat davranışı

Visitor chat public olacaktır, admin chat public olmayacaktır.

Akış:

1. Ziyaretçi chat açar.
2. Worker konuşma kaydı oluşturur.
3. Mesaj D1'e yazılır.
4. AI aktifse AI yanıtı üretilir ve D1'e eklenir.
5. Anlamlı milestone oluşursa owner bildirimi tetiklenir.
6. Owner admin'den devralırsa konuşma `human_active` olur.
7. Bu durumda AI yeni ziyaretçi mesajlarına cevap vermez.
8. Owner AI'ı tekrar açarsa durum `ai_active` olur.

HTTP polling yerine mümkün olduğunda Cloudflare uyumlu gerçek-zaman yaklaşımı kullanılacaktır. İlk güvenli sürümde SSE veya Durable Object değerlendirilebilir; gereksiz karmaşıklık oluşursa kısa aralıklı polling yalnız geçiş aşamasında kabul edilir.

### 8. AI katmanı

AI çağrıları yalnız Worker backend üzerinden yapılır.

API anahtarları hiçbir zaman frontend bundle içine girmez.

Dil seçimine göre cevap dili DE/TR/EN olur.

AI güvenlik davranışı:

- arıza kodunu kesin parça teşhisi gibi sunmaz
- tek DTC = kesin arızalı parça demez
- kritik fren/yağ/hararet gibi durumlarda güvenlik uyarısı verir
- human takeover sırasında cevap üretmez

Model sağlayıcısı ilk geçişte soyut bir `AiProvider` arayüzü arkasına alınır. Böylece OpenAI veya başka sağlayıcı sonradan değiştirilebilir.

### 9. Push bildirimleri

Floot Push kaldırılır.

Standart Web Push kullanılacaktır.

Owner bir kez admin panelinde push izni verir ve subscription backend'e kaydedilir.

Notification milestone örnekleri:

- ziyaretçi telefon numarası bıraktı
- araç bilgisi tamamlandı
- arıza kodu + semptom birlikte verildi
- ziyaretçi insan desteği istedi

Aynı milestone tekrar tekrar bildirim üretmez.

### 10. Dil sistemi

DE / TR / EN yapısı korunur.

Dil localStorage'da kalabilir; chat oluşturulurken dil backend conversation kaydına da yazılır.

Arıza kodlarının kendisi çevrilmez. Başlık, sistem, açıklama, semptom, neden, teşhis ve çözüm metinleri seçilen dile göre gösterilir.

Eksik lokalizasyon varsa yanlış içerik üretmek yerine Almanca kaynak fallback kullanılabilir.

### 11. Araç profili ve şemalar

Araç seçimi:

`Marka → Model → Kasa/Seri → Yıl → Motor`

Profile resolution sırası:

1. exact vehicle profile
2. platform profile
3. engine profile
4. generic/system fallback

Desteklenen ilk detaylı profiller:

- VW Passat B8 2.0 TDI CRLB
- BMW G20/G21 320d B47
- Ford Focus MK4 2.0 EcoBlue
- Mercedes W213/S213 E220d OM654

Doğrulanmamış araçta parça konumu uydurulmaz.

Örnek: Passat B8 CRLB için doğrulanmış fabrika SCR/AdBlue düzeni yoksa ADBLUE ekranı araç-özel tank konumu göstermez; generic SCR şemasına düşer ve bunu kullanıcıya açıkça belirtir.

### 12. Test stratejisi

GitHub Actions her push'ta en az şunları çalıştırır:

- unit tests
- localization tests
- vehicle profile tests
- fault visual tests
- chat state/race tests
- TypeScript typecheck
- production build

Production deploy testlerden ayrıdır. CI başarılı olmak production'a otomatik basmak anlamına gelmez.

### 13. Deployment stratejisi

Aşamalar:

1. Floot bağımlılıklarını GitHub kodundan sök.
2. Cloudflare uyumlu frontend build elde et.
3. D1 schema/migrations oluştur.
4. Worker API katmanını ekle.
5. Preview deployment oluştur.
6. Preview üzerinde mobil/desktop smoke test yap.
7. Chat + admin + araç şemalarını doğrula.
8. Production Cloudflare deploy yalnız açık onayla yapılır.
9. Yeni production doğrulandıktan sonra eski Floot site kullanım dışı bırakılır.

### 14. Floot'tan taşınacaklar

Taşınacak:

- UI tasarımı
- 3 dil içeriği
- fault data
- araç katalogları/profilleri
- fault visualization mantığı
- chat davranışları
- admin davranışları

Taşınmayacak:

- `@floot/*` paketleri
- Floot auth
- Floot database helper'ları
- Floot push
- Floot publish akışı
- Floot runtime endpoint yapısı
- Floot project metadata / checkpoint bağımlılığı

### 15. Veri geçişi

Mevcut Floot DB'de yalnız test/erken dönem verileri varsa bunların production'a zorunlu taşınması gerekmez.

Gerçek müşteri verisi tespit edilirse önce export alınır ve D1'e kontrollü migration yapılır.

Veri silme veya Floot projesini kapatma migration tamamlanmadan yapılmaz.

### 16. Güvenlik

- Secret'lar yalnız Cloudflare secret/env içinde tutulur.
- Frontend'e secret gömülmez.
- Admin rotaları Cloudflare Access ile korunur.
- Public chat endpoint'leri rate-limit edilir.
- Input boyutu ve schema validation uygulanır.
- SQL parametreli sorgular kullanılır.
- CORS yalnız gerekli origin'lere izin verir.
- Human takeover race condition backend state ile çözülür.
- Production secret değişikliği manuel/onaylı adımdır.

## Kabul kriterleri

Geçiş tamamlanmış sayılabilmesi için:

- Floot kapalı olsa bile site geliştirme/test süreci devam etmeli.
- Cloudflare preview site açılmalı.
- DE/TR/EN çalışmalı.
- Arıza araması ve detay rotaları çalışmalı.
- Araç seçici ve araç-özel fallback mantığı çalışmalı.
- Chat D1'e mesaj yazmalı/okumalı.
- Admin erişimi Floot hesabı olmadan çalışmalı.
- Human takeover AI yarış koşulunu engellemeli.
- Tüm CI testleri geçmeli.
- Production deploy Floot'a ihtiyaç duymamalı.

## Sınır dışı / sonraya bırakılanlar

- Özel domain satın alma
- Ücretli servis satın alma
- WhatsApp Business API kurulumu
- Native iOS/Android uygulaması
- Floot projesinin/desenlerinin destructive silinmesi

Bunlar ayrı onay ve ayrı çalışma olarak ele alınacaktır.
