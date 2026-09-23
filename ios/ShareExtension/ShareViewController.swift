import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let appGroup = "group.com.haydojarvis.jarvis"
    private let sharedFilesKey = "pendingShareFiles"
    private let sharedTextKey = "pendingShareText"

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        collectSharedContent()
    }

    private func collectSharedContent() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return finish() }
        let providers = items.flatMap { $0.attachments ?? [] }
        guard !providers.isEmpty else { return finish() }

        let group = DispatchGroup()
        let lock = NSLock()
        var texts: [String] = []
        var storedFiles: [String] = []

        for provider in providers.prefix(4) {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                    if let url = item as? URL {
                        lock.lock(); texts.append(url.absoluteString); lock.unlock()
                    }
                    group.leave()
                }
                continue
            }

            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                    if let text = item as? String, !text.isEmpty {
                        lock.lock(); texts.append(text); lock.unlock()
                    }
                    group.leave()
                }
                continue
            }

            let typeIdentifier = provider.registeredTypeIdentifiers.first ?? UTType.item.identifier
            group.enter()
            provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { [weak self] url, _ in
                defer { group.leave() }
                guard let self, let url, let relative = self.copyIntoSharedInbox(url) else { return }
                lock.lock(); storedFiles.append(relative); lock.unlock()
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else { return }
            let defaults = UserDefaults(suiteName: self.appGroup)
            if !texts.isEmpty { defaults?.set(texts.joined(separator: "\n"), forKey: self.sharedTextKey) }
            if !storedFiles.isEmpty { defaults?.set(storedFiles, forKey: self.sharedFilesKey) }
            self.openJarvis()
        }
    }

    private func copyIntoSharedInbox(_ source: URL) -> String? {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        let inbox = container.appendingPathComponent("SharedInbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)

        let cleanName = source.lastPathComponent.isEmpty ? "shared-file" : source.lastPathComponent
        let relative = "\(UUID().uuidString)-\(cleanName)"
        let destination = inbox.appendingPathComponent(relative)

        do {
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.copyItem(at: source, to: destination)
            return relative
        } catch {
            return nil
        }
    }

    private func openJarvis() {
        let url = URL(string: "jarvis://share")!
        extensionContext?.open(url) { [weak self] _ in self?.finish() }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
