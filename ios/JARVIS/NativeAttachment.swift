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

    static func from(url: URL, maxBytes: Int = 50 * 1024 * 1024) throws -> NativeAttachment {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }

        var data: Data?
        var coordinationError: NSError?
        let coordinator = NSFileCoordinator()
        coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { readableURL in
            data = try? Data(contentsOf: readableURL, options: [.mappedIfSafe])
        }
        if let coordinationError { throw coordinationError }
        guard let data else {
            throw NSError(domain: "JARVIS", code: 422, userInfo: [NSLocalizedDescriptionKey: "Dosya iCloud/Files üzerinden okunamadı. Dosyayı cihazına indirip tekrar seç."])
        }
        guard data.count <= maxBytes else {
            throw NSError(domain: "JARVIS", code: 413, userInfo: [NSLocalizedDescriptionKey: "Dosya çok büyük. Maksimum 50 MB."])
        }
        let type = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        return NativeAttachment(name: url.lastPathComponent, mimeType: type, data: data)
    }
}
