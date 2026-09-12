import Foundation

final class JarvisAPI {
    private let baseURL = URL(string: "https://jarvis-personal-ai.haydojarvis.workers.dev")!
    private let session: URLSession
    private let decoder: JSONDecoder

    init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 35
        session = URLSession(configuration: config)
        decoder = JSONDecoder()
    }

    private func makeURL(_ path: String, query: [URLQueryItem] = []) -> URL {
        var c = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        c.path = path.hasPrefix("/") ? path : "/" + path
        c.queryItems = query.isEmpty ? nil : query
        return c.url!
    }

    private func request(_ path: String, method: String = "GET", body: Data? = nil, query: [URLQueryItem] = []) async throws -> Data {
        var req = URLRequest(url: makeURL(path, query: query))
        req.httpMethod = method
        req.httpBody = body
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            let parsed = try? decoder.decode(APIErrorBody.self, from: data)
            throw NSError(domain: "JARVIS", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: parsed?.detail ?? parsed?.error ?? "HTTP \(http.statusCode)"])
        }
        return data
    }

    func authStatus() async throws -> AuthStatus {
        let data = try await request("/api/auth/status")
        return try decoder.decode(AuthStatus.self, from: data)
    }

    func login(password: String) async throws {
        let data = try JSONSerialization.data(withJSONObject: ["password": password])
        _ = try await request("/api/auth/login", method: "POST", body: data)
    }

    func history(limit: Int = 160) async throws -> [ChatMessage] {
        let data = try await request("/api/chat/history", query: [URLQueryItem(name: "limit", value: String(limit))])
        return try decoder.decode([ChatMessage].self, from: data)
    }

    func send(text: String, attachments: [NativeAttachment] = []) async throws -> ChatResponse {
        var payload: [String: Any] = ["text": text]
        if !attachments.isEmpty {
            payload["attachments"] = attachments.map {
                ["name": $0.name, "type": $0.mimeType, "base64": $0.data.base64EncodedString()]
            }
        }
        let data = try JSONSerialization.data(withJSONObject: payload)
        let response = try await request("/api/chat/send", method: "POST", body: data)
        return try decoder.decode(ChatResponse.self, from: response)
    }

    func googleSetupInfo() async throws -> GoogleSetupInfo {
        let data = try await request("/api/google/setup-info")
        return try decoder.decode(GoogleSetupInfo.self, from: data)
    }

    func googleConnect() async throws -> GoogleConnectInfo {
        let data = try await request("/api/google/connect")
        return try decoder.decode(GoogleConnectInfo.self, from: data)
    }

    func registerPushToken(_ token: String, environment: String, appBundle: String) async throws {
        let payload: [String: Any] = [
            "token": token,
            "environment": environment,
            "appBundle": appBundle
        ]
        let data = try JSONSerialization.data(withJSONObject: payload)
        _ = try await request("/api/mobile/push/register", method: "POST", body: data)
    }

    func pushStatus() async throws -> Data {
        try await request("/api/mobile/push/status")
    }
}

struct GoogleSetupInfo: Decodable {
    let configured: Bool
    let connected: Bool
    let redirect: String?
    let clientId: String?

    enum CodingKeys: String, CodingKey {
        case configured
        case connected
        case redirect
        case clientId = "client_id"
    }
}

struct GoogleConnectInfo: Decodable {
    let url: String?
    let redirect: String?
    let setupRequired: Bool?
    let detail: String?
    let error: String?
}
