import SwiftUI

struct YouTubeStudioView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var idea = ""
    @State private var context = ""
    @State private var voiceProfile = ""
    @State private var selectedMode = "director"
    @State private var output = "Hazır"
    @State private var isRunning = false
    private let api = JarvisAPI()

    private let modes: [(String,String,String)] = [
        ("director","AI Director","sparkles"),
        ("script","Script + Hook","text.quote"),
        ("package","Başlık + Thumbnail","rectangle.on.rectangle"),
        ("edit","Edit Decision List","scissors"),
        ("comments","Comment Brain","text.bubble"),
        ("plan","Content Planner","calendar"),
        ("viral","Viral Radar","chart.line.uptrend.xyaxis"),
        ("retention","Retention Lab","waveform.path.ecg"),
        ("shorts","Shorts Cutter","rectangle.portrait"),
        ("seo","SEO Engine","magnifyingglass"),
        ("chapters","Chapters","list.bullet"),
        ("audit","Channel Audit","checkmark.seal"),
        ("ab","A/B Lab+","arrow.left.arrow.right"),
        ("repurpose","Repurpose Matrix+","square.grid.2x2"),
        ("growth","Growth OS+","infinity")
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("YouTube").font(.largeTitle.bold())
                        Text("JARVIS Creator OS")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text("Script, hook, başlık-thumbnail, retention, Shorts, SEO, audit ve growth iş akışlarını tek yerde yönet.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(modes, id: \.0) { mode in
                            Button {
                                selectedMode = mode.0
                            } label: {
                                HStack(spacing: 9) {
                                    Image(systemName: mode.2)
                                    Text(mode.1).font(.subheadline.weight(.semibold)).lineLimit(2)
                                    Spacer(minLength: 0)
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, minHeight: 54)
                                .background(selectedMode == mode.0 ? Color.red.opacity(0.14) : Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(selectedMode == mode.0 ? Color.red.opacity(0.45) : Color.clear))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Group {
                        TextField("Voice profile / nasıl konuşuyorum?", text: $voiceProfile, axis: .vertical)
                        TextField("Video fikri veya görev", text: $idea, axis: .vertical)
                        TextField("Ek bağlam, kanal verisi, retention, rakip notları...", text: $context, axis: .vertical)
                    }
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(2...6)

                    Button {
                        Task { await run() }
                    } label: {
                        HStack {
                            if isRunning { ProgressView().tint(.white) }
                            Image(systemName: "play.fill")
                            Text(isRunning ? "JARVIS çalışıyor..." : "ÇALIŞTIR")
                                .fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                    }
                    .buttonStyle(.plain)
                    .background(Color.red, in: RoundedRectangle(cornerRadius: 15))
                    .foregroundStyle(.white)
                    .disabled(isRunning || idea.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("JARVIS Çıktısı").font(.headline)
                            Spacer()
                            Button {
                                UIPasteboard.general.string = output
                            } label: { Image(systemName: "doc.on.doc") }
                            .buttonStyle(.plain)
                        }
                        Text(output)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                    }
                }
                .padding(16)
            }
            .navigationTitle("YouTube")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                }
            }
        }
    }

    private func prompt() -> String {
        let selected = modes.first(where: { $0.0 == selectedMode })?.1 ?? "AI Director"
        return """
        JARVIS YouTube modu: \(selected).
        Kanal/proje adı: YouTube.
        Ana fikir/görev: \(idea)
        Voice profile: \(voiceProfile.isEmpty ? "Belirtilmedi" : voiceProfile)
        Ek bağlam: \(context.isEmpty ? "Yok" : context)

        Türkçe, doğrudan ve uygulanabilir çalış. Script gerekiyorsa ilk 15 saniyeyi özellikle optimize et. Başlık ve thumbnail aynı şeyi tekrar etmesin. Retention verisi varsa hook leak, cliff ve slide olarak ayır. Shorts gerekiyorsa 20-55 saniyelik bağımsız adaylar üret. SEO gerekiyorsa 3 hedef arama sorgusu seç. Audit gerekiyorsa en büyük tek düzeltmeyi önce söyle. Uydurma sayı/sonuç üretme. Yayınlama yapma; yayın öncesi paketi hazırla.
        """
    }

    private func run() async {
        isRunning = true
        defer { isRunning = false }
        do {
            let result = try await api.send(text: prompt())
            output = result.reply
        } catch {
            output = "Hata: \(error.localizedDescription)"
        }
    }
}
