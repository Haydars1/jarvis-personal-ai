import Foundation

// Candidate framing from public LAUNCH examples. This is not a verified
// THINKDIAG2 session or opcode map. It never builds or sends vehicle commands.
struct VciFrameInspector {
    static func describe(_ data: Data) -> String {
        let b = Array(data)
        guard b.count >= 7, b[0] == 0x55, b[1] == 0xAA else {
            return "Paket biçimi tanınmadı (THINKDIAG2 protokolü doğrulanmadı)"
        }
        let length = Int(b[4]) * 256 + Int(b[5])
        guard b.count == length + 7 else {
            return "Aday VCI çerçevesi: uzunluk uyuşmuyor; parça veya birleşik paket olabilir"
        }
        let xor = b[2..<(b.count - 1)].reduce(UInt8(0), ^)
        guard xor == b.last else { return "Aday VCI çerçevesi: XOR kontrolü başarısız" }
        return "Aday VCI çerçevesi: \(length) bayt veri, XOR geçerli; komut anlamı doğrulanmadı"
    }
}
