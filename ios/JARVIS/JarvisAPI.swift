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
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 75
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

    func send(text: String, attachments: [NativeAttachment] = [], channel: String? = nil, channelId: String? = nil) async throws -> ChatResponse {
        var payload: [String: Any] = ["text": text]
        if let channel, !channel.isEmpty { payload["channel"] = channel }
        if let channelId, !channelId.isEmpty { payload["channelId"] = channelId }
        if !attachments.isEmpty {
            payload["attachments"] = attachments.map {
                ["name": $0.name, "type": $0.mimeType, "base64": $0.data.base64EncodedString()]
            }
        }
        let data = try JSONSerialization.data(withJSONObject: payload)
        let response = try await request("/api/chat/send", method: "POST", body: data)
        return try decoder.decode(ChatResponse.self, from: response)
    }

    func cloudToolJob(_ jobId: String) async throws -> CloudToolJobStatus {
        let encoded = jobId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? jobId
        let data = try await request("/api/tools/cloud/jobs/\(encoded)")
        return try decoder.decode(CloudToolJobStatus.self, from: data)
    }

    func ecuChannels(query: String = "") async throws -> [EcuChannel] {
        var items: [URLQueryItem] = []
        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            items.append(URLQueryItem(name: "q", value: query))
        }
        let data = try await request("/api/ecu/channels", query: items)
        struct Response: Decodable { let channels: [EcuChannel] }
        return try decoder.decode(Response.self, from: data).channels
    }

    func ecuChannelMessages(_ channelId: String) async throws -> [ChatMessage] {
        let encoded = channelId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? channelId
        let data = try await request("/api/ecu/channels/\(encoded)/messages")
        struct Response: Decodable { let messages: [ChatMessage] }
        return try decoder.decode(Response.self, from: data).messages
    }

    func renameEcuChannel(_ channelId: String, title: String) async throws {
        let encoded = channelId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? channelId
        let body = try JSONSerialization.data(withJSONObject: ["title": title])
        _ = try await request("/api/ecu/channels/\(encoded)", method: "PATCH", body: body)
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

    func syncVehicleCodingResearch(brand: String, pages: Int = 3) async throws -> VehicleCodingResearchSyncResponse {
        let payload: [String: Any] = [
            "brand": brand,
            "pages": max(1, min(10, pages))
        ]
        let body = try JSONSerialization.data(withJSONObject: payload)
        let data = try await request("/api/vehicle/coding-research/sync", method: "POST", body: body)
        return try decoder.decode(VehicleCodingResearchSyncResponse.self, from: data)
    }

    func vehicleCodingResearchCatalog(brand: String) async throws -> VehicleCodingResearchCatalogResponse {
        let data = try await request(
            "/api/vehicle/coding-research/catalog",
            query: [URLQueryItem(name: "brand", value: brand)]
        )
        return try decoder.decode(VehicleCodingResearchCatalogResponse.self, from: data)
    }

    func vehicleCodingResearchStatus() async throws -> VehicleCodingResearchStatusResponse {
        let data = try await request("/api/vehicle/coding-research/status")
        return try decoder.decode(VehicleCodingResearchStatusResponse.self, from: data)
    }

    func reportRuntimeIssue(message: String, context: String, userText: String? = nil) async {
        var payload: [String: Any] = [
            "message": message,
            "context": context
        ]
        if let userText, !userText.isEmpty {
            payload["userText"] = userText
        }
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        do {
            _ = try await request("/api/runtime/report", method: "POST", body: data)
        } catch {
            // Reporting must never create another user-visible error.
        }
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


struct VehicleCodingResearchOperation: Codable, Hashable {
    let kind: String
    let byte: Int?
    let bit: Int?
    let enabled: Bool?
    let channel: String?
    let value: String?
}

struct VehicleCodingResearchCandidate: Codable, Identifiable, Hashable {
    let id: String
    let target: String
    let brands: [String]
    let query: String
    let title: String
    let feature: String
    let module: String
    let channel: String
    let value: String
    let applicability: String
    let vehicle: String?
    let platform: String?
    let sourceUrl: String
    let sourceTitle: String
    let sourceKind: String
    let confidence: Double
    let status: String
    let observedAt: Double
    let coding: String?
    let operations: [VehicleCodingResearchOperation]?
}

struct VehicleCodingResearchCatalogResponse: Decodable {
    let target: String?
    let brands: [String]?
    let candidates: [VehicleCodingResearchCandidate]
    let total: Int?
}

struct VehicleCodingResearchTargetStatus: Decodable, Identifiable {
    var id: String { targetID }
    let targetID: String
    let brands: [String]
    let queryCount: Int
    let candidates: Int
    let updatedAt: Double?

    enum CodingKeys: String, CodingKey {
        case targetID = "id"
        case brands, queryCount, candidates, updatedAt
    }
}

struct VehicleCodingResearchStatusResponse: Decodable {
    let targets: [VehicleCodingResearchTargetStatus]
    let targetCount: Int
    let totalCandidates: Int
    let googleConfigured: Bool
    let githubTokenConfigured: Bool
}

struct VehicleCodingResearchSyncResult: Decodable {
    let target: String
    let brands: [String]
    let added: Int
    let errors: [String]
}

struct VehicleCodingResearchSyncResponse: Decodable {
    let ok: Bool
    let result: VehicleCodingResearchSyncResult
    let status: VehicleCodingResearchStatusResponse
}
