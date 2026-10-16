import AppIntents
import Foundation

struct OpenJarvisIntent: AppIntent {
    static var title: LocalizedStringResource = "hayırlıevlad'ı Aç"
    static var description = IntentDescription("hayırlıevlad sesli asistanını açar.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        .result()
    }
}

struct AskJarvisIntent: AppIntent {
    static var title: LocalizedStringResource = "hayırlıevlad'a Sor"
    static var description = IntentDescription("Bir soruyu hayırlıevlad'a gönderir ve uygulamayı açar.")
    static var openAppWhenRun = true

    @Parameter(title: "Soru")
    var question: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let defaults = UserDefaults(suiteName: "group.com.haydojarvis.jarvis")
        defaults?.set(question, forKey: "pendingIntentText")
        return .result(dialog: IntentDialog("hayırlıevlad sorunu aldı."))
    }
}

struct AskClipboardJarvisIntent: AppIntent {
    static var title: LocalizedStringResource = "Panodakini hayırlıevlad'a Sor"
    static var description = IntentDescription("Kopyaladığın metni hayırlıevlad'a gönderir.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let text = await SystemActions.shared.clipboardText(), !text.isEmpty else {
            throw SystemActionError.emptyClipboard
        }
        UserDefaults(suiteName: "group.com.haydojarvis.jarvis")?.set("Bunu incele ve bana yardımcı ol: \(text)", forKey: "pendingIntentText")
        return .result(dialog: IntentDialog("Panodaki içerik hayırlıevlad'a hazırlandı."))
    }
}

struct AddJarvisCalendarEventIntent: AppIntent {
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

struct AddJarvisReminderIntent: AppIntent {
    static var title: LocalizedStringResource = "Hatırlatıcı Ekle"
    static var description = IntentDescription("hayırlıevlad ile Apple Hatırlatıcılar'a kayıt ekler.")

    @Parameter(title: "Başlık") var title: String
    @Parameter(title: "Zaman") var due: Date?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await SystemActions.shared.addReminder(title: title, due: due)
        return .result(dialog: IntentDialog("Hatırlatıcı eklendi."))
    }
}

struct JarvisShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: OpenJarvisIntent(), phrases: ["\(.applicationName) aç", "\(.applicationName) ile konuş", "\(.applicationName) başlat"], shortTitle: "hayırlıevlad", systemImageName: "waveform.circle.fill")
        AppShortcut(intent: AskJarvisIntent(), phrases: ["\(.applicationName) ile sor", "\(.applicationName) soru sor"], shortTitle: "hayırlıevlad'a Sor", systemImageName: "sparkles")
        AppShortcut(intent: AskClipboardJarvisIntent(), phrases: ["\(.applicationName) panodakini sor", "\(.applicationName) kopyaladığımı sor"], shortTitle: "Panodakini Sor", systemImageName: "doc.on.clipboard")
        AppShortcut(intent: AddJarvisCalendarEventIntent(), phrases: ["\(.applicationName) takvime ekle"], shortTitle: "Takvime Ekle", systemImageName: "calendar.badge.plus")
        AppShortcut(intent: AddJarvisReminderIntent(), phrases: ["\(.applicationName) hatırlatıcı ekle"], shortTitle: "Hatırlatıcı Ekle", systemImageName: "checklist")
    }
}
