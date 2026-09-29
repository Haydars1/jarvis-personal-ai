import SwiftUI

struct DiagnosticLifecycleObserver: View {
    let transportReady: Bool
    let decodedFrameCount: Int
    let liveSampleCount: Int
    let dtcCodeKey: String
    let effectiveBrand: VehicleBrand
    let networkOnline: Bool
    let detectedVIN: String?
    let moduleResultCount: Int

    let onInitialTask: () async -> Void
    let onTransportReadyChange: (Bool) -> Void
    let onDecodedFrameCountChange: () -> Void
    let onLiveSampleCountChange: () -> Void
    let onDtcCodeKeyChange: () -> Void
    let onDisappearAction: () -> Void
    let onBrandChange: (VehicleBrand) -> Void
    let onNetworkChange: (Bool) -> Void
    let onVinChange: (String?) -> Void
    let onModuleResultCountChange: () -> Void

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .task {
                await onInitialTask()
            }
            .onChange(of: transportReady) { _, ready in
                onTransportReadyChange(ready)
            }
            .onChange(of: decodedFrameCount) { _, _ in
                onDecodedFrameCountChange()
            }
            .onChange(of: liveSampleCount) { _, _ in
                onLiveSampleCountChange()
            }
            .onChange(of: dtcCodeKey) { _, _ in
                onDtcCodeKeyChange()
            }
            .onDisappear {
                onDisappearAction()
            }
            .onChange(of: effectiveBrand) { _, brand in
                onBrandChange(brand)
            }
            .onChange(of: networkOnline) { _, online in
                onNetworkChange(online)
            }
            .onChange(of: detectedVIN) { _, vin in
                onVinChange(vin)
            }
            .onChange(of: moduleResultCount) { _, _ in
                onModuleResultCountChange()
            }
    }
}
