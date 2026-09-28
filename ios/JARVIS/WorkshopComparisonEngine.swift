import Foundation

struct WorkshopDtcDiff: Hashable {
    let newCodes: [String]
    let resolvedCodes: [String]
    let persistentCodes: [String]

    var isEmpty: Bool {
        newCodes.isEmpty && resolvedCodes.isEmpty && persistentCodes.isEmpty
    }
}

enum WorkshopComparisonEngine {
    static func compare(
        current: WorkshopSessionRecord,
        previous: WorkshopSessionRecord
    ) -> WorkshopDtcDiff {
        let currentCodes = Set(allCodes(current))
        let previousCodes = Set(allCodes(previous))

        return .init(
            newCodes: Array(currentCodes.subtracting(previousCodes)).sorted(),
            resolvedCodes: Array(previousCodes.subtracting(currentCodes)).sorted(),
            persistentCodes: Array(currentCodes.intersection(previousCodes)).sorted()
        )
    }

    static func allCodes(_ record: WorkshopSessionRecord) -> [String] {
        record.genericDtcs.map(\.code)
            + record.modules.flatMap { $0.dtcs.map(\.code) }
    }
}

extension WorkshopSessionStore {
    func previousSession(for record: WorkshopSessionRecord) -> WorkshopSessionRecord? {
        sessions.first {
            $0.id != record.id
                && record.vin != nil
                && $0.vin == record.vin
                && $0.finishedAt < record.finishedAt
        }
    }
}
