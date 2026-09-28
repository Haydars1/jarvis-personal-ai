import Foundation

struct ThinkDiagStreamStats: Equatable {
    var bytesSeen = 0
    var framesDecoded = 0
    var checksumValid = 0
    var discardedBytes = 0

    var checksumRatio: Double {
        guard framesDecoded > 0 else { return 0 }
        return Double(checksumValid) / Double(framesDecoded)
    }
}

struct ThinkDiagFrameAssembler {
    private(set) var buffer = Data()
    private(set) var stats = ThinkDiagStreamStats()

    mutating func reset() {
        buffer.removeAll(keepingCapacity: true)
        stats = ThinkDiagStreamStats()
    }

    mutating func append(
        _ chunk: Data,
        preferredHeader: [UInt8]? = nil
    ) -> [ThinkDiagVciFrame] {
        guard !chunk.isEmpty else { return [] }
        stats.bytesSeen += chunk.count
        buffer.append(chunk)

        var decoded: [ThinkDiagVciFrame] = []
        while buffer.count >= ThinkDiagVciFrame.minimumSize {
            let bytes = [UInt8](buffer)

            let payloadLength = (Int(bytes[4]) << 8) | Int(bytes[5])
            let totalLength = ThinkDiagVciFrame.minimumSize + payloadLength

            // Broken alignment or impossible length: shift by one byte and keep scanning.
            if payloadLength > 16_384 || totalLength > 16_391 {
                buffer.removeFirst()
                stats.discardedBytes += 1
                continue
            }

            guard buffer.count >= totalLength else { break }

            let candidate = Data(buffer.prefix(totalLength))
            guard let frame = ThinkDiagVciFrame.decode(candidate) else {
                buffer.removeFirst()
                stats.discardedBytes += 1
                continue
            }

            if let preferredHeader, frame.header != preferredHeader {
                buffer.removeFirst()
                stats.discardedBytes += 1
                continue
            }

            // Until a header is confirmed, checksum validity is our strongest alignment signal.
            // Do not consume an entire checksum-bad candidate because that can skip a valid frame
            // starting one byte later in the stream.
            guard frame.checksumValid else {
                buffer.removeFirst()
                stats.discardedBytes += 1
                continue
            }

            decoded.append(frame)
            stats.framesDecoded += 1
            stats.checksumValid += 1
            buffer.removeFirst(totalLength)
        }

        if buffer.count > 65_536 {
            let overflow = buffer.count - 32_768
            buffer.removeFirst(overflow)
            stats.discardedBytes += overflow
        }

        return decoded
    }
}
