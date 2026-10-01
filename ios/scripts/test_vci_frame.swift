import Foundation

@main
struct FrameChecks {
    static func main() {
        // Response example published in LAUNCH patent CN119292240A.
        let packet: [UInt8] = [0x55,0xAA,0xF8,0xF0,0x00,0x07,0x2B,0x67,0x01,0xFF,0x00,0x2E,0x55,0xC6]
        precondition(VciFrameInspector.describe(Data(packet)).contains("XOR geçerli"))
        var corrupt = packet; corrupt[8] ^= 1
        precondition(VciFrameInspector.describe(Data(corrupt)).contains("başarısız"))
        precondition(VciFrameInspector.describe(Data(packet.dropLast())).contains("uzunluk uyuşmuyor"))
        precondition(VciFrameInspector.describe(Data(packet + [0, 0])).contains("uzunluk uyuşmuyor"))
        precondition(VciFrameInspector.describe(Data([0x41, 0x03])).contains("tanınmadı"))
        precondition(VciFrameInspector.describe(Data()).contains("tanınmadı"))
        print("VCI frame checks passed: published vector, corruption, truncation, extra bytes, unknown format, empty input. No device command was sent.")
    }
}
