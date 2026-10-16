# Hayirlievlad Native iOS

SwiftUI tabanlı, yalnız kişisel kullanım için native Hayirlievlad istemcisi.

## Özellikler
- Mevcut Cloudflare Hayirlievlad backend'ine bağlanır.
- Hayirlievlad hesabı ile oturum açar ve cookie tabanlı oturumu korur.
- Native sohbet arayüzü.
- Türkçe Speech Recognition + AVSpeechSynthesizer ile hands-free konuşma.
- `hayirlievlad://voice`, `hayirlievlad://ask?q=...` ve `hayirlievlad://share` deep-link'leri.
- Siri / Shortcuts için App Intents.
- iOS Share Extension ile Safari ve diğer uygulamalardan Hayirlievlad'e metin/URL gönderme.
- App Group üzerinden ana uygulama ve Share Extension arasında güvenli yerel aktarım.

## Xcode projesini oluşturma
Mac'te:

```bash
brew install xcodegen
cd ios
xcodegen generate
open Hayirlievlad.xcodeproj
```

Xcode'da Hayirlievlad ve HayirlievladShare target'ları için kendi Apple Team hesabını seç. App Group capability altında `group.com.hayirlievlad.app` grubunu her iki target'a da ekle.

## Telefona yükleme
Xcode > Hayirlievlad target > Signing & Capabilities > Team seç. iPhone'u bağla, cihazı hedef seç ve Run'a bas.

## Siri / Action Button
Uygulama bir kez çalıştırıldıktan sonra Shortcuts içinde Hayirlievlad App Intent'leri görünür. `Hayirlievlad'i Aç` veya `Hayirlievlad'e Sor` kısayolunu oluşturup Action Button'a atayabilirsin. Siri üzerinden de kısayolu çağırabilirsin.

## Not
Apple, üçüncü taraf uygulamaların iPhone kilitliyken sürekli mikrofon dinleyip bağımsız `Hey Hayirlievlad` wake-word algılamasına izin vermez. Bunun yerine App Intent / Siri / Action Button ile Hayirlievlad açılır; uygulama açıkken hands-free konuşma devam eder.
