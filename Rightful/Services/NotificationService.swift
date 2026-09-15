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

    func scheduleDeadlineAlerts(for settlements: [Settlement]) async {
        let identifiers = settlements.flatMap {
            ["deadline-\($0.id)-7", "deadline-\($0.id)-1"]
        }
        center.removePendingNotificationRequests(withIdentifiers: identifiers)

        for settlement in settlements where !settlement.isSample {
            await scheduleDeadlineAlert(for: settlement, daysBefore: 7)
            await scheduleDeadlineAlert(for: settlement, daysBefore: 1)
        }
    }

    func scheduleFilingReminder(for settlement: Settlement) {
        let content = UNMutableNotificationContent()
        content.title = "Did you finish your \(settlement.company) claim?"
        content.body = "Mark it filed so Rightful can keep the claim on track."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: 24 * 60 * 60,
            repeats: false
        )
        center.add(
            UNNotificationRequest(
                identifier: "filing-\(settlement.id)",
                content: content,
                trigger: trigger
            )
        )
    }

    func scheduleWeeklyDigest(waitingAmount: Decimal, claimCount: Int) {
        let content = UNMutableNotificationContent()
        content.title = "\(waitingAmount.usd) may still be waiting"
        content.body = "Review your \(claimCount) open \(claimCount == 1 ? "claim" : "claims") this week."
        content.sound = .default

        var date = DateComponents()
        date.weekday = 1
        date.hour = 10
        let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: true)

        center.add(
            UNNotificationRequest(
                identifier: "weekly-digest",
                content: content,
                trigger: trigger
            )
        )
    }

    func disableAll() {
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    private func scheduleDeadlineAlert(for settlement: Settlement, daysBefore: Int) async {
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
        content.body = "Your estimated \(settlement.payoutRange) claim is still waiting."
        content.sound = .default

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour],
            from: alertDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(
            identifier: "deadline-\(settlement.id)-\(daysBefore)",
            content: content,
            trigger: trigger
        )
        try? await center.add(request)
    }
}
