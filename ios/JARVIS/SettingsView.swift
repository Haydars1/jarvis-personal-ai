import SwiftUI
import UIKit
import CoreLocation
import AVFoundation
import Photos
import Speech
import UserNotifications

struct SettingsView: View {
    @EnvironmentObject var state: AppState
    @Environment(\.dismiss) private var dismiss
    @AppStorage("jarvisMinimalBranding") private var minimalBranding = true
    @StateObject private var location = LocationPermissionController()
    @State private var notificationStatus = "Kontrol ediliyor"
    @State private var googleStatus = "Kontrol edilmedi"

    private let accentColor = Color(red: 0.06, green: 0.64, blue: 0.47)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    settingsHeader

                    settingsSection("Bağlantılar") {
                        serviceRow("Google servisleri", googleStatus, "g.circle") {
                            Task { await connectGoogle() }
                        }

                        serviceRow("Tüm bağlantıları tara", "Eksik servis, API veya izin varsa JARVIS kontrol etsin.", "checklist") {
                            quickAction("Uygulamadaki tüm bağlantıları, izinleri, Google servislerini, bildirimleri, konumu, mikrofonu, dosyaları ve backend durumunu tara. Eksikleri bana kısa ve net şekilde listele.")
                        }

                        serviceRow("Takvim & Hatırlatıcı", "Randevu, termin, alarm ve yapılacakları yönet.", "calendar.badge.clock") {
                            quickAction("Takvim ve hatırlatıcı bağlantılarını kontrol et. Randevu, termin, alarm ve yapılacaklar için eksik izinleri veya bağlantıları kurmamı sağla.")
                        }

                        serviceRow("Dosyalar & Paylaşım", "PDF, fotoğraf, belge ve paylaşım uzantısını kontrol et.", "folder.badge.gearshape") {
                            quickAction("Dosya, PDF, fotoğraf ve iOS paylaşım uzantısı ayarlarını kontrol et. JARVIS'e dosya gönderme akışını hazır hale getir.")
                        }
                    }

                    settingsSection("Telefon İzinleri") {
                        settingRow(
                            icon: "location.circle",
                            title: "Konum",
                            subtitle: "\(location.statusText) · \(location.coordinateText)",
                            tint: accentColor
                        ) {
                            location.requestLocation()
                        }

                        settingRow(
                            icon: "bell",
                            title: "Bildirimler",
                            subtitle: notificationStatus,
                            tint: .orange
                        ) {
                            Task { await requestNotifications() }
                        }

                        settingRow(
                            icon: "mic",
                            title: "Mikrofon / Konuşma",
                            subtitle: microphoneText,
                            tint: .blue
                        ) {
                            state.toggleVoice()
                        }

                        settingRow(
                            icon: "camera",
                            title: "Kamera / Fotoğraflar",
                            subtitle: "Kamera: \(cameraText) · Fotoğraf: \(photoText)",
                            tint: .purple
                        ) {
                            openSystemSettings()
                        }

                        Button {
                            openSystemSettings()
                        } label: {
                            HStack {
                                Text("iPhone sistem ayarlarını aç")
                                Spacer()
                                Image(systemName: "arrow.up.forward.app")
                                    .foregroundStyle(.secondary)
                            }
                            .font(.subheadline.weight(.medium))
                            .padding(.vertical, 2)
                        }
                        .buttonStyle(.plain)
                    }

                    settingsSection("Uygulama") {
                        settingRow(icon: "arrow.clockwise", title: "Sohbet geçmişini yenile", subtitle: "Sunucudaki son konuşmaları tekrar çek.", tint: .blue) {
                            Task {
                                do {
                                    try await state.loadHistory()
                                    state.statusText = "Geçmiş yenilendi"
                                } catch {
                                    state.statusText = error.localizedDescription
                                }
                            }
                        }

                        settingRow(icon: "paperclip", title: "Ekleri temizle", subtitle: "Bekleyen dosya ve fotoğraf eklerini kaldır.", tint: .mint) {
                            state.attachments.removeAll()
                            state.statusText = "Ekler temizlendi"
                        }

                        settingRow(icon: state.isListening ? "waveform.circle.fill" : "waveform", title: state.isListening ? "Dinlemeyi durdur" : "Sesli dinlemeyi başlat", subtitle: "Mikrofonla JARVIS'e konuş.", tint: accentColor) {
                            state.toggleVoice()
                        }
                    }

