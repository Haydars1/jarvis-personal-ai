import Foundation

struct EcuComputeStatus: Decodable {
    let tokenConfigured: Bool?
    let localOnline: Bool
    let cloudContainerReady: Bool
    let cloudUrlReady: Bool
    let preferred: String
}

struct EcuTrainingStatus: Decodable {
    let status: String
    let verifiedExamples: Int
    let minVerifiedExamples: Int
    let verifiedChangeEvidence: Int?
    let productionModel: EcuModelSummary?
}

struct EcuRulepackSummary: Decodable {
    let version: String
    let state: String
    let verified: Bool
    let evidenceCount: Int?
}

struct EcuRulepackStatus: Decodable {
    let latest: EcuRulepackSummary?
    let production: EcuRulepackSummary?
}

struct EcuModelSummary: Decodable, Identifiable {
    var id: String { version }
    let version: String
    let state: String?
    let benchmarkScore: Double?
    let datasetVersion: String?
}

struct EcuJobResult: Decodable {
    let ecu_family: String?
    let confidence: Double?
    let map_candidates: [EcuMapCandidate]?
}

struct EcuMapCandidate: Decodable {}

struct EcuJob: Decodable, Identifiable {
    let id: String
    let fileId: String?
    let state: String
    let workerKind: String?
    let result: EcuJobResult?
}

struct EcuJobsResponse: Decodable { let jobs: [EcuJob] }
struct EcuModelsResponse: Decodable { let models: [EcuModelSummary] }

struct EcuUploadFile: Decodable {
    let id: String
    let sha256: String?
}

struct EcuUploadResponse: Decodable {
    let file: EcuUploadFile
    let job: EcuJob
}

final class EcuBrainAPI {
    private let baseURL = URL(string: "https://jarvis-personal-ai.haydojarvis.workers.dev")!
    private let session: URLSession
    private let decoder = JSONDecoder()

    init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 180
        session = URLSession(configuration: config)
    }

    private func request(_ path: String, method: String = "GET", body: Data? = nil, headers: [String:String] = [:]) async throws -> Data {
        var req = URLRequest(url: URL(string: path, relativeTo: baseURL)!)
        req.httpMethod = method
        req.httpBody = body
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        for (key,value) in headers { req.setValue(value, forHTTPHeaderField: key) }
        let (data,response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            let text = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw NSError(domain: "ECU", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey:text])
        }
        return data
    }

    func computeStatus() async throws -> EcuComputeStatus {
        let data = try await request("/api/ecu/compute/status")
        return try decoder.decode(EcuComputeStatus.self, from: data)
    }

    func trainingStatus() async throws -> EcuTrainingStatus {
        let data = try await request("/api/ecu/training/status")
        return try decoder.decode(EcuTrainingStatus.self, from: data)
    }

    func jobs() async throws -> [EcuJob] {
        let data = try await request("/api/ecu/jobs?limit=20")
        return try decoder.decode(EcuJobsResponse.self, from: data).jobs
    }

    func rulepackStatus() async throws -> EcuRulepackStatus {
        let data = try await request("/api/ecu/rulepacks/status")
        return try decoder.decode(EcuRulepackStatus.self, from: data)
    }

    func models() async throws -> [EcuModelSummary] {
        let data = try await request("/api/ecu/models?limit=20")
        return try decoder.decode(EcuModelsResponse.self, from: data).models
    }

    func analyze(data: Data, filename: String, mimeType: String = "application/octet-stream") async throws -> EcuUploadResponse {
        let encoded = filename.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? filename
        let payload = try await request("/api/ecu/analyze-file", method: "POST", body: data, headers: [
            "Content-Type": mimeType,
            "X-ECU-Filename": encoded,
        ])
        return try decoder.decode(EcuUploadResponse.self, from: payload)
    }

    func stage1Preview(fileId: String) async throws -> EcuJob {
        let body = try JSONSerialization.data(withJSONObject: ["fileId": fileId, "operation": "stage1_proposal"])
        let payload = try await request("/api/ecu/jobs", method: "POST", body: body, headers: ["Content-Type":"application/json"])
        struct ResponseBody: Decodable { let job: EcuJob }
        return try decoder.decode(ResponseBody.self, from: payload).job
    }

    func rollback(version: String) async throws {
        _ = try await request("/api/ecu/models/\(version.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? version)/rollback", method: "POST")
    }
}
