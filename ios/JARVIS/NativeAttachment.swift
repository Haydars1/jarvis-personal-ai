import Foundation
import UniformTypeIdentifiers

struct NativeAttachment: Identifiable {
    let id = UUID()
    let name: String
    let mimeType: String
    let data: Data

    var icon: String {
        if mimeType.hasPrefix("image/") { return "photo" }
        if mimeType == "application/pdf" { return "doc.richtext" }
        if mimeType.hasPrefix("audio/") { return "waveform" }
        if mimeType.hasPrefix("video/") { return "film" }
        return "doc"
    }

    static func from(url: URL, maxBytes: Int = 10 * 1024 * 1024) throws -> NativeAttachment {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url)
        guard data.count <= maxBytes else {
            throw NSError(domain: "JARVIS", code: 413, userInfo: [NSLocalizedDescriptionKey: "Dosya çok büyük. Maksimum 10 MB."])
        }
        let type = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        return NativeAttachment(name: url.lastPathComponent, mimeType: type, data: data)
    }
}
