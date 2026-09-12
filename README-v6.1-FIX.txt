JARVIS v6.1 WINDOWS DEPLOY FIX

Bu surum v6 deploy paketindeki Windows CMD -> PowerShell escape hatasini duzeltir.

KULLANIM:
1) ZIP'i TAMAMEN bir klasore cikarin.
2) UPGRADE-V6-AND-DEPLOY.cmd dosyasina cift tiklayin.
3) Script mevcut Cloudflare login, D1 DB ve secret'lari korur.
4) CREDENTIAL_MASTER_KEY ve JARVIS_SECRET sadece yoksa olusturulur.
5) Deploy sonunda canli /api/health testi yapilir.

Duzeltilen hata:
PowerShell -Command icinde ^| karakterlerinin literal kalmasi nedeniyle ParserError olusuyordu.
Secret kontrolu artik CHECK-SECRETS.ps1 icinde yapilir; CMD icinde inline PowerShell pipe yoktur.
