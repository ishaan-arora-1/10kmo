import Foundation
import UIKit
import UserNotifications

@MainActor
final class NotificationService {
    private let center = UNUserNotificationCenter.current()

    func requestPermission() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
            return granted
        } catch {
            return false
        }
    }

    func resumeRemoteRegistrationIfAuthorized() async {
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional
        {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func isAuthorized() async -> Bool {
        let status = await center.notificationSettings().authorizationStatus
        return status == .authorized || status == .provisional
    }

    func scheduleDeadlineAlerts(for settlements: [Settlement]) async throws {
        let identifiers = await center.pendingNotificationRequests()
            .map(\.identifier)
            .filter { $0.hasPrefix("deadline-") }
        if !identifiers.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: identifiers)
        }

        for settlement in settlements where !settlement.isSample {
            try await scheduleDeadlineAlert(for: settlement, daysBefore: 7)
            try await scheduleDeadlineAlert(for: settlement, daysBefore: 1)
        }
    }

    func scheduleFilingReminder(for settlement: Settlement) async -> Bool {
        let settings = await center.notificationSettings()
        var isAuthorized =
            settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional

        if settings.authorizationStatus == .notDetermined {
            isAuthorized = await requestPermission()
        }

        guard isAuthorized else {
            return false
        }

        let content = UNMutableNotificationContent()
        content.title = "Did you finish your \(settlement.company) claim?"
        content.body = "Mark it filed so Rightful can keep the claim on track."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: 24 * 60 * 60,
            repeats: false
        )
        do {
            try await center.add(
                UNNotificationRequest(
                    identifier: "filing-\(settlement.id)",
                    content: content,
                    trigger: trigger
                )
            )
            return true
        } catch {
            return false
        }
    }

    func scheduleWeeklyDigest(waitingAmount: Decimal, claimCount: Int) async throws {
        center.removePendingNotificationRequests(withIdentifiers: ["weekly-digest"])

        let content = UNMutableNotificationContent()
        content.title = "\(waitingAmount.usd) may still be waiting"
        content.body = "Review your \(claimCount) open \(claimCount == 1 ? "claim" : "claims") this week."
        content.sound = .default

        var date = DateComponents()
        date.weekday = 1
        date.hour = 10
        let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: true)

        try await center.add(
            UNNotificationRequest(
                identifier: "weekly-digest",
                content: content,
                trigger: trigger
            )
        )
    }

    func cancelReminders(for settlement: Settlement) {
        center.removePendingNotificationRequests(
            withIdentifiers: [
                "deadline-\(settlement.id)-7",
                "deadline-\(settlement.id)-1",
                "filing-\(settlement.id)",
            ]
        )
    }

    func disableAll() {
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    private func scheduleDeadlineAlert(for settlement: Settlement, daysBefore: Int) async throws {
        guard
            let alertDate = Calendar.current.date(
                byAdding: .day,
                value: -daysBefore,
                to: settlement.deadline
            ), alertDate > .now
        else {
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "\(settlement.company) closes \(daysBefore == 1 ? "tomorrow" : "in \(daysBefore) days")"
        content.body = settlement.payoutMax > 0
            ? "Estimated \(settlement.payoutRange) is still waiting."
            : "Your claim is still waiting. File before it closes."
        content.sound = .default

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour],
            from: alertDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        try await center.add(
            UNNotificationRequest(
                identifier: "deadline-\(settlement.id)-\(daysBefore)",
                content: content,
                trigger: trigger
            )
        )
    }
}
