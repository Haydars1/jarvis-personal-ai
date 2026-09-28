import Foundation

enum ManufacturerTransportCodec {
    static func wrapRequest(_ request: Data, route: ManufacturerTransportRoute) -> Data {
        guard let prefixHex = route.requestPrefixHex,
              let prefix = Data(hexString: prefixHex),
              !prefix.isEmpty else {
            return request
        }
        var out = prefix
        out.append(request)
        return out
    }

    static func unwrapResponse(_ response: Data, route: ManufacturerTransportRoute) -> Data {
        guard let prefixHex = route.responsePrefixHex,
              let prefix = Data(hexString: prefixHex),
              !prefix.isEmpty,
              response.starts(with: prefix) else {
            return response
        }
        return Data(response.dropFirst(prefix.count))
    }

    static func expectedWrappedPrefix(_ expected: Data?, route: ManufacturerTransportRoute) -> Data? {
        guard let expected else { return nil }
        guard let prefixHex = route.responsePrefixHex,
              let prefix = Data(hexString: prefixHex),
              !prefix.isEmpty else {
            return expected
        }
        var out = prefix
        out.append(expected)
        return out
    }
}
