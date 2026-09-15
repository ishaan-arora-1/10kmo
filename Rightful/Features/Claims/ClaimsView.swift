import SwiftUI

struct ClaimsView: View {
    @Environment(AppModel.self) private var app
    @State private var selectedClaim: Claim?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                RightfulNavigationTitle(
                    title: "My claims",
                    subtitle: "\(app.claims.count) tracked · \(app.paidTotal.usd) paid"
                )

                if app.claims.isEmpty {
                    VStack(spacing: 14) {
                        Image(systemName: "checkmark.seal")
                            .font(.system(size: 38))
                            .foregroundStyle(RightfulColor.money)
                        Text("No claims filed yet")
                            .font(RightfulFont.display(24))
                        Text("When you finish a claim on its official site, it’ll appear here until you’re paid.")
                            .font(RightfulFont.body(15))
                            .foregroundStyle(RightfulColor.muted)
                            .multilineTextAlignment(.center)
                        Button("Browse matches") {
                            app.selectedTab = 1
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                    .padding(24)
                    .background(RightfulColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                } else {
                    ForEach(app.claims) { claim in
                        if let settlement = app.settlement(for: claim) {
                            ClaimCard(
                                claim: claim,
                                settlement: settlement,
                                onGotPaid: {
                                    selectedClaim = claim
                                }
                            )
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
        }
        .refreshable {
            await app.prepare()
        }
        .sheet(item: $selectedClaim) { claim in
            if let settlement = app.settlement(for: claim) {
                PaidConfirmationView(claim: claim, settlement: settlement) {
                    selectedClaim = nil
                }
            }
        }
        .navigationBarHidden(true)
        .rightfulScreen()
    }
}

private struct ClaimCard: View {
    @Environment(AppModel.self) private var app
    let claim: Claim
    let settlement: Settlement
    let onGotPaid: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                BrandMonogram(
                    brand: app.brand(for: settlement),
                    fallbackName: settlement.company
                )
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(settlement.company) · \(settlement.title)")
                        .font(RightfulFont.body(15, weight: .bold))
                    if let reference = claim.claimReference {
                        Text("ID \(reference)")
                            .font(RightfulFont.mono(10))
                            .foregroundStyle(RightfulColor.muted)
                    }
                    if settlement.isSample {
                        SampleBadge()
                    }
                }
                Spacer()
                ClaimStatusBadge(status: claim.status)
            }

            Divider().overlay(RightfulColor.divider)

            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("EXPECTED")
                        .font(RightfulFont.mono(9))
                        .foregroundStyle(RightfulColor.muted)
                    Text(settlement.expectedPayoutDate)
                        .font(RightfulFont.body(13, weight: .medium))
                }
                Spacer()
                if claim.status == .paid, let amount = claim.paidAmount {
                    Text(amount.usd)
                        .font(RightfulFont.display(24))
                        .foregroundStyle(RightfulColor.money)
                } else {
                    Button("I got paid", action: onGotPaid)
                        .font(RightfulFont.body(13, weight: .bold))
                        .foregroundStyle(RightfulColor.money)
                        .padding(.horizontal, 13)
                        .padding(.vertical, 8)
                        .background(RightfulColor.money.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(15)
        .background(RightfulColor.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(RightfulColor.divider)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

private struct PaidConfirmationView: View {
    @Environment(AppModel.self) private var app
    let claim: Claim
    let settlement: Settlement
    let onDone: () -> Void

    @State private var amountText = ""
    @State private var paidAmount: Decimal?
    @State private var shareImage: Image?

    var body: some View {
        VStack(spacing: 19) {
            Capsule()
                .fill(RightfulColor.divider)
                .frame(width: 38, height: 5)

            if let paidAmount {
                Text(settlement.isSample ? "Sample payout" : "You got paid")
                    .font(RightfulFont.display(32))
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("\(settlement.company) · \(settlement.title)")
                    .font(RightfulFont.body(15))
                    .foregroundStyle(RightfulColor.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                PaidCheck(
                    company: settlement.company,
                    amount: paidAmount,
                    isSample: settlement.isSample
                )
                .padding(.vertical, 8)

                if let shareImage {
                    ShareLink(
                        item: shareImage,
                        preview: SharePreview(
                            "I found money with Rightful",
                            image: shareImage
                        )
                    ) {
                        Label(
                            settlement.isSample ? "Share product preview" : "Share the win",
                            systemImage: "square.and.arrow.up"
                        )
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }

                Button("Done", action: onDone)
                    .buttonStyle(SecondaryButtonStyle())
            } else {
                Spacer()
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 54))
                    .foregroundStyle(RightfulColor.money)
                Text(settlement.isSample ? "Sample payout complete" : "You got paid!")
                    .font(RightfulFont.display(34))
                Text("How much arrived?")
                    .font(RightfulFont.body(16))
                    .foregroundStyle(RightfulColor.muted)

                HStack {
                    Text("$")
                        .font(RightfulFont.display(28))
                    TextField("0.00", text: $amountText)
                        .keyboardType(.decimalPad)
                        .font(RightfulFont.display(30))
                }
                .padding(.horizontal, 16)
                .frame(height: 62)
                .background(RightfulColor.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(RightfulColor.divider)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14))

                Button("Mark as paid") {
                    guard let amount = Decimal(string: amountText), amount > 0 else {
                        return
                    }
                    Task {
                        await app.markPaid(claimID: claim.id, amount: amount)
                        paidAmount = amount
                        renderShareCard(amount: amount)
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(Decimal(string: amountText).map { $0 <= 0 } ?? true)
                Spacer()
            }
        }
        .padding(20)
        .rightfulScreen()
    }

    @MainActor
    private func renderShareCard(amount: Decimal) {
        let card = PaidShareImage(
            company: settlement.company,
            amount: amount,
            isSample: settlement.isSample
        )
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3
        if let uiImage = renderer.uiImage {
            shareImage = Image(uiImage: uiImage)
        }
    }
}

private struct PaidCheck: View {
    let company: String
    let amount: Decimal
    var isSample = false

    var body: some View {
        MoneyCheck(
            number: "0001",
            payee: "Me",
            amountLabel: "Amount",
            amount: amount,
            memo: "\(company) settlement",
            footer: isSample ? "SAMPLE · NOT A REAL PAYOUT" : "‖ FIND YOURS ‖ RIGHTFUL APP",
            stamped: true
        )
    }
}

/// 1080×1260 image (rendered at 3×) for sharing to Stories and Messages.
private struct PaidShareImage: View {
    let company: String
    let amount: Decimal
    var isSample = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                BrandSeal()
                Text(AppConstants.name)
                    .font(RightfulFont.mono(12, weight: .medium))
                    .foregroundStyle(RightfulColor.muted)
            }
            Text("I got \(amount.usd) from a settlement I didn’t know I was owed.")
                .font(RightfulFont.display(22))
                .foregroundStyle(RightfulColor.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            PaidCheck(company: company, amount: amount, isSample: isSample)
            Spacer(minLength: 0)
        }
        .padding(24)
        .frame(width: 360, height: 420)
        .background(RightfulColor.paper)
    }
}
