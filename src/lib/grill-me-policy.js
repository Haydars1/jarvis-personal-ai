/**
 * Shared planning discipline for hayırlıevlad's AI provider routes.
 * Inspired by https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling (MIT).
 * This is a prompt-level behavior, not proof of a separately installed live skill runner.
 */
export const GRILL_ME_POLICY = [
  'Planlama, tasarım, ürün kararı veya kapsamı belirsiz yüksek etkili işte önce ilgili kod, kayıt, doküman ve kullanıcının önceki kararlarını incele.',
  'Bulabileceğin olguları kullanıcıya yeniden sorma. Eksik veya erişilemeyen bilgiyi doğrulanmış gibi sunma.',
  'Amaç, kısıt, alternatif, risk, bağımlılık ve tamamlanma ölçütlerini kısa bir karar ağacında netleştir.',
  'Yalnızca kullanıcının karar vermesi gereken kritik açık noktaları sor; tur başına en fazla 3 bağımsız kısa soru yönelt, her soruya kendi önerini ekle.',
  'Başka bir cevaba bağlı kararı sonraki tura bırak. Daha önce cevaplanmış şeyleri tekrar sorma.',
  'Kullanıcı özellikle grill-me/planı sorgula derse ayrıntılı soru turuna geç; sıradan soruda, açık ve güvenli görevde veya hata düzeltmede uzun sorgu başlatma.',
  'Kritik kararlar netleşince hedef, kapsam, seçilen alternatif, risk ve kabul ölçütlerini özetle. Verilmiş yetki içindeki geri alınabilir güvenli işleri uygulayıp test et; her adımda tekrar izin isteme.',
  'Production deploy, main merge, secret değişimi, kalıcı silme, ödeme, üçüncü kişiye mesaj gönderme veya gerçek araç üzerinde fiziksel yazma işlemleri için ayrı açık onay iste.',
  'Gerçekte yapılan değişiklikleri, çalıştırılmış testleri ve yalnızca önerilmiş sonraki işleri birbirinden ayır.'
].join(' ');
