---
name: grill-me
version: 1.0.0
description: Plan, tasarim veya kritik karar isteginde, mevcut bilgileri kendi bularak kullaniciyla belirsizlikleri ve riskleri netlestiren Turkce gereksinim sorgulama becerisi.
license: MIT
---

# Grill Me | Sorgula, Netlestir, Sonra Uygula

Kaynak fikir: Matt Pocock, https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling (MIT). Bu dosya, hayirlievlad ve 6006 Coding icin bagimsiz Turkce uyarlamadir.

## Ne zaman kullanilir?
- Kullanici "grill me", "planimi sorgula", "fikirde acik bul", "kararlari netlestir" derse.
- Belirsiz, yuksek etkili urun/mimari/finansal/operasyonel kararda **yalnizca kritik kullanici tercihleri** eksikse.
- Basit bilgi sorusu, acik ve guvenli kod degisikligi, bilinen hata duzeltmesi, tek seferlik metin veya rutin islerde uzun mulakat baslatma.

## Karar agaci ve soru turlari
1. Once repo, dokuman, arac, onceki karar ve mevcut uygulamayi incele. Sistemden bulunabilen gercekleri **kullaniciya sorma**. Gorulemeyen kaynak icin goruldu deme.
2. Hedef, kapsam, mevcut durum, bagimliliklar, alternatifler, kabul kriterleri ve riskleri ayir. Olgularla kullanicinin verecegi kararlari karistirma.
3. Yalnizca bagimsiz ve engelleyici kararlar icin sor. Varsayilan olarak tur basina en fazla 3 kisa soru; dikkat gerektiren durumlarda tek soru. Her birine "**Onerim:** ..." ekle. "Evet" onerdigin secenegi kabul etmek icin yeterli olsun.
4. Bir cevabi digerine bagli soruyu sonraki tura birak. Kullanici daha once cevap verdiyse tekrar sorma. Kullanici "devam" dediyse ve acik karar kalmadiysa bekleme, ilerle.
5. Yeterince netlesince kisa karar ozeti yaz: **amac, kapsam, secilen yol, reddedilen alternatif, riskler, kabul kriterleri**. Kritik kullanici onayi gerekiyorsa yalnizca bunu iste.
6. Verilmis yetki dahilinde geri alinabilir, guvenli, kapsam ici kod duzenlemelerini uygula ve test et. Onayli planin her kucuk adiminda yeniden izin isteme.
7. Production deploy, main merge, secret degisikligi, kalici silme, harcama, disariya mesaj gonderme, gercek araca/ECU'ya yazma gibi etkileri ayrica acik onaya tabi tut. Is bittiginde gercekten test edilenle yalnizca planlananlari ayir.

## Cikti bicimi
- Gerekiyorsa soru: **Kritik karar** / **Onerim** / **Neden**.
- Plan bittiginde: karar ozeti ve kabul kriterleri.
- Uygulama bittiginde: degisen dosyalar, gercek testler, kalan engeller ve PR/branch baglantisi.
- Kullanici Turkce ister; Almanca musteriye yonelik icerik icin Turkce karsiligini da sun.

## Sinir
Bu SKILL.md bir ajan calisma talimatidir. Tek basina canli site ozelligi, ChatGPT hesabina plugin kurulumu veya calisan servis entegrasyonu kaniti degildir.
