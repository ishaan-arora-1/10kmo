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

/// The Rightful signature: found money shown as a check made out to the user.
struct MoneyCheck: View {
    let number: String
    let payee: String
    let amountLabel: String
    let amount: Decimal
    let memo: String
    let footer: String
    var stamped = false

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                label("Pay to the order of")
                Spacer()
                label("No. \(number)")
            }
            Text(payee)
                .font(RightfulFont.display(24))
                .foregroundStyle(RightfulColor.ink)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 3)
                .overlay(alignment: .bottom) { rule }
            HStack(alignment: .firstTextBaseline) {
                label(amountLabel)
                Spacer(minLength: 12)
                Text(amount.usdCents)
                    .font(RightfulFont.display(40, weight: .heavy))
                    .foregroundStyle(RightfulColor.money)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            Text(memo)
                .font(RightfulFont.body(14))
                .foregroundStyle(RightfulColor.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 3)
                .overlay(alignment: .bottom) { rule }
            Text(footer)
                .font(RightfulFont.mono(11))
                .tracking(1.6)
                .foregroundStyle(RightfulColor.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 20)
        .padding(.top, 22)
        .padding(.bottom, 18)
        .background(CheckPaper())
        .overlay(alignment: .top) { Perforation() }
        .overlay(alignment: .topTrailing) {
            if stamped {
                PaidStamp()
                    .padding(.top, 52)
                    .padding(.trailing, 22)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var rule: some View {
        Rectangle()
            .fill(RightfulColor.checkLine)
            .frame(height: 1)
    }

    private func label(_ text: String) -> some View {
        Text(text.uppercased())
            .font(RightfulFont.mono(10))
            .tracking(1)
            .foregroundStyle(RightfulColor.muted)
    }
}

private struct CheckPaper: View {
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        shape
            .fill(RightfulColor.check)
            .overlay {
                Canvas { context, size in
                    var path = Path()
                    var x = -size.height
                    while x < size.width {
                        path.move(to: CGPoint(x: x, y: size.height))
                        path.addLine(to: CGPoint(x: x + size.height, y: 0))
                        x += 10
                    }
                    context.stroke(path, with: .color(RightfulColor.checkLine.opacity(0.22)), lineWidth: 1)
                }
                .clipShape(shape)
            }
            .overlay(shape.stroke(RightfulColor.checkLine))
            .shadow(color: .black.opacity(0.12), radius: 16, y: 10)
    }
}

/// Half-circle cut-outs along the top edge, like a check torn from a checkbook.
private struct Perforation: View {
    var body: some View {
        Canvas { context, size in
            var x: CGFloat = 8
            while x < size.width - 4 {
                context.fill(
                    Path(ellipseIn: CGRect(x: x - 3.5, y: -3.5, width: 7, height: 7)),
                    with: .color(RightfulColor.paper)
                )
                x += 12
            }
        }
        .frame(height: 4)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

struct PaidStamp: View {
    var body: some View {
        Text("PAID")
            .font(RightfulFont.display(22, weight: .heavy))
            .tracking(3)
            .foregroundStyle(RightfulColor.money)
            .padding(.horizontal, 10)
            .padding(.vertical, 1)
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .stroke(RightfulColor.money, lineWidth: 2.5)
            )
            .rotationEffect(.degrees(-12))
            .accessibilityLabel("Paid")
    }
}

extension Decimal {
    var usdCents: String {
        formatted(.currency(code: "USD").precision(.fractionLength(2)))
    }
}
