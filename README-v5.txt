JARVIS v5 - Credential Manager + Multi AI

YENI:
- Sifreli Credential Vault (AES-GCM)
- Gemini / Groq / OpenRouter / OpenAI-compatible servisleri arayuzden ekleme
- Anahtarlar tarayicida duz metin olarak saklanmaz
- Baglanti testi, aktif/pasif, oncelik ve silme
- AI failover artik Cloudflare Secret'larina ek olarak kasadaki servisleri de otomatik dener
- Kota/hata alan servis loglanir ve sonraki uygun saglayiciya gecilir
- Mevcut master key deploylarda korunur

YUKSELTME:
1. ZIP'i tamamen cikart.
2. UPGRADE-V5-AND-DEPLOY.cmd dosyasini calistir.
3. Deploy bittiginde JARVIS acilir.
4. Credential Manager'a gir.
5. Kullanmak istedigin servislerin kendi resmi API key/token bilgisini bir kere ekle.
6. TEST dugmesine bas. Basarili servisler JARVIS tarafindan otomatik kullanilir.

ONEMLI:
- JARVIS sifre/kota/odeme duvarlarini atlatmaz.
- MFA/CAPTCHA/abonelik satin alma gibi insan veya finansal onay isteyen adimlarda otomatik bypass yapmaz.
- Para/abonelik ve geri dondurulemez yuksek riskli aksiyonlar onay gerektirir.
- Google Cloud yonetiminde gerekli IAM/OAuth yetkilendirmesi Google tarafindan bir kez verilmelidir; Gmail'e giris tek basina Google Cloud IAM yetkisi vermez.
