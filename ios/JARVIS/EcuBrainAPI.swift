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
    let automaticHypotheses: Int?
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

struct EcuResearchCounts: Decodable {
    let sources: Int?
    let claims: Int?
    let corroborated_claims: Int?
    let verified_claims: Int?
    let github_sources: Int?
    let github_high_trust_sources: Int?
    let github_repositories: Int?
    let github_reusable_repositories: Int?
}

struct EcuResearchStatus: Decodable {
    let status: String?
    let mode: String?
    let cadenceHours: Double?
    let paidApiRequired: Bool?
    let counts: EcuResearchCounts?
}

struct EcuResearchRun: Decodable {
    let skipped: Bool?
    let sourcesFound: Int?
    let claimsFound: Int?
    let errors: Int?
    let corroborated: Int?
    let verified: Int?
    let reason: String?
}

struct EcuResearchGap: Decodable, Identifiable {
    let id: String
    let ecuFamily: String
    let hw: String
    let sw: String
    let operationLabel: String
    let lastResearchedAt: Int
    let attempts: Int
    let lastSourcesFound: Int
    let lastClaimsFound: Int
}

struct EcuResearchGapsResponse: Decodable {
    let gaps: [EcuResearchGap]
}

struct EcuGitHubRepository: Decodable, Identifiable {
    var id: String { repository }
    let repository: String
    let license: String?
    let reusePolicy: String?
    let stars: Int?
    let capabilities: [String]?
    let defaultBranch: String?
    let commitSha: String?
    let lastSeenAt: Int?
}

struct EcuGitHubRepositoriesResponse: Decodable {
    let repositories: [EcuGitHubRepository]
}

struct EcuModelSummary: Decodable, Identifiable {
    var id: String { version }
    let version: String
    let state: String?
    let benchmarkScore: Double?
    let datasetVersion: String?
}

struct EcuMutationSummary: Decodable {
    let changed_maps: Int?
    let changed_cells: Int?
}

struct EcuJobProposal: Decodable {
    let release_ready: Bool?
    let checksum_support: String?
    let reasons: [String]?
    let mutation: EcuMutationSummary?
}

struct EcuJobResult: Decodable {
    let ecu_family: String?
    let confidence: Double?
    let map_candidates: [EcuMapCandidate]?
    let proposal: EcuJobProposal?
}

struct EcuMapCandidate: Decodable {}

struct EcuJob: Decodable, Identifiable {
    let id: String
    let fileId: String?
    let operation: String?
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

struct EcuTrainingPair: Decodable, Identifiable {
    let id: String
    let state: String
    let operationLabel: String?
    let runFingerprint: String?
}

struct EcuTrainingPairResponse: Decodable {
    let pair: EcuTrainingPair
}

struct EcuServiceAvailability: Decodable, Identifiable {
    var id: String { self.idValue }
    private let idValue: String
    let title: String
    let operation: String
    let state: String
    let available: Bool
    let rulepackVersion: String?
    let matchTier: String?
    let checksumKnown: Bool
    let checksumSource: String?

    enum CodingKeys: String, CodingKey {
        case idValue = "id"
        case title, operation, state, available, rulepackVersion, matchTier, checksumKnown, checksumSource
    }
}

struct EcuServiceAvailabilityResponse: Decodable {
    let services: [EcuServiceAvailability]
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

    func researchStatus() async throws -> EcuResearchStatus {
        let data = try await request("/api/ecu/research/status")
        return try decoder.decode(EcuResearchStatus.self, from: data)
    }

    func runResearch() async throws -> EcuResearchRun {
        let data = try await request("/api/ecu/research/run", method: "POST")
        return try decoder.decode(EcuResearchRun.self, from: data)
    }

    func researchGaps(limit: Int = 20) async throws -> [EcuResearchGap] {
        let data = try await request("/api/ecu/research/gaps?limit=\(max(1,min(100,limit)))")
        return try decoder.decode(EcuResearchGapsResponse.self, from: data).gaps
    }