                    settingsSection("Görünüm") {
                        Toggle(isOn: $minimalBranding) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Sade görünüm")
                                    .font(.subheadline.weight(.medium))
                                Text("Büyük amblem yerine temiz JARVIS arayüzü kullanılır.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .tint(accentColor)

                        HStack(spacing: 12) {
                            Image(systemName: "paintbrush")
                                .foregroundStyle(accentColor)
                                .frame(width: 26)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("ChatGPT tarzı sade tema")
                                    .font(.subheadline.weight(.medium))
                                Text("Temiz zemin, ince ayraçlar ve sade mesaj balonları aktif.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 34)
            }
            .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
            .navigationTitle("Ayarlar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Bitti") { dismiss() }
                        .foregroundStyle(accentColor)
                }
            }
        }
        .task {
            await refreshNotificationStatus()
            await refreshGoogleStatus()
        }
        .onAppear { location.refresh() }
    }

    private var settingsHeader: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(accentColor)
                    .frame(width: 58, height: 58)
                Text("J")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(.white)
            }

            VStack(spacing: 4) {
                Text("JARVIS")
                    .font(.title2.weight(.semibold))
                Text("Servisler, izinler ve uygulama işlemleri")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 6)
    }

    private func settingsSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                content()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color(uiColor: .separator).opacity(0.18), lineWidth: 0.7)
            )
        }
    }

    private func settingRow(icon: String, title: String, subtitle: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func serviceRow(_ title: String, _ subtitle: String, _ icon: String, action: @escaping () -> Void) -> some View {
        settingRow(icon: icon, title: title, subtitle: subtitle, tint: accentColor, action: action)
    }

    private func quickAction(_ text: String) {
        dismiss()
        state.startQuickAction(text)
    }

    private func refreshGoogleStatus() async {
        do {
            let info = try await state.api.googleSetupInfo()
            await MainActor.run {
                if info.connected {
                    googleStatus = "Bağlı · Gmail/Drive hazır"
                } else if info.configured {
                    googleStatus = "Hazır · bağlamak için dokun"
                } else {
                    googleStatus = "OAuth kurulumu eksik · Client ID/Secret gerekli"
                }
            }
        } catch {
            await MainActor.run { googleStatus = "Kontrol edilemedi: \(error.localizedDescription)" }
        }
    }

    private func connectGoogle() async {
        await MainActor.run {
            googleStatus = "Google bağlantısı kontrol ediliyor..."
            state.statusText = "Google kontrol ediliyor..."
        }
        do {
            let info = try await state.api.googleSetupInfo()
            if info.connected {
                await MainActor.run {
                    googleStatus = "Zaten bağlı"
                    state.statusText = "Google zaten bağlı"
                }
                return
            }
            guard info.configured else {
                await MainActor.run {
                    googleStatus = "OAuth kurulumu eksik · Ayar sayfasındaki redirect URL gerekli"
                    state.statusText = "Google OAuth eksik"
                }
                return
            }
            let connect = try await state.api.googleConnect()
            guard let raw = connect.url, let url = URL(string: raw) else {
                await MainActor.run {
                    googleStatus = connect.detail ?? connect.error ?? "Google bağlantı URL'si alınamadı"
                    state.statusText = "Google bağlantısı hazır değil"
                }
                return
            }
            await MainActor.run {
                googleStatus = "Safari'de Google giriş ekranı açılıyor..."
                state.statusText = "Google girişini tamamla"
                UIApplication.shared.open(url)
            }
        } catch {
            await MainActor.run {
                googleStatus = error.localizedDescription
                state.statusText = error.localizedDescription
            }
        }
    }

    private func refreshNotificationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        await MainActor.run {
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral: notificationStatus = "Açık"
            case .denied: notificationStatus = "Kapalı - iPhone ayarlarından aç"
            case .notDetermined: notificationStatus = "İzin bekliyor"
            @unknown default: notificationStatus = "Bilinmiyor"
            }
        }
    }

    private func requestNotifications() async {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            await MainActor.run { notificationStatus = granted ? "Açık" : "Kapalı" }
        } catch {
            await MainActor.run { notificationStatus = error.localizedDescription }
        }
    }

    private var microphoneText: String {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: return "Açık"
        case .denied: return "Kapalı - iPhone ayarlarından aç"
        case .undetermined: return "İzin bekliyor"
        @unknown default: return "Bilinmiyor"
        }
    }

    private var cameraText: String {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return "Açık"
        case .denied, .restricted: return "Kapalı"
        case .notDetermined: return "Bekliyor"
        @unknown default: return "Bilinmiyor"
        }
    }

    private var photoText: String {
        switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
        case .authorized, .limited: return "Açık"
        case .denied, .restricted: return "Kapalı"
        case .notDetermined: return "Bekliyor"
        @unknown default: return "Bilinmiyor"
        }
    }

    private func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}

final class LocationPermissionController: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var statusText = "Kontrol ediliyor"
    @Published var coordinateText = "Konum yok"

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        refresh()
    }

    func refresh() {
        updateStatus(CLLocationManager.authorizationStatus())
        if CLLocationManager.authorizationStatus() == .authorizedWhenInUse || CLLocationManager.authorizationStatus() == .authorizedAlways {
            manager.requestLocation()
        }
    }

    func requestLocation() {
        switch CLLocationManager.authorizationStatus() {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        case .denied, .restricted:
            statusText = "Kapalı - iPhone ayarlarından aç"
        @unknown default:
            statusText = "Bilinmiyor"
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        updateStatus(manager.authorizationStatus)
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        coordinateText = String(format: "%.5f, %.5f", coordinate.latitude, coordinate.longitude)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        coordinateText = error.localizedDescription
    }

    private func updateStatus(_ status: CLAuthorizationStatus) {
        switch status {
        case .authorizedAlways, .authorizedWhenInUse: statusText = "Açık"
        case .denied, .restricted: statusText = "Kapalı"
        case .notDetermined: statusText = "İzin bekliyor"
        @unknown default: statusText = "Bilinmiyor"
        }
    }
}
