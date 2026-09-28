import Foundation

struct ResearchPaginationPolicy: Hashable {
    let perQueryPageSize: Int
    let maxPagesPerQuery: Int
    let stopAfterConsecutiveEmptyPages: Int

    static let deep = ResearchPaginationPolicy(
        perQueryPageSize: 30,
        maxPagesPerQuery: 10,
        stopAfterConsecutiveEmptyPages: 2
    )

    var theoreticalMaxResultsPerQuery: Int {
        perQueryPageSize * maxPagesPerQuery
    }
}

struct ResearchCoverageSummary: Hashable {
    let targetCount: Int
    let brandCount: Int
    let queryCount: Int
    let theoreticalMaxCandidates: Int
}

enum CodingResearchCoverage {
    static func summary(policy: ResearchPaginationPolicy = .deep) -> ResearchCoverageSummary {
        .init(
            targetCount: AllBrandCodingResearchCatalog.targets.count,
            brandCount: AllBrandCodingResearchCatalog.allBrands.count,
            queryCount: AllBrandCodingResearchCatalog.totalQueryCount,
            theoreticalMaxCandidates:
                AllBrandCodingResearchCatalog.totalQueryCount * policy.theoreticalMaxResultsPerQuery
        )
    }
}