    func githubRepositories(limit: Int = 20) async throws -> [EcuGitHubRepository] {
        let data = try await request("/api/ecu/research/github?limit=\(max(1,min(100,limit)))")
        return try decoder.decode(EcuGitHubRepositoriesResponse.self, from: data).repositories
    }

    func models() async throws -> [EcuModelSummary] {
        let data = try await request("/api/ecu/models?limit=20")
        return try decoder.decode(EcuModelsResponse.self, from: data).models
    }

    func uploadFile(data: Data, filename: String, mimeType: String = "application/octet-stream") async throws -> EcuUploadFile {
        let encoded = filename.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? filename
        let payload = try await request("/api/ecu/files", method: "POST", body: data, headers: [
            "Content-Type": mimeType,
            "X-ECU-Filename": encoded,
        ])
        struct ResponseBody: Decodable { let file: EcuUploadFile }
        return try decoder.decode(ResponseBody.self, from: payload).file
    }

    func analyze(data: Data, filename: String, mimeType: String = "application/octet-stream") async throws -> EcuUploadResponse {
        let encoded = filename.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? filename
        let payload = try await request("/api/ecu/analyze-file", method: "POST", body: data, headers: [
            "Content-Type": mimeType,
            "X-ECU-Filename": encoded,
        ])
        return try decoder.decode(EcuUploadResponse.self, from: payload)
    }

    func trainingPairs(limit: Int = 20) async throws -> [EcuTrainingPair] {
        let payload = try await request("/api/ecu/training/pairs?limit=\(max(1, min(100, limit)))")
        struct ResponseBody: Decodable { let pairs: [EcuTrainingPair] }
        return try decoder.decode(ResponseBody.self, from: payload).pairs
    }

    func createTrainingPair(oriFileId: String, modFileId: String, operationLabel: String) async throws -> EcuTrainingPair {
        let body = try JSONSerialization.data(withJSONObject: [
            "oriFileId": oriFileId,
            "modFileId": modFileId,
            "operationLabel": operationLabel,
        ])
        let payload = try await request("/api/ecu/training/pairs", method: "POST", body: body, headers: ["Content-Type":"application/json"])
        return try decoder.decode(EcuTrainingPairResponse.self, from: payload).pair
    }

    func serviceAvailability(fileId: String) async throws -> [EcuServiceAvailability] {
        let encoded = fileId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? fileId
        let payload = try await request("/api/ecu/services?fileId=\(encoded)")
        return try decoder.decode(EcuServiceAvailabilityResponse.self, from: payload).services
    }

    func runOperation(fileId: String, operation: String) async throws -> EcuJob {
        let body = try JSONSerialization.data(withJSONObject: ["fileId": fileId, "operation": operation])
        let payload = try await request("/api/ecu/jobs", method: "POST", body: body, headers: ["Content-Type":"application/json"])
        struct ResponseBody: Decodable { let job: EcuJob }
        return try decoder.decode(ResponseBody.self, from: payload).job
    }

    func runComposite(fileId: String, operations: [String]) async throws -> EcuJob {
        let body = try JSONSerialization.data(withJSONObject: [
            "fileId": fileId,
            "operations": operations,
        ])
        let payload = try await request("/api/ecu/jobs/composite", method: "POST", body: body, headers: ["Content-Type":"application/json"])
        struct ResponseBody: Decodable { let job: EcuJob }
        return try decoder.decode(ResponseBody.self, from: payload).job
    }

    func stage1Preview(fileId: String) async throws -> EcuJob {
        try await runOperation(fileId: fileId, operation: "stage1_proposal")
    }

    func downloadMod(jobId: String) async throws -> URL {
        let encoded = jobId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? jobId
        var req = URLRequest(url: URL(string: "/api/ecu/jobs/\(encoded)/mod", relativeTo: baseURL)!)
        req.httpMethod = "GET"
        let (data,response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            let text = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw NSError(domain: "ECU", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey:text])
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("JARVIS-\(jobId)-MOD.bin")
        try data.write(to: url, options: .atomic)
        return url
    }

    func rollback(version: String) async throws {
        _ = try await request("/api/ecu/models/\(version.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? version)/rollback", method: "POST")
    }
}
