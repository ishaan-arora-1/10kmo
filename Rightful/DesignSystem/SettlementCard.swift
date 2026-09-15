import SwiftUI

struct SettlementCard: View {
    @Environment(AppModel.self) private var app
    let settlement: Settlement
    var actionLabel: String?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            BrandMonogram(
                brand: app.brand(for: settlement),
                fallbackName: settlement.company
            )

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text("\(settlement.company) · \(settlement.title)")
                        .font(RightfulFont.body(15, weight: .bold))
                        .foregroundStyle(RightfulColor.ink)
                        .lineLimit(2)
                    Spacer(minLength: 8)
                    Text(settlement.payoutRange)
                        .font(RightfulFont.mono(12, weight: .bold))
                        .foregroundStyle(RightfulColor.money)
                }

                HStack(spacing: 7) {
                    Text(settlement.proofRequired ? "Proof needed" : "No proof")
                        .font(RightfulFont.mono(10, weight: .medium))
                        .foregroundStyle(settlement.proofRequired ? RightfulColor.muted : RightfulColor.money)
                    Text("•")
                        .foregroundStyle(RightfulColor.divider)
                    Text("\(settlement.daysUntilDeadline) days")
                        .font(RightfulFont.mono(10, weight: .medium))
                        .foregroundStyle(RightfulColor.deadline)
                    if settlement.isSample {
                        Spacer()
                        SampleBadge()
                    }
                }

                if let actionLabel {
                    Text(actionLabel)
                        .font(RightfulFont.body(13, weight: .bold))
                        .foregroundStyle(RightfulColor.money)
                        .padding(.top, 3)
                }
            }
        }
        .padding(14)
        .background(RightfulColor.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .stroke(RightfulColor.divider)
        )
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
    }
}

struct ClaimStatusBadge: View {
    let status: ClaimStatus

    private var color: Color {
        switch status {
        case .needsFiling, .rejected:
            RightfulColor.deadline
        case .filed, .approved:
            RightfulColor.money
        case .paid:
            RightfulColor.money
        }
    }

    var body: some View {
        Text(status.rawValue.uppercased())
            .font(RightfulFont.mono(10, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(color.opacity(0.1))
            .clipShape(Capsule())
    }
}
