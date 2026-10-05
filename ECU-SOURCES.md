# JARVIS ECU Rulepack Kaynakları

JARVIS'in ECU tanıma motoru aşağıdaki açık kaynak projelerinden ve topluluk
belgelerinden derlenmiştir. Hiçbir proprietary DAMOS / A2L / tune dosyası
içermez.

## Bosch ME7 / ME7.5 (VAG 1.8T 20V, 2.7TT)
- [gunnar-die/Bosch-ME7-Tuning](https://github.com/gunnar-die/Bosch-ME7-Tuning) · GPL-3.0 — Audi 8E0909518AK XDF (TylerW compilation)
- [TracqiTechnology/MxT](https://github.com/TracqiTechnology/MxT) — ME7 M-box XDF profilleri (B5 S4/RS4 2.7T, B5/B6 A4 1.8T, Audi TT 1.8T, VW Golf 1.8T, Audi RS3/TTRS 2.5T MED17, VW Golf GTI 2.0 TFSI MED9)
- [AmesisProject/ME7Tuner](https://github.com/AmesisProject/ME7Tuner) · MIT — ME7Tuner Java uygulaması
- [bonacci31/20VT-Tuner-Helper](https://github.com/bonacci31/20VT-Tuner-Helper) — KFMIRL/KFMIOP/KFZWOP/LDRXN hesapları

## Bosch EDC15 / EDC16 (VAG dizel, 1998-2008)
- [tremaudanlenny-arch/breizhreprog (ZedSuite)](https://github.com/tremaudanlenny-arch/breizhreprog) — otomatik harita tespiti
- [LeZed97/ZedSuite](https://github.com/LeZed97/ZedSuite) — ana Rust tabanlı motor
- [H-ishak/ZedSuite](https://github.com/H-ishak/ZedSuite) — "dosyayı anla" felsefesi

## Bosch EDC17 (modern dizel, 2008-2020+)
- [ConnorHowell/medc17-checksum-tool](https://github.com/ConnorHowell/medc17-checksum-tool) — checksum/CVN düzeltme
- [bri3d/a2l2xdf](https://github.com/bri3d/a2l2xdf) — A2L → TunerPro XDF
- [Nefarious Motorsports forum](http://nefariousmotorsports.com/forum/) — EDC17 topluluk XDF paylaşımı

## VAG Simos 12 / 18
- [TheFlashBold/tune-editor](https://github.com/TheFlashBold/tune-editor) — web tabanlı editör, 8V0906264/06K906071/0D930001
- [TheFlashBold/simos12-to-simos18-conversion](https://github.com/TheFlashBold/simos12-to-simos18-conversion) — bench flash + ECU swap

## BMW MS41 / MS42 / MS43 / MSS52
- [CAATZ/bimmerstein-bin-analyzer](https://github.com/CAATZ/bimmerstein-bin-analyzer) — MS41/42/43 otomatik tespit
- [kmalinich/MSS52-XDF](https://github.com/kmalinich/MSS52-XDF) — BMW M5 E39 (S62B50)

## Yardımcı araçlar
- [veigy/XDF-Transfer-Tool](https://github.com/veigy/XDF-Transfer-Tool) — bir XDF'yi başka bir binary'ye taşı
- [emdzej/tunex](https://github.com/emdzej/tunex) — web tabanlı TunerPro editörü

## Honda
- [kelvinvalencio/cbr250rr-ecu-binary-definition](https://github.com/kelvinvalencio/cbr250rr-ecu-binary-definition) — CBR250RR XDF

---

## Önemli Notlar

**Doğrulama**: Her adres rulepack'teki kaynak referansıyla gelir. "✓ Doğrulanmış"
olarak işaretli aksiyonlar yukarıdaki kaynaklardan alınır. "⚠ Heuristik"
olarak işaretli olanlar JARVIS'in kendi scanner algoritmasının string konumuna
dayalı tahminleridir.

**Checksum**: EDC17 ve sonrası ECU'larda modifiye dosyayı yazmadan önce
checksum düzeltme ŞARTTIR. ConnorHowell/medc17-checksum-tool bunu yapar.
JARVIS şu an otomatik checksum düzeltme yapmıyor — gerekli olan ECU
ailelerinde (EDC17, MED17, Simos18) harici araç kullan.

**Yasal uyarı (DE)**: Niedersachsen'de DPF/EGR/AdBlue silme işlemi StVZO
gereğince yol araçlarında yasa dışıdır ve TÜV muayenesinde sorun çıkarır.
Tuning işini "track-only" veya ihracat araçları için yapmak, veya bu
işlemleri açıkça belgelemek gerekir. Carglanz adına imzalanacak işlerde
bu durumu müşteriye yazılı bildirmek risk azaltır.

**Üretim kullanımı için**: Gerçek dükkanlar WinOLS (€2000-5000) + DAMOS
abonelik veya ECM Titanium / Alientech Reflash plus kullanır. JARVIS
bu araçların yerini tutmaz — eğitim ve ön hazırlık için uygundur.
