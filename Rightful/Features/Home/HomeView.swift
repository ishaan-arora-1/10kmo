import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var app
    @State private var showStates = false

    private var nextToFile: [Settlement] {
        app.matchedSettlements.filter { app.claim(for: $0) == nil }
    }

    private var urgent: Settlement? {
        nextToFile.min { $0.deadline < $1.deadline }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                RightfulNavigationTitle(
                    title: "Hi there",
                    subtitle: app.isUsingSampleData
                        ? "Previewing the product with sample data" : "Here’s what’s waiting for you"
                )

                WaitingCard()

                if let urgent {
                    SectionLabel(text: "Most urgent")
                    NavigationLink(value: urgent) {
                        UrgentClaimCard(settlement: urgent)
                    }
                    .buttonStyle(.plain)
                }

                SectionLabel(text: "Ready to file")
                if nextToFile.isEmpty {
                    EmptyHomeCard()
                } else {
                    ForEach(nextToFile.filter { $0.id != urgent?.id }) { settlement in
                        NavigationLink(value: settlement) {
                            SettlementCard(settlement: settlement, actionLabel: "Review eligibility")
                        }
                        .buttonStyle(.plain)
                    }
                }

                FindMoreCard(needsStates: app.selectedStateCodes.isEmpty) {
                    if app.selectedStateCodes.isEmpty {
                        showStates = true
                    } else {
                        app.selectedTab = 1
                    }
                }

                Text("Rightful is not a law firm and is not affiliated with settlement administrators.")
                    .font(RightfulFont.body(11))
                    .foregroundStyle(RightfulColor.muted)
                    .padding(.bottom, 16)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
        }
        .refreshable {
            await app.prepare()
        }
        .navigationDestination(for: Settlement.self) { settlement in
            SettlementDetailView(settlement: settlement)
        }
        .sheet(isPresented: $showStates) {
            EditStatesView()
        }
        .navigationBarHidden(true)
        .rightfulScreen()
    }
}

private struct WaitingCard: View {
    @Environment(AppModel.self) private var app

    private var toFileCount: Int {
        app.matchedSettlements.filter { app.claim(for: $0) == nil }.count
    }

    private var filedCount: Int {
        app.claims.filter { $0.status != .paid }.count
    }

    private var paidCount: Int {
        app.claims.filter { $0.status == .paid }.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack {
                Text("WAITING FOR YOU")
                    .font(RightfulFont.mono(10, weight: .medium))
                    .foregroundStyle(RightfulColor.onHero.opacity(0.7))
                Spacer()
                if app.isUsingSampleData {
                    Text("SAMPLE")
                        .font(RightfulFont.mono(9, weight: .bold))
                        .foregroundStyle(RightfulColor.deadline)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(.white)
                        .clipShape(Capsule())
                }
            }
            Text(app.waitingMaximum.usd)
                .font(RightfulFont.display(44))
                .foregroundStyle(RightfulColor.onHero)

            GeometryReader { proxy in
                let total = max(1, toFileCount + filedCount + paidCount)
                HStack(spacing: 3) {
                    Capsule()
                        .fill(RightfulColor.onHero.opacity(0.9))
                        .frame(width: proxy.size.width * CGFloat(toFileCount) / CGFloat(total))
                    Capsule()
                        .fill(RightfulColor.money)
                        .frame(width: proxy.size.width * CGFloat(filedCount) / CGFloat(total))
                    Capsule()
                        .fill(RightfulColor.onHero.opacity(0.28))
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 5)

            HStack {
                metric("\(toFileCount)", "to file")
                Spacer()
                metric("\(filedCount)", "filed")
                Spacer()
                metric(app.paidTotal.usd, "paid")
            }
        }
        .padding(18)
        .background(RightfulColor.heroCard)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(RightfulFont.mono(12, weight: .bold))
            Text(label)
                .font(RightfulFont.body(11))
                .opacity(0.68)
        }
        .foregroundStyle(RightfulColor.onHero)
    }
}

private struct UrgentClaimCard: View {
    @Environment(AppModel.self) private var app
    let settlement: Settlement

    var body: some View {
        HStack(spacing: 13) {
            BrandMonogram(
                brand: app.brand(for: settlement),
                fallbackName: settlement.company,
                size: 42
            )
            VStack(alignment: .leading, spacing: 4) {
                Text("\(settlement.company) · \(settlement.title)")
                    .font(RightfulFont.body(15, weight: .bold))
                Text("Closes in \(settlement.daysUntilDeadline) days")
                    .font(RightfulFont.mono(11, weight: .medium))
                    .foregroundStyle(RightfulColor.deadline)
                if settlement.isSample {
                    SampleBadge()
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 7) {
                Text(settlement.payoutRange)
                    .font(RightfulFont.mono(12, weight: .bold))
                    .foregroundStyle(RightfulColor.money)
                Text("File")
                    .font(RightfulFont.body(12, weight: .bold))
                    .foregroundStyle(RightfulColor.onInk)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(RightfulColor.ink)
                    .clipShape(Capsule())
            }
        }
        .padding(14)
        .background(RightfulColor.deadline.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 15)
                .stroke(RightfulColor.deadline.opacity(0.34))
        )
        .clipShape(RoundedRectangle(cornerRadius: 15))
    }
}

private struct FindMoreCard: View {
    let needsStates: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Find more money")
                        .font(RightfulFont.body(16, weight: .bold))
                    Text(
                        needsStates
                            ? "Add the states you’ve lived in to check state-only settlements."
                            : "Browse open settlements and add companies you’ve used."
                    )
                        .font(RightfulFont.body(13))
                        .foregroundStyle(RightfulColor.muted)
                        .multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "arrow.right")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(RightfulColor.money)
            }
            .padding(16)
            .background(RightfulColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 15))
        }
        .buttonStyle(.plain)
    }
}

private struct EmptyHomeCard: View {
    var body: some View {
        VStack(spacing: 9) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 30))
                .foregroundStyle(RightfulColor.money)
            Text("You’re caught up")
                .font(RightfulFont.body(16, weight: .bold))
            Text("We’ll keep checking for new matches.")
                .font(RightfulFont.body(13))
                .foregroundStyle(RightfulColor.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(22)
        .background(RightfulColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 15))
    }
}
