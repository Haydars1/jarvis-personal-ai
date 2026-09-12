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
        try decoder.decode(AuthStatus.self, from: request("/api/auth/status"))
    }

    func login(password: String) async throws {
        let data = try JSONSerialization.data(withJSONObject: ["password": password])
        _ = try await request("/api/auth/login", method: "POST", body: data)
    }

    func history(limit: Int = 160) async throws -> [ChatMessage] {
        try decoder.decode([ChatMessage].self, from: request("/api/chat/history", query: [URLQueryItem(name: "limit", value: String(limit))]))
    }

    func send(text: String) async throws -> ChatResponse {
        let data = try JSONSerialization.data(withJSONObject: ["text": text])
        return try decoder.decode(ChatResponse.self, from: request("/api/chat/send", method: "POST", body: data))
    }
}
