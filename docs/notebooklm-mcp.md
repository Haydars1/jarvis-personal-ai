# NotebookLM MCP — ücretsiz hayırlıevlad bağlantısı

**Aktif tercih: Cloudflare Workers Free + Render Free.** Ücretli Cloudflare Containers sürümü sadece alternatif denemedir ve kullanılmıyor.

- Render Free paneli: https://dashboard.render.com/web/srv-dbegq8e7bikc738dc6e0
- Render HTTPS MCP adresi: https://hayirlievlad-notebooklm-mcp-free.onrender.com/mcp
- Servis kaynak kodu ve güvenli başlangıç: [services/notebooklm-render](../services/notebooklm-render/README.md)
- GitHub geliştirme dalı: `feature/notebooklm-mcp-readonly-20261024`

## Mevcut durum
Render üzerinde ücretsiz Docker servisi başarıyla ayağa kaldırıldı. Ancak Google NotebookLM hesabı yetkilendirilmedi. Bu nedenle servis normal olarak `setup_required` durumunda ve MCP çağrılarını reddediyor. Token olmadığı halde internete açık Google hesabına erişim **yok**. Bu durum gerçek NotebookLM bağlantısı değildir.

## Bağlantıyı tamamlama
1. Kullanıcı güvenli bir bilgisayarda notebooklm-py v0.8.5 ile `notebooklm login` yapar.
2. Render Dashboard'da **Environment** bölümünde `NOTEBOOKLM_AUTH_JSON` ve `NOTEBOOKLM_MCP_TOKEN` değerlerini kendisi kaydeder. Google oturum dosyasını sohbet/GitHub ile paylaşmaz.
3. Cloudflare Worker'ın `NOTEBOOKLM_MCP_TOKEN` gizli değeri Render'daki token ile aynı olacak şekilde güvenli biçimde tanımlanır. `NOTEBOOKLM_MCP_URL` HTTPS değişkeni geliştirme dalında zaten kayıtlı.
4. Staging ortamında `/api/notebooklm/status`, `/notebooks`, `/sources`, `/ask` test edilir. Ana sürüm merge ve production deploy onay gerektirir.

## Arayüz ve güvenlik
Hayırlıevlad sohbet panelinde 📚 NotebookLM seçici bulunur. Yalnız `notebook_list`, `source_list`, `chat_ask` isteklerine izin verilir. MCP kaynakları güvenilmeyen bilgi olarak ele alınmalıdır. Deneysel topluluk projesi Google NotebookLM'in resmî API'si değildir.

## Ücretsiz sınırlar
Render 750 ücretsiz saat/ay bütçesini çalışma alanının tüm Free web servisleri arasında paylaştırır. Ücretsiz web servisleri 15 dakika boş kalınca uyur. Yeni istekle açılma yaklaşık 1 dakika sürebilir; hayırlıevlad'ın MCP initialize akışı bu durumda güvenli yeniden deneme yapar. İlk açılışın gecikmesi ücretlendirme anlamına gelmez.

## ChatGPT hesabı
ChatGPT Plus planında özelleştirilmiş MCP sunucusu ekleme özelliği bulunmuyorsa bu bağlantı doğrudan ChatGPT'ye otomatik eklenemez. Hayırlıevlad üzerindeki bağlantı bundan bağımsızdır.

## Testler
`npm run check` ve GitHub Actions. Ayrıca gerçek Google oturumu kurulduktan sonra canlı MCP uçtan uca test gereklidir.

Kaynaklar:
- https://render.com/docs/free
- https://github.com/teng-lin/notebooklm-py/blob/main/docs/mcp-guide.md
