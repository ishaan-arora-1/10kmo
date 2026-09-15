import AuthenticationServices
import StoreKit
import SwiftUI

struct PaywallView: View {
    @Environment(AppModel.self) private var app
    @State private var selectedPlan: SubscriptionPlan = .yearly
    @State private var legalPage: LegalPage?
    let onClose: () -> Void
    let onSubscribed: () -> Void

    private var selectedProduct: Product? {
        app.subscriptions.product(for: selectedPlan)
    }

    private var waiting: Decimal { app.waitingMaximum }
    private var nearest: Settlement? { app.nearestDeadlineSettlement }
    private var matchCount: Int { app.unfiledMatchedSettlements.count }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    BrandSeal()
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(RightfulColor.muted)
                            .frame(width: 34, height: 34)
                            .background(RightfulColor.surfaceMuted)
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Close")
                }

                Text(waiting > 0 ? "Don’t let \(waiting.usd) expire" : "Turn matches into money")
                    .font(RightfulFont.display(36))
                    .fixedSize(horizontal: false, vertical: true)

                if let nearest {
                    HStack {
                        Text("Your first deadline")
                            .font(RightfulFont.body(15, weight: .bold))
                        Spacer()
                        Text(deadlineText(for: nearest))
                            .font(RightfulFont.mono(12, weight: .medium))
                            .foregroundStyle(RightfulColor.deadline)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(RightfulColor.deadline.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else {
                    Text("Rightful guides every filing and keeps each claim on track until you’re paid.")
                        .font(RightfulFont.body(16))
                        .foregroundStyle(RightfulColor.muted)
                }

                VStack(alignment: .leading, spacing: 14) {
                    feature(filingFeature, "list.bullet.clipboard.fill")
                    feature("An alert the day a new settlement matches you", "bell.badge.fill")
                    feature("Deadline reminders, so nothing closes on you", "calendar.badge.clock")
                    feature("A tracker for every claim until you’re paid", "checkmark.seal.fill")
                }
                .padding(17)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RightfulColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))

                VStack(spacing: 10) {
                    PlanOption(
                        title: "Yearly",
                        detail: yearlyDetail,
                        badge: "BEST VALUE",
                        selected: selectedPlan == .yearly
                    ) {
                        selectedPlan = .yearly
                    }
                    PlanOption(
                        title: "Weekly",
                        detail: weeklyPrice,
                        badge: nil,
                        selected: selectedPlan == .weekly
                    ) {
                        selectedPlan = .weekly
                    }
                }

                if let message = app.subscriptions.errorMessage {
                    Text(message)
                        .font(RightfulFont.body(13))
                        .foregroundStyle(RightfulColor.danger)
                }

                Button {
                    guard let selectedProduct else { return }
                    purchase(selectedProduct)
                } label: {
                    if app.subscriptions.isLoading {
                        ProgressView()
                            .tint(RightfulColor.onMoney)
                    } else {
                        Text(purchaseButtonTitle)
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(selectedProduct == nil || app.subscriptions.isLoading)
                .opacity(selectedProduct == nil ? 0.55 : 1)

                Button("Restore purchases", action: restorePurchases)
                    .font(RightfulFont.body(14, weight: .medium))
                    .foregroundStyle(RightfulColor.muted)
                    .frame(maxWidth: .infinity)

                Text(billingDisclosure)
                    .font(RightfulFont.body(11))
                    .foregroundStyle(RightfulColor.muted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)

                HStack {
                    Button("Terms") { legalPage = .terms }
                    Text("•")
                    Button("Privacy") { legalPage = .privacy }
                }
                .font(RightfulFont.body(12, weight: .medium))
                .foregroundStyle(RightfulColor.muted)
                .frame(maxWidth: .infinity)
            }
            .padding(20)
        }
        .interactiveDismissDisabled()
        .sheet(item: $legalPage) { page in
            LegalView(page: page)
        }
        .rightfulScreen()
    }

    private var filingFeature: String {
        switch matchCount {
        case 0: "Step-by-step filing for every match"
        case 1: "Step-by-step filing for your match"
        case 2: "Step-by-step filing for both of your matches"
        default: "Step-by-step filing for all \(matchCount) of your matches"
        }
    }

    private func deadlineText(for settlement: Settlement) -> String {
        let days = settlement.daysUntilDeadline
        return "\(settlement.deadlineLabel) · \(days) \(days == 1 ? "day" : "days")"
    }

    /// Purchases never require an account. If the user is signed in, the transaction
    /// is tagged with their ID; otherwise it's linked when they sign in later.
    private func purchase(_ product: Product) {
        Task {
            if await app.subscriptions.purchase(
                product,
                appAccountToken: app.auth.userID
            ) {
                await app.syncProfileIfPossible()
                onSubscribed()
            }
        }
    }

    private func restorePurchases() {
        Task {
            await app.subscriptions.restore()
            if app.isPremium {
                await app.syncProfileIfPossible()
                onSubscribed()
            }
        }
    }

    private var yearlyPrice: String {
        if let price = app.subscriptions.product(for: .yearly)?.displayPrice {
            return "\(price)/year"
        }
        return "$39.99/year"
    }

    private var weeklyPrice: String {
        "\(app.subscriptions.product(for: .weekly)?.displayPrice ?? "$4.99")/week"
    }

    private var yearlyDetail: String {
        app.subscriptions.isEligibleForYearlyTrial
            ? "\(trialPeriod) free trial, then \(yearlyPrice)"
            : yearlyPrice
    }

    private var purchaseButtonTitle: String {
        if selectedPlan == .weekly {
            return "Continue weekly"
        }
        return app.subscriptions.isEligibleForYearlyTrial
            ? "Start my \(trialPeriod) trial"
            : "Continue yearly"
    }

    private var billingDisclosure: String {
        if selectedPlan == .weekly {
            return
                "\(weeklyPrice) is charged to your Apple ID today. Subscription renews weekly unless canceled at least 24 hours before renewal."
        }
        if app.subscriptions.isEligibleForYearlyTrial {
            return
                "No charge today. \(yearlyPrice) is charged after the \(trialPeriod) trial. Subscription renews yearly unless canceled at least 24 hours before renewal."
        }
        return
            "\(yearlyPrice) is charged to your Apple ID today. Subscription renews yearly unless canceled at least 24 hours before renewal."
    }

    private var trialPeriod: String {
        app.subscriptions.yearlyTrialPeriodText ?? "introductory"
    }

    private func feature(_ text: String, _ icon: String) -> some View {
        HStack(spacing: 11) {
            Image(systemName: icon)
                .foregroundStyle(RightfulColor.money)
                .frame(width: 24)
            Text(text)
                .font(RightfulFont.body(15, weight: .medium))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct PlanOption: View {
    let title: String
    let detail: String
    let badge: String?
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 13) {
                Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(selected ? RightfulColor.money : RightfulColor.muted)
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(title)
                            .font(RightfulFont.body(16, weight: .bold))
                        if let badge {
                            Text(badge)
                                .font(RightfulFont.mono(9, weight: .bold))
                                .foregroundStyle(RightfulColor.money)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(RightfulColor.money.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                    Text(detail)
                        .font(RightfulFont.body(13))
                        .foregroundStyle(RightfulColor.muted)
                }
                Spacer()
            }
            .foregroundStyle(RightfulColor.ink)
            .padding(15)
            .background(RightfulColor.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(selected ? RightfulColor.money : RightfulColor.divider, lineWidth: selected ? 2 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct SignInView: View {
    @Environment(AppModel.self) private var app
    let onSkip: () -> Void
    let onComplete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Spacer()

            BrandSeal()
            Text("Save your claims")
                .font(RightfulFont.display(38))
            Text("Sign in so your selected companies, claim IDs, and payout progress stay safe across devices.")
                .font(RightfulFont.body(17))
                .foregroundStyle(RightfulColor.muted)

            Spacer()

            if !app.auth.isSampleMode {
                SignInWithAppleButton(.continue) { request in
                    app.auth.configureAppleRequest(request)
                } onCompletion: { result in
                    Task {
                        if await app.auth.completeAppleSignIn(result) {
                            onComplete()
                        }
                    }
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Button {
                    Task {
                        if await app.auth.signInWithGoogle() {
                            onComplete()
                        }
                    }
                } label: {
                    HStack {
                        Text("G")
                            .font(RightfulFont.body(17, weight: .bold))
                        Text("Continue with Google")
                    }
                }
                .buttonStyle(SecondaryButtonStyle())
            }

            Button(app.auth.isSampleMode ? "Continue in sample mode" : "Not now", action: onSkip)
                .font(RightfulFont.body(14, weight: .medium))
                .foregroundStyle(RightfulColor.muted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)

            if let message = app.auth.errorMessage {
                Text(message)
                    .font(RightfulFont.body(13))
                    .foregroundStyle(RightfulColor.danger)
            }

            Text("Rightful never asks for your bank, card, or email password.")
                .font(RightfulFont.body(11))
                .foregroundStyle(RightfulColor.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
        }
        .padding(22)
        .safeAreaPadding(.vertical)
    }
}
