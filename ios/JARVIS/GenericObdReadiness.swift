import Foundation

struct GenericObdReadiness: Hashable {
    let milOn: Bool
    let storedDtcCount: Int
    let ignitionType: String
    let supportedMonitors: [String]
    let incompleteMonitors: [String]

    var summary: String {
        let mil = milOn ? "MIL açık" : "MIL kapalı"
        let incomplete = incompleteMonitors.isEmpty
            ? "readiness tamam"
            : "(incompleteMonitors.count) monitor tamamlanmamış"
        return "(mil) • ECU sayacı (storedDtcCount) DTC • (incomplete)"
    }
}

enum GenericObdReadinessDecoder {
    static func decode(_ bytes: [UInt8]) -> GenericObdReadiness? {
        guard bytes.count >= 6, bytes[0] == 0x41, bytes[1] == 0x01 else { return nil }
        let a = bytes[2]
        let b = bytes[3]
        let c = bytes[4]
        let d = bytes[5]

        let mil = (a & 0x80) != 0
        let dtcCount = Int(a & 0x7F)
        let compressionIgnition = (b & 0x08) != 0

        var supported: [String] = []
        var incomplete: [String] = []

        func add(_ name: String, supportedFlag: Bool, incompleteFlag: Bool) {
            guard supportedFlag else { return }
            supported.append(name)
            if incompleteFlag { incomplete.append(name) }
        }

        add("Misfire", supportedFlag: (b & 0x01) != 0, incompleteFlag: (b & 0x10) != 0)
        add("Fuel system", supportedFlag: (b & 0x02) != 0, incompleteFlag: (b & 0x20) != 0)
        add("Comprehensive components", supportedFlag: (b & 0x04) != 0, incompleteFlag: (b & 0x40) != 0)

        if compressionIgnition {
            add("NMHC catalyst", supportedFlag: (c & 0x01) != 0, incompleteFlag: (d & 0x01) != 0)
            add("NOx/SCR", supportedFlag: (c & 0x02) != 0, incompleteFlag: (d & 0x02) != 0)
            add("Boost pressure", supportedFlag: (c & 0x08) != 0, incompleteFlag: (d & 0x08) != 0)
            add("Exhaust gas sensor", supportedFlag: (c & 0x20) != 0, incompleteFlag: (d & 0x20) != 0)
            add("PM filter", supportedFlag: (c & 0x40) != 0, incompleteFlag: (d & 0x40) != 0)
            add("EGR/VVT", supportedFlag: (c & 0x80) != 0, incompleteFlag: (d & 0x80) != 0)
        } else {
            add("Catalyst", supportedFlag: (c & 0x01) != 0, incompleteFlag: (d & 0x01) != 0)
            add("Heated catalyst", supportedFlag: (c & 0x02) != 0, incompleteFlag: (d & 0x02) != 0)
            add("EVAP", supportedFlag: (c & 0x04) != 0, incompleteFlag: (d & 0x04) != 0)
            add("Secondary air", supportedFlag: (c & 0x08) != 0, incompleteFlag: (d & 0x08) != 0)
            add("O2 sensor", supportedFlag: (c & 0x20) != 0, incompleteFlag: (d & 0x20) != 0)
            add("O2 heater", supportedFlag: (c & 0x40) != 0, incompleteFlag: (d & 0x40) != 0)
            add("EGR/VVT", supportedFlag: (c & 0x80) != 0, incompleteFlag: (d & 0x80) != 0)
        }

        return .init(
            milOn: mil,
            storedDtcCount: dtcCount,
            ignitionType: compressionIgnition ? "Compression ignition" : "Spark ignition",
            supportedMonitors: supported,
            incompleteMonitors: incomplete
        )
    }
}
