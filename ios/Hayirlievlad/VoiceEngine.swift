import Foundation
import AVFoundation
import Speech

final class VoiceEngine: NSObject, AVSpeechSynthesizerDelegate {
    var onFinalTranscript: ((String) -> Void)?
    var onStateChange: ((Bool) -> Void)?
    var onError: ((String) -> Void)?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "tr-TR"))
    private let audioEngine = AVAudioEngine()
    private let synthesizer = AVSpeechSynthesizer()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var shouldResume = false

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func startListening() {
        shouldResume = true
        Task {
            let speechAllowed = await withCheckedContinuation { c in SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) } }
            let micAllowed = await AVAudioApplication.requestRecordPermission()
            await MainActor.run {
                guard self.shouldResume else { return }
                guard speechAllowed && micAllowed else {
                    self.shouldResume = false
                    self.onStateChange?(false)
                    self.onError?("Sesli kullanım için Ayarlar'dan mikrofon ve konuşma tanıma iznini aç.")
                    return
                }
                self.beginRecognition()
            }
        }
    }

    func stopListening() {
        shouldResume = false
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        if audioEngine.isRunning { audioEngine.stop(); audioEngine.inputNode.removeTap(onBus: 0) }
        onStateChange?(false)
    }

    private func beginRecognition() {
        guard shouldResume else { return }
        stopListeningForSpeechOnly()
        guard let recognizer, recognizer.isAvailable else {
            shouldResume = false
            onError?("Türkçe konuşma tanıma şu an kullanılamıyor. Bağlantını ve konuşma ayarlarını kontrol et.")
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            recognitionRequest = request

            let input = audioEngine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
            audioEngine.prepare()
            try audioEngine.start()
            onStateChange?(true)

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self, self.recognitionRequest === request else { return }
                if let result, result.isFinal {
                    let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                    self.stopListeningForSpeechOnly()
                    if !text.isEmpty { self.onFinalTranscript?(text) }
                } else if error != nil {
                    self.stopListeningForSpeechOnly()
                    if self.shouldResume { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { if self.shouldResume { self.beginRecognition() } } }
                }
            }
        } catch {
            stopListeningForSpeechOnly()
            shouldResume = false
            onError?("Mikrofon başlatılamadı: \(error.localizedDescription)")
        }
    }

    private func stopListeningForSpeechOnly() {
        recognitionTask?.cancel(); recognitionTask = nil
        recognitionRequest?.endAudio(); recognitionRequest = nil
        if audioEngine.isRunning { audioEngine.stop(); audioEngine.inputNode.removeTap(onBus: 0) }
        onStateChange?(false)
    }

    func speak(_ text: String) {
        stopListeningForSpeechOnly()
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "tr-TR")
        utterance.rate = 0.5
        synthesizer.speak(utterance)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        if shouldResume { DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { if self.shouldResume { self.beginRecognition() } } }
    }
}
