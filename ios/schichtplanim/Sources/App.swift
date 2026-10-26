import SwiftUI
import WebKit
import UIKit

@main
struct SchichtPlanimApp: App {
    var body: some Scene { WindowGroup { ShiftWebView().ignoresSafeArea(.container, edges: .bottom) } }
}
struct ShiftWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        if let saved = try? String(contentsOf: Coordinator.stateURL, encoding: .utf8),
           let bytes = try? JSONEncoder().encode(saved),
           let quoted = String(data: bytes, encoding: .utf8) {
            config.userContentController.addUserScript(WKUserScript(source: "window.__schichtNativeSnapshot = \(quoted);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        config.userContentController.add(context.coordinator, name: "persist")
        config.userContentController.add(context.coordinator, name: "backup")
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 0.984, green: 0.980, blue: 0.969, alpha: 1)
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.navigationDelegate = context.coordinator
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else { view.loadHTMLString("<p>Dosya bulunamadı</p>", baseURL: nil) }
        return view
    }
    func updateUIView(_ webView: WKWebView, context: Context) {}
    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.configuration.userContentController.removeScriptMessageHandler(forName: "persist")
        view.configuration.userContentController.removeScriptMessageHandler(forName: "backup")
    }
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        static let stateURL: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("shift-payroll-local.json")
        private let q = DispatchQueue(label: "de.schichtplanim.persist")
        func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let string = message.body as? String, let data = string.data(using: .utf8), data.count < 25_000_000 else { return }
            if message.name == "persist" {
                q.async {
                    try? FileManager.default.createDirectory(at: Self.stateURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                    try? data.write(to: Self.stateURL, options: .atomic)
                    try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: Self.stateURL.path)
                }
            } else if message.name == "backup" {
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("SchichtPlanim-Backup.json")
                guard (try? data.write(to: url, options: .atomic)) != nil else { return }
                DispatchQueue.main.async {
                    guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
                          let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return }
                    let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                    if let pop = vc.popoverPresentationController { pop.sourceView = root.view; pop.sourceRect = CGRect(x: root.view.bounds.midX, y: 80, width: 1, height: 1) }
                    root.present(vc, animated: true)
                }
            }
        }
        func webView(_ v: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.allow); return }
            if url.isFileURL || url.scheme == "about" { decisionHandler(.allow); return }
            if action.targetFrame == nil, let scheme = url.scheme, ["https", "http", "mailto"].contains(scheme) {
                UIApplication.shared.open(url); decisionHandler(.cancel); return
            }
            decisionHandler(.allow)
        }
    }
}