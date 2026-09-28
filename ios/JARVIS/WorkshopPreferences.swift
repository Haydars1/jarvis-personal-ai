import Foundation
import Combine

@MainActor
final class WorkshopPreferences: ObservableObject {
    @Published var autoDiagnoseOnConnect: Bool {
        didSet { UserDefaults.standard.set(autoDiagnoseOnConnect, forKey: autoDiagnoseKey) }
    }

    @Published var autoStartProtocolLearning: Bool {
        didSet { UserDefaults.standard.set(autoStartProtocolLearning, forKey: learningKey) }
    }

    private let autoDiagnoseKey = "jarvis.workshop.autoDiagnoseOnConnect"
    private let learningKey = "jarvis.workshop.autoProtocolLearning"

    init() {
        if UserDefaults.standard.object(forKey: autoDiagnoseKey) == nil {
            autoDiagnoseOnConnect = true
        } else {
            autoDiagnoseOnConnect = UserDefaults.standard.bool(forKey: autoDiagnoseKey)
        }

        if UserDefaults.standard.object(forKey: learningKey) == nil {
            autoStartProtocolLearning = true
        } else {
            autoStartProtocolLearning = UserDefaults.standard.bool(forKey: learningKey)
        }
    }
}
