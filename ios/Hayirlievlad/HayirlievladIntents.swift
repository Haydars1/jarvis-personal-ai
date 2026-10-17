import AppIntents
import Foundation

struct OpenHayirlievladIntent: AppIntent {
    static var title: LocalizedStringResource = "hayırlıevlad'ı Aç"
    static var description = IntentDescription("hayırlıevlad sesli asistanını açar.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        .result()
    }
}

struct AskHayirlievladIntent: AppIntent {
    static var title: LocalizedStringResource = "hayırlıevlad'a Sor"
    static var description = IntentDescription("Bir soruyu hayırlıevlad'a gönderir ve uygulamayı açar.")
    static var openAppWhenRun = true

    @Parameter(title: "Soru")
    var question: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let defaults = UserDefaults(suiteName: "group.com.hayirlievlad.app")
        defaults?.set(question, forKey: "pendingIntentText")
        return .result(dialog: IntentDialog("hayırlıevlad sorunu aldı."))
    }
}

struct AskClipboardHayirlievladIntent: AppIntent {
    static var title: LocalizedStringResource = "Panodakini hayırlıevlad'a Sor"
    static var description = IntentDescription("Kopyaladığın metni hayırlıevlad'a gönderir.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let text = await SystemActions.shared.clipboardText(), !text.isEmpty else {
            throw SystemActionError.emptyClipboard
        }
        UserDefaults(suiteName: "group.com.hayirlievlad.app")?.set("Bunu incele ve bana yardımcı ol: \(text)", forKey: "pendingIntentText")
        return .result(dialog: IntentDialog("Panodaki içerik hayırlıevlad'a hazırlandı."))
    }
}

struct AddHayirlievladCalendarEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Takvime Ekle"
    static var description = IntentDescription("hayırlıevlad ile Apple Takvim'e etkinlik ekler.")

    @Parameter(title: "Başlık") var title: String
    @Parameter(title: "Başlangıç") var start: Date
    @Parameter(title: "Süre (dakika)", default: 60) var durationMinutes: Int

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await SystemActions.shared.addCalendarEvent(title: title, start: start, durationMinutes: durationMinutes)
        return .result(dialog: IntentDialog("Takvime eklendi."))
    }
}

struct AddHayirlievladReminderIntent: AppIntent {
    static var title: LocalizedStringResource = "Hatırlatıcı Ekle"
    static var description = IntentDescription("hayırlıevlad ile Apple Hatırlatıcılar'a kayıt ekler.")

    @Parameter(title: "Başlık") var title: String
    @Parameter(title: "Zaman") var due: Date?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await SystemActions.shared.addReminder(title: title, due: due)
        return .result(dialog: IntentDialog("Hatırlatıcı eklendi."))
    }
}

struct HayirlievladShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: OpenHayirlievladIntent(), phrases: ["\(.applicationName) aç", "\(.applicationName) ile konuş", "\(.applicationName) başlat"], shortTitle: "hayırlıevlad", systemImageName: "waveform.circle.fill")
        AppShortcut(intent: AskHayirlievladIntent(), phrases: ["\(.applicationName) ile sor", "\(.applicationName) soru sor"], shortTitle: "hayırlıevlad'a Sor", systemImageName: "sparkles")
        AppShortcut(intent: AskClipboardHayirlievladIntent(), phrases: ["\(.applicationName) panodakini sor", "\(.applicationName) kopyaladığımı sor"], shortTitle: "Panodakini Sor", systemImageName: "doc.on.clipboard")
        AppShortcut(intent: AddHayirlievladCalendarEventIntent(), phrases: ["\(.applicationName) takvime ekle"], shortTitle: "Takvime Ekle", systemImageName: "calendar.badge.plus")
        AppShortcut(intent: AddHayirlievladReminderIntent(), phrases: ["\(.applicationName) hatırlatıcı ekle"], shortTitle: "Hatırlatıcı Ekle", systemImageName: "checklist")
    }
}
