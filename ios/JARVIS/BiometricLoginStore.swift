import Foundation
import LocalAuthentication
import Security

enum BiometricLoginError: LocalizedError {
    case notAvailable
    case notSaved
    case invalidData
    case keychain(OSStatus)

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Face ID bu cihazda kullanılamıyor."
        case .notSaved:
            return "Face ID için kayıtlı giriş yok. Önce parolayla giriş yap."
        case .invalidData:
            return "Kayıtlı giriş bilgisi okunamadı."
        case .keychain(let status):
            if status == errSecUserCanceled {
                return "Face ID iptal edildi."
            }
            return "Face ID girişi açılamadı. Kod: \(status)"
        }
    }
}

final class BiometricLoginStore {
    static let shared = BiometricLoginStore()

    private let service = "com.haydojarvis.jarvis.login"
    private let account = "jarvis-password"
    private let enabledKey = "jarvisBiometricLoginEnabled"

    private init() {}

    var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: enabledKey)
    }

    func availabilityTitle() -> String {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return "Face ID"
        }
        switch context.biometryType {
        case .faceID:
            return "Face ID ile Giriş Yap"
        case .touchID:
            return "Touch ID ile Giriş Yap"
        default:
            return "Biyometrik Giriş Yap"
        }
    }

    func canUseBiometrics() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    func savePassword(_ password: String) throws {
        guard canUseBiometrics() else { throw BiometricLoginError.notAvailable }
        guard let data = password.data(using: .utf8) else { throw BiometricLoginError.invalidData }

        var accessError: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            &accessError
        ) else {
            throw BiometricLoginError.invalidData
        }

        SecItemDelete(baseQuery() as CFDictionary)

        let item: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessControl as String: access,
            kSecValueData as String: data
        ]

        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else { throw BiometricLoginError.keychain(status) }
        UserDefaults.standard.set(true, forKey: enabledKey)
    }

    func readPassword() throws -> String {
        guard isEnabled else { throw BiometricLoginError.notSaved }
        guard canUseBiometrics() else { throw BiometricLoginError.notAvailable }

        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecUseOperationPrompt as String] = "JARVIS'e Face ID ile giriş yap"

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status != errSecItemNotFound else { throw BiometricLoginError.notSaved }
        guard status == errSecSuccess else { throw BiometricLoginError.keychain(status) }
        guard let data = result as? Data, let password = String(data: data, encoding: .utf8), !password.isEmpty else {
            throw BiometricLoginError.invalidData
        }
        return password
    }

    func clear() {
        SecItemDelete(baseQuery() as CFDictionary)
        UserDefaults.standard.removeObject(forKey: enabledKey)
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
