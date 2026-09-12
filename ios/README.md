# JARVIS Native iOS

SwiftUI tabanlı, yalnız kişisel kullanım için native JARVIS istemcisi.

## Özellikler
- Mevcut Cloudflare JARVIS backend'ine bağlanır.
- JARVIS hesabı ile oturum açar ve cookie tabanlı oturumu korur.
- Native sohbet arayüzü.
- Türkçe Speech Recognition + AVSpeechSynthesizer ile hands-free konuşma.
- `jarvis://voice`, `jarvis://ask?q=...` ve `jarvis://share` deep-link'leri.
- Siri / Shortcuts için App Intents.
- iOS Share Extension ile Safari ve diğer uygulamalardan JARVIS'e metin/URL gönderme.
- App Group üzerinden ana uygulama ve Share Extension arasında güvenli yerel aktarım.

## Xcode projesini oluşturma
Mac'te:

```bash
brew install xcodegen
cd ios
xcodegen generate
open JARVIS.xcodeproj
```

Xcode'da JARVIS ve JARVISShare target'ları için kendi Apple Team hesabını seç. App Group capability altında `group.com.haydojarvis.jarvis` grubunu her iki target'a da ekle.

## Telefona yükleme
Xcode > JARVIS target > Signing & Capabilities > Team seç. iPhone'u bağla, cihazı hedef seç ve Run'a bas.

## Siri / Action Button
Uygulama bir kez çalıştırıldıktan sonra Shortcuts içinde JARVIS App Intent'leri görünür. `JARVIS'i Aç` veya `JARVIS'e Sor` kısayolunu oluşturup Action Button'a atayabilirsin. Siri üzerinden de kısayolu çağırabilirsin.

## Not
Apple, üçüncü taraf uygulamaların iPhone kilitliyken sürekli mikrofon dinleyip bağımsız `Hey JARVIS` wake-word algılamasına izin vermez. Bunun yerine App Intent / Siri / Action Button ile JARVIS açılır; uygulama açıkken hands-free konuşma devam eder.
