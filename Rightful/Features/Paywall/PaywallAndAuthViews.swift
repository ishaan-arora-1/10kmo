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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
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
                }

                VStack(alignment: .leading, spacing: 9) {
                    Text("Turn matches into money")
                        .font(RightfulFont.display(36))
                    Text("You already saw what may be waiting. Rightful guides every filing and keeps it on track.")
                        .font(RightfulFont.body(16))
                        .foregroundStyle(RightfulColor.muted)
                }

                VStack(alignment: .leading, spacing: 14) {
                    feature("Verified official claim links", "checkmark.shield.fill")
                    feature("Deadline and new-match alerts", "bell.badge.fill")
                    feature("Every claim tracked until payout", "checkmark.seal.fill")
                }
                .padding(17)
                .background(RightfulColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))

                VStack(spacing: 10) {
                    PlanOption(
                        title: "Yearly",
                        detail: "3-day free trial, then \(yearlyPrice)",
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
                    Task {
                        if await app.subscriptions.purchase(selectedProduct) {
                            onSubscribed()
                        }
                    }
                } label: {
                    if app.subscriptions.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text(selectedPlan == .yearly ? "Start my 3-day trial" : "Continue weekly")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(selectedProduct == nil || app.subscriptions.isLoading)
                .opacity(selectedProduct == nil ? 0.55 : 1)

                Button("Restore purchases") {
                    Task {
                        await app.subscriptions.restore()
                        if app.isPremium {
                            onSubscribed()
                        }
                    }
                }
                .font(RightfulFont.body(14, weight: .medium))
                .foregroundStyle(RightfulColor.muted)
                .frame(maxWidth: .infinity)

                Text("Payment is charged to your Apple ID after the trial. Subscription renews unless canceled at least 24 hours before renewal.")
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

    private var yearlyPrice: String {
        app.subscriptions.product(for: .yearly)?.displayPrice ?? "$39.99/year"
    }

    private var weeklyPrice: String {
        "\(app.subscriptions.product(for: .weekly)?.displayPrice ?? "$4.99")/week"
    }

    private func feature(_ text: String, _ icon: String) -> some View {
        HStack(spacing: 11) {
            Image(systemName: icon)
                .foregroundStyle(RightfulColor.money)
                .frame(width: 24)
            Text(text)
                .font(RightfulFont.body(15, weight: .medium))
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

            if app.auth.isSampleMode {
                Button("Continue in sample mode", action: onSkip)
                    .font(RightfulFont.body(14, weight: .medium))
                    .foregroundStyle(RightfulColor.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }

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
