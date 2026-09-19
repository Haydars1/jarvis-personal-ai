import Foundation
import AVFoundation
import Speech

final class VoiceEngine: NSObject, AVSpeechSynthesizerDelegate {
    var onFinalTranscript: ((String) -> Void)?
    var onStateChange: ((Bool) -> Void)?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "tr-TR"))
    private let audioEngine = AVAudioEngine()
    private let synthesizer = AVSpeechSynthesizer()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var shouldResume = false
    private var isSpeaking = false

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func startListening() {
        shouldResume = true
        Task {
            let speechAllowed = await withCheckedContinuation { c in SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) } }
            let micAllowed = await AVAudioApplication.requestRecordPermission()
            guard speechAllowed && micAllowed else { return }
            await MainActor.run { self.beginRecognition() }
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
        stopListeningForSpeechOnly()
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

            recognitionTask = recognizer?.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                if let result, self.isSpeaking, !result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    self.synthesizer.stopSpeaking(at: .immediate)
                    self.isSpeaking = false
                }
                if let result, result.isFinal {
                    let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                    self.stopListeningForSpeechOnly()
                    if !text.isEmpty { self.onFinalTranscript?(text) }
                } else if error != nil {
                    self.stopListeningForSpeechOnly()
                    if self.shouldResume { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.beginRecognition() } }
                }
            }
        } catch {
            onStateChange?(false)
        }
    }

    private func stopListeningForSpeechOnly() {
        recognitionTask?.cancel(); recognitionTask = nil
        recognitionRequest?.endAudio(); recognitionRequest = nil
        if audioEngine.isRunning { audioEngine.stop(); audioEngine.inputNode.removeTap(onBus: 0) }
        onStateChange?(false)
    }

    func speak(_ text: String) {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = true
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "tr-TR")
        utterance.rate = 0.5
        synthesizer.speak(utterance)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        isSpeaking = false
        if shouldResume && !audioEngine.isRunning { DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.beginRecognition() } }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        isSpeaking = false
    }
}
