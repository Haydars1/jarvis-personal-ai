JARVIS v7.2 - AI CONNECTION CENTER

JARVIS ULTIMATE - TEK PAKET

Bu paket onceki surumlerin yerine gecen birlesik Cloudflare surumudur.

ICINDE:
- PC kapaliyken de calisan Cloudflare Worker backend
- D1 kalici hafiza / gorev / log / credential / self-heal verisi
- R2 varsa bulut dosya kasasi; R2 yoksa deploy durmaz
- Mobil PWA arayuzu: orb + komut alani ustte, alt uygulama menusu, tek sutun kartlar
- Face ID / Passkey (iPhone Safari) ve Windows Hello/Passkey; parola yedek giris
- Turkce mikrofon + TTS
- Gemini, Groq, OpenRouter, NVIDIA NIM, Cloudflare AI ve OpenAI-compatible failover
- Sifreli Credential Vault (AES-GCM)
- AI Tool Scout
- Gmail + Drive Google OAuth altyapisi
- Facebook Page + Instagram Business onayli aksiyonlari
- URL'den dosya indirme -> R2 kasa (50 MB siniri, yerel/private adres engeli)
- GitHub uzerinden Self Update / Self Healing
- Runtime hata kaydi ve 30 dakikalik self-heal taramasi
- GitHub Actions test -> merge -> Cloudflare deploy -> health check -> rollback akis dosyalari

KURULUM / YUKSELTME:
1) ZIP'i TAMAMEN bir klasore cikart.
2) SETUP-AND-DEPLOY.cmd dosyasina cift tikla.
3) Cloudflare girisi istenirse onayla.
4) Script D1'i bulur/olusturur, R2'yi dener, schema uygular, secretlari korur/ilk kez olusturur, syntax + dry-run yapar, sonra deploy eder.
5) Canli adres: https://jarvis-personal-ai.haydojarvis.workers.dev

FACE ID:
- Ilk kez parola ile gir.
- Ayarlar -> FACE ID / PASSKEY EKLE.
- iPhone Face ID veya PC Windows Hello onayindan sonra sonraki girislerde parola yazmadan Passkey dugmesini kullan.

AI CREDENTIAL ORNEKLERI:
- NVIDIA NIM: provider=nvidia, secret=NVIDIA API key, model=NIM model adi, capabilities=chat,coding
- Gemini: provider=gemini, secret=Gemini API key
- Groq: provider=groq
- OpenRouter: provider=openrouter
- GitHub self-update: provider=github, secret=GitHub token, endpoint=owner/repo, model=main, capabilities=self-update

GOOGLE GMAIL + DRIVE:
Google OAuth istemcisi bir kez gerekir. Credential Manager'da:
- provider: google
- endpoint: Google OAuth Client ID (...apps.googleusercontent.com)
- secret: OAuth Client Secret
- capabilities: gmail,drive
Sonra Iletisim -> GOOGLE HESABINI BAGLA.
Google'in kendi onay ekrani, MFA/CAPTCHA ve servis kosullari JARVIS tarafindan atlanmaz.

META:
- provider: meta
- secret: Page access token
- endpoint: Facebook Page ID
- model: Instagram Business/Creator ID
- capabilities: facebook-post,instagram-post
Paylasimlar once onay kuyruguna girer.

SELF UPDATE:
GitHub baglantisi yapilinca "Jarvis, su ozelligi ekle" komutu kaynak kodu icin ayri branch/PR hazirlayabilir. Repo'daki GitHub Actions syntax ve Cloudflare dry-run testlerinden sonra merge/deploy eder. Canli health check basarisizsa rollback workflow'u devreye girer.

GERCEK SINIRLAR:
- Bir servise ait hesap/API/OAuth yetkisi ilk kez kullanici tarafindan verilir.
- CAPTCHA/MFA atlanmaz; sahte hesap acilmaz; kota kisitlari bagli diger saglayicilara failover ile yonetilir.
- Para/abonelik veya geri dondurulemez yuksek riskli islemler otomatik onaysiz yapilmaz.


v7.3: Credential Vault AES key normalization fix. Existing 48-byte secrets are SHA-256 normalized; new installs generate 32-byte AES-256 keys.
