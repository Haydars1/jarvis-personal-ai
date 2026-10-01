import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        collectSharedText()
    }

    private func collectSharedText() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return finish() }
        let providers = items.flatMap { $0.attachments ?? [] }
        if let provider = providers.first(where: { provider in
            provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier) ||
            provider.registeredTypeIdentifiers.contains(UTType.fileURL.identifier) ||
            (provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) &&
             !provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) &&
             !provider.hasItemConformingToTypeIdentifier(UTType.url.identifier))
        }) {
            let type = provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier) ? UTType.pdf.identifier : UTType.data.identifier
            provider.loadFileRepresentation(forTypeIdentifier: type) { [weak self] url, _ in
                guard let url, let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.haydojarvis.jarvis") else { self?.finish(); return }
                do {
                    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    guard size > 0, size <= 10 * 1024 * 1024 else { self?.finish(); return }
                    let name = UUID().uuidString + "." + url.pathExtension
                    let destination = group.appendingPathComponent(name)
                    try FileManager.default.copyItem(at: url, to: destination)
                    let defaults = UserDefaults(suiteName: "group.com.haydojarvis.jarvis")
                    defaults?.set(name, forKey: "pendingShareFile")
                    defaults?.set(url.lastPathComponent, forKey: "pendingShareFileName")
                    self?.openJarvis("")
                } catch { self?.finish() }
            }
            return
        }
        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) {
            p.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
                self?.openJarvis((item as? URL)?.absoluteString ?? "")
            }
            return
        }
        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) {
            p.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, _ in
                self?.openJarvis(item as? String ?? "")
            }
            return
        }
        finish()
    }

    private func openJarvis(_ text: String) {
        UserDefaults(suiteName: "group.com.haydojarvis.jarvis")?.set(text, forKey: "pendingShareText")
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let url = URL(string: "jarvis://share")!
            self.extensionContext?.open(url) { _ in self.finish() }
        }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
