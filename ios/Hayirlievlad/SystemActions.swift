import Foundation
import EventKit
import UIKit

actor SystemActions {
    static let shared = SystemActions()
    private let store = EKEventStore()

    func requestCalendarAccess() async throws -> Bool {
        try await store.requestFullAccessToEvents()
    }

    func requestReminderAccess() async throws -> Bool {
        try await store.requestFullAccessToReminders()
    }

    func addCalendarEvent(title: String, start: Date, durationMinutes: Int, notes: String? = nil) async throws {
        let granted = try await requestCalendarAccess()
        guard granted else { throw SystemActionError.permissionDenied("Takvim") }
        guard let calendar = store.defaultCalendarForNewEvents else { throw SystemActionError.unavailable("Varsayılan takvim") }
        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = start
        event.endDate = start.addingTimeInterval(TimeInterval(max(1, durationMinutes) * 60))
        event.notes = notes
        event.calendar = calendar
        try store.save(event, span: .thisEvent, commit: true)
    }

    func addReminder(title: String, due: Date?, notes: String? = nil) async throws {
        let granted = try await requestReminderAccess()
        guard granted else { throw SystemActionError.permissionDenied("Hatırlatıcılar") }
        guard let calendar = store.defaultCalendarForNewReminders() else { throw SystemActionError.unavailable("Varsayılan hatırlatıcı listesi") }
        let reminder = EKReminder(eventStore: store)
        reminder.title = title
        reminder.notes = notes
        reminder.calendar = calendar
        if let due {
            reminder.dueDateComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: due)
        }
        try store.save(reminder, commit: true)
    }

    func events(from start: Date, to end: Date) async throws -> [EKEvent] {
        let granted = try await requestCalendarAccess()
        guard granted else { throw SystemActionError.permissionDenied("Takvim") }
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        return store.events(matching: predicate).sorted { $0.startDate < $1.startDate }
    }

    @MainActor
    func clipboardText() -> String? {
        UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum SystemActionError: LocalizedError {
    case permissionDenied(String)
    case unavailable(String)
    case emptyClipboard

    var errorDescription: String? {
        switch self {
        case .permissionDenied(let name): return "\(name) izni verilmedi."
        case .unavailable(let name): return "\(name) kullanılamıyor."
        case .emptyClipboard: return "Panoda metin yok."
        }
    }
}
