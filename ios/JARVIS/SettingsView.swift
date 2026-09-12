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

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.black, Color(red: 0.015, green: 0.07, blue: 0.11)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        heroCard
                        permissionsCard
                        servicesCard
                        controlsCard
                        appearanceCard
                    }
                    .padding(16)
                    .padding(.bottom, 24)
                }
            }
            .navigationTitle("Ayarlar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Bitti") { dismiss() }
                        .foregroundStyle(.cyan)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await refreshNotificationStatus() }
        .onAppear { location.refresh() }
    }

    private var heroCard: some View {
        settingsCard {
            HStack(spacing: 12) {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.cyan)
                    .frame(width: 48, height: 48)
                    .background(Color.cyan.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text("JARVIS Kontrol Merkezi")
                        .font(.headline)
                    Text("İzinler, servisler, Google bağlantıları, konum ve görünüm buradan yönetilir.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var permissionsCard: some View {
        settingsCard(title: "Telefon izinleri") {
            settingRow(
                icon: "location.circle.fill",
                title: "Konum",
                subtitle: "\(location.statusText) · \(location.coordinateText)",
                tint: .green
            ) {
                location.requestLocation()
            }

            settingRow(
                icon: "bell.badge.fill",
                title: "Bildirimler",
                subtitle: notificationStatus,
                tint: .orange
            ) {
                Task { await requestNotifications() }
            }

            settingRow(
                icon: "mic.circle.fill",
                title: "Mikrofon / Konuşma",
                subtitle: microphoneText,
                tint: .cyan
            ) {
                state.toggleVoice()
            }

            settingRow(
                icon: "camera.circle.fill",
                title: "Kamera / Fotoğraflar",
                subtitle: "Kamera: \(cameraText) · Fotoğraf: \(photoText)",
                tint: .purple
            ) {
                openSystemSettings()
            }

            Button {
                openSystemSettings()
            } label: {
                Label("iPhone sistem ayarlarını aç", systemImage: "gearshape")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.cyan)
        }
    }

    private var servicesCard: some View {
        settingsCard(title: "Servis bağlantıları") {
            serviceRow("Google servisleri", "Gmail, Calendar, Drive, Docs, Maps ve Search bağlantılarını kur.", "g.circle") {
                quickAction("Google servislerini bağlamak istiyorum. Gmail, Calendar, Drive, Docs, Maps, YouTube ve Search için eksik olan bağlantıları kontrol et, nasıl bağlanacağını adım adım aç ve gerekiyorsa bağlantı ekranını hazırla.")
            }

            serviceRow("Konum servisleri", "JARVIS konumumu kullansın ve yakınımdaki sonuçları doğru versin.", "location.fill") {
                location.requestLocation()
                quickAction("Konum iznini ve konum kullanımını kontrol et. Bundan sonra yakınımdaki yerler, rota, trafik, alışveriş ve hizmetler için mevcut konumumu kullan.")
            }

            serviceRow("Takvim & Hatırlatıcı", "Randevu, termin, hatırlatma ve yapılacakları yönet.", "calendar.badge.clock") {
                quickAction("Takvim ve hatırlatıcı bağlantılarını kontrol et. Randevu, termin, alarm ve yapılacaklar için eksik izinleri veya bağlantıları kurmamı sağla.")
            }

            serviceRow("Dosyalar & Paylaşım", "PDF, fotoğraf, belge ve paylaşım uzantısını kontrol et.", "folder.badge.gearshape") {
                quickAction("Dosya, PDF, fotoğraf ve iOS paylaşım uzantısı ayarlarını kontrol et. JARVIS'e dosya gönderme akışını hazır hale getir.")
            }

            serviceRow("Tüm bağlantıları tara", "Eksik servis, API veya izin varsa JARVIS raporlasın.", "checklist") {
                quickAction("Uygulamadaki tüm bağlantıları, izinleri, Google servislerini, bildirimleri, konumu, mikrofonu, dosyaları ve backend durumunu tara. Eksikleri bana kısa ve net şekilde listele.")
            }
        }
    }

    private var controlsCard: some View {
        settingsCard(title: "Uygulama işlemleri") {
            settingRow(icon: "arrow.clockwise.circle.fill", title: "Sohbet geçmişini yenile", subtitle: "Sunucudaki son konuşmaları tekrar çek.", tint: .blue) {
                Task {
                    do {
                        try await state.loadHistory()
                        state.statusText = "Geçmiş yenilendi"
                    } catch {
                        state.statusText = error.localizedDescription
                    }
                }
            }

            settingRow(icon: "paperclip.circle.fill", title: "Ekleri temizle", subtitle: "Bekleyen dosya ve fotoğraf eklerini kaldır.", tint: .mint) {
                state.attachments.removeAll()
                state.statusText = "Ekler temizlendi"
            }

            settingRow(icon: "waveform.circle.fill", title: state.isListening ? "Dinlemeyi durdur" : "Sesli dinlemeyi başlat", subtitle: "Mikrofonla JARVIS'e konuş.", tint: .cyan) {
                state.toggleVoice()
            }
        }
    }

    private var appearanceCard: some View {
        settingsCard(title: "Görünüm") {
            Toggle(isOn: $minimalBranding) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Amblemsiz / sade görünüm")
                    Text("Girişte ve üst bölümde büyük amblem yerine temiz JARVIS yazısı kullanılır.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .tint(.cyan)

            settingRow(icon: "paintbrush.pointed.fill", title: "JARVIS dark-cyan tema", subtitle: "Siyah zemin, cam panel ve camgöbeği vurgu aktif.", tint: .cyan) {}
                .disabled(true)
        }
    }

    private func settingsCard<Content: View>(title: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
            }
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.065), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private func settingRow(icon: String, title: String, subtitle: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 34, height: 34)
                    .background(tint.opacity(0.12), in: Circle())

                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
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
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func serviceRow(_ title: String, _ subtitle: String, _ icon: String, action: @escaping () -> Void) -> some View {
        settingRow(icon: icon, title: title, subtitle: subtitle, tint: .cyan, action: action)
    }

    private func quickAction(_ text: String) {
        dismiss()
        state.startQuickAction(text)
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
