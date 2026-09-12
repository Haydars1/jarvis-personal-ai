JARVIS v7.2 - AI CONNECTION CENTER

JARVIS v6 — SELF-IMPROVING

Yeni:
- NVIDIA NIM provider (https://integrate.api.nvidia.com/v1)
- GitHub tabanlı Self Update: "Jarvis, şu özelliği ekle" komutundan kod patch + PR
- GitHub Actions otomatik syntax + Wrangler dry-run testi
- Test geçerse otomatik merge ve Cloudflare deploy
- Deploy sonrası health check; başarısızsa Wrangler rollback
- Runtime hata kaydı ve 30 dakikada bir self-heal taraması

SELF UPDATE İÇİN TEK SEFERLİK BAĞLANTI:
1) Bu projeyi private GitHub repo'ya koy.
2) GitHub repo Actions secrets:
   CLOUDFLARE_API_TOKEN
   CLOUDFLARE_ACCOUNT_ID
   JARVIS_HEALTH_URL (örn. https://<worker>.<subdomain>.workers.dev/api/health)
3) JARVIS > Credential Manager:
   Provider: GitHub Self-Update
   API key/token: Fine-grained GitHub PAT (repo contents RW + pull requests RW)
   API base URL/endpoint alanı: OWNER/REPO
   Model alanı: main
   Yetenekler: self-update
4) TEST'e bas. Sonra Self Update sayfasında BAĞLI görünür.

NVIDIA:
- build.nvidia.com üzerinden API key oluştur.
- Credential Manager > NVIDIA NIM
- Model örneği: nvidia/nemotron-3.5-lightning-30b-a3b
- Yetenekler: chat,code,reasoning

NOT: Self Update, secret/config/workflow dosyalarını AI'ya değiştirtmez. İzinli kaynak yolları allowlist ile sınırlıdır.
