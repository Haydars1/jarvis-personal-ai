import Foundation

struct DtcSignalPlan: Hashable {
    let codes: [String]
    let pids: [UInt8]
    let labels: [String]
}

enum DtcSignalPlanner {
    static func plan(
        codes: [String],
        supportedPids: Set<UInt8>
    ) -> DtcSignalPlan {
        let requested = DtcFamilyDiagnosticEngine.requestedPids(for: codes)
        let filtered = supportedPids.isEmpty
            ? requested
            : requested.filter { supportedPids.contains($0) }

        let labels = filtered.compactMap { pid -> String? in
            GenericObdDecoder.decodeValue(pid: pid, data: placeholderData(for: pid))?.label
        }

        return .init(
            codes: Array(Set(codes.map { $0.uppercased() })).sorted(),
            pids: filtered,
            labels: labels
        )
    }

    private static func placeholderData(for pid: UInt8) -> [UInt8] {
        switch pid {
        case 0x0C,0x10,0x23,0x31,0x42,0x44,0x4D,0x4E,0x5E,0x3C...0x3F:
            return [0,0]
        default:
            return [0]
        }
    }
}
