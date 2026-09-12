import AppIntents

struct OpenJarvisIntent: AppIntent {
    static var title: LocalizedStringResource = "JARVIS'i Aç"
    static var description = IntentDescription("JARVIS sesli asistanını açar.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        .result()
    }
}

struct AskJarvisIntent: AppIntent {
    static var title: LocalizedStringResource = "JARVIS'e Sor"
    static var description = IntentDescription("Bir soruyu JARVIS'e gönderir ve uygulamayı açar.")
    static var openAppWhenRun = true

    @Parameter(title: "Soru")
    var question: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: IntentDialog("JARVIS açıldı. Sorun uygulamaya hazır: \(question)"))
    }
}

struct JarvisShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenJarvisIntent(),
            phrases: [
                "\(.applicationName) aç",
                "\(.applicationName) ile konuş",
                "\(.applicationName) başlat"
            ],
            shortTitle: "JARVIS",
            systemImageName: "waveform.circle.fill"
        )
        AppShortcut(
            intent: AskJarvisIntent(),
            phrases: [
                "\(.applicationName) ile sor",
                "\(.applicationName) soru sor"
            ],
            shortTitle: "JARVIS'e Sor",
            systemImageName: "sparkles"
        )
    }
}
