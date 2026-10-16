import Foundation

struct AuthStatus: Decodable {
    let authenticated: Bool
}

struct ChatMessage: Identifiable, Codable {
    var id: String { "\(role)-\(createdAt)-\(content.hashValue)" }
    let role: String
    let content: String
    let provider: String?
    let createdAt: Double

    enum CodingKeys: String, CodingKey {
        case role, content, provider
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        role = try container.decodeIfPresent(String.self, forKey: .role) ?? "assistant"
        content = try container.decodeIfPresent(String.self, forKey: .content) ?? ""
        provider = try container.decodeIfPresent(String.self, forKey: .provider)
        createdAt = try container.decodeIfPresent(Double.self, forKey: .createdAt) ?? Date().timeIntervalSince1970
    }

    init(role: String, content: String, provider: String? = nil, createdAt: Double = Date().timeIntervalSince1970) {
        self.role = role
        self.content = content
        self.provider = provider
        self.createdAt = createdAt
    }
}

struct ChatResponse: Decodable {
    let reply: String
    let provider: String?
    let history: [ChatMessage]

    enum CodingKeys: String, CodingKey {
        case reply, provider, history
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        reply = try container.decodeIfPresent(String.self, forKey: .reply) ?? ""
        provider = try container.decodeIfPresent(String.self, forKey: .provider)
        history = try container.decodeIfPresent([ChatMessage].self, forKey: .history) ?? []
    }
}

struct APIErrorBody: Decodable {
    let error: String?
    let detail: String?
}
