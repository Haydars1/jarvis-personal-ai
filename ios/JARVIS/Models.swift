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
}

struct ChatResponse: Decodable {
    let reply: String
    let provider: String?
    let history: [ChatMessage]
}

struct APIErrorBody: Decodable {
    let error: String?
    let detail: String?
}
