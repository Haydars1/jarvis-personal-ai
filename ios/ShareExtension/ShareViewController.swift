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
