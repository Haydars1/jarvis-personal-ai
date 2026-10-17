# hayırlıevlad — güvenli kimlik geçişi

Bu belge yalnızca geçiş prosedürüdür. Mevcut çalışan servisi veya verileri silmeyin.

## 1. GitHub depo adı

Yeni hedef `Haydars1/hayirlievlad`. Repository Settings → General → Repository name üzerinden değiştirin; tüm Actions, erişim tokenları, koruma ayarları ve bağlı entegrasyonları kontrol edin. Projedeki GitHub bağlantısının `endpoint` alanını yeni adla güncelleyin. GitHub eski adrese yönlendirme yapabilir; geçmiş kayıtları ortadan kaldırmaz.

## 2. Cloudflare

`wrangler.hayirlievlad.jsonc` adlı yeni ve bağımsız yapılandırma yeni Worker'ın adını `hayirlievlad` yapar. **İlk aşamada workers_dev kapalı ve zamanlanmış görevleri boş**; geçiş onayı ve kimlik bilgilerinin doğrulanması olmadan herkese açık hâle getirmeyin.

D1 veritabanının kimliği aynen korunur: eski veriler fiziksel olarak taşınmaz veya silinmez. Production Worker, D1 ve kayıtlı şifrelenmiş Credential Vault'un bağlantılarını KESMEYİN.

Mevcut Worker'a bağlı tüm şifreli secret'ların **adlarını** Cloudflare Dashboard > Workers & Pages > ilgili Worker > Settings > Variables and Secrets kısmında tespit edin. Secret değerleri tekrar okunamaz. Yeni Worker'a aynı kimlik bilgileri güvenli yöntemle aktarılmadan giriş, OAuth, push veya vault çalışmayabilir. Credential master key'in key değerini değiştirmek, saklı API anahtarlarının çözülememesine yol açabilir. Hiçbir secret değerini repo, sohbet veya doküman içine yazmayın.

## 3. Yeni workers.dev URL'si

Hedef `https://hayirlievlad.hayirlievlad.workers.dev`. Bu adres **ancak Cloudflare hesap subdomain'i hayirlievlad olunca ve Worker oluşturulunca** çalışır. Hesap subdomain'inin değiştirilmesi aynı hesaptaki diğer Worker adreslerini de etkileyebilir; önce tüm Worker'ların envanterini ve bağımlılıklarını kontrol edin.

İlk aşamada yeni Worker'a erişimi Cloudflare Access ile sınırlandırın. Secret'lar ve D1 erişimi doğrulandıktan sonra `workers_dev` ve cron ayarlarını yeni Worker'da etkinleştirin; çift cron çalışmasına izin vermeyin. OAuth callback URL'lerini de yeni alan adına göre güncelleyin.

## 4. iOS

Yeni bundle ID `com.hayirlievlad.app`, Share Extension `com.hayirlievlad.app.share`, App Group `group.com.hayirlievlad.app` ve URL scheme `hayirlievlad`. Apple imzalama/provisioning profillerinde bu kimlikler ayarlanmalıdır. Önceki kimlik ile kurulu uygulama iOS tarafından farklı uygulama sayılır; yerel veriler, Keychain kayıtları ve kısayollar kendiliğinden taşınmaz. Eski kurulu uygulamayı yeni sürüm doğrulanmadan silmeyin.

Yeni backend alan adında passkey yeniden kaydı gerekebilir; çünkü WebAuthn kimlikleri alan adına bağlıdır. Yeni APNS bundle ID, imzalama ve bildirim gönderme ayarlarını doğrulayın.

## 5. Üretime geçiş kontrolü

- [ ] GitHub repo ve Actions erişimleri yeni isimde çalışıyor.
- [ ] Cloudflare'daki diğer Worker'ların subdomain değişikliğinden etkilenmeyeceği doğrulandı.
- [ ] Yeni Worker secret isimleri ve değerlerinin bulunduğu doğrulandı; credential vault eski master key ile çözülüyor.
- [ ] Yeni Worker D1 sorguları, oturum açma, ECU kanalları ve dosya yükleme çalışıyor.
- [ ] iOS imzası, giriş, Apple cihaz bağlantıları, Shortcuts ve push test edildi.
- [ ] Web, native, browser entegrasyon testleri geçti; sıfır kritik hata.
- [ ] Tek Worker cron görevlerini yürütüyor; ikisinde aynı anda açık değil.
- [ ] Rollback yolu mevcut ve önceki uygulama doğrulama süresince korunuyor.

**Bu dokümanın veya PR'ın oluşturulması yeni Cloudflare adresini, Github depo adını, secrets'ları veya cihazdaki uygulamayı kendiliğinden değiştirmez.**
