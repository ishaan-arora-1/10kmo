import SwiftUI

struct OnboardingFlowView: View {
    @Environment(AppModel.self) private var app
    @State private var stage: Stage = .welcome

    var body: some View {
        ZStack {
            switch stage {
            case .welcome:
                WelcomeStep { go(.brands) }
            case .brands:
                BrandPickerStep { go(.scanning) }
            case .scanning:
                ScanStep { go(.results) }
            case .results:
                ResultsStep(
                    onStartClaiming: startClaiming,
                    onPickMore: { go(.brands) },
                    onContinue: app.completeOnboarding
                )
            case .paywall:
                PaywallView(
                    onClose: app.completeOnboarding,
                    onSubscribed: afterSubscribing
                )
            case .signIn:
                SignInView(
                    onSkip: { go(.reminders) },
                    onComplete: {
                        Task { await app.syncProfileIfPossible() }
                        go(.reminders)
                    }
                )
            case .reminders:
                RemindersStep(
                    onEnable: {
                        Task {
                            _ = await app.enableNotifications()
                            app.completeOnboarding()
                        }
                    },
                    onSkip: app.completeOnboarding
                )
            }
        }
        .transition(.opacity.combined(with: .move(edge: .trailing)))
        .rightfulScreen()
    }

    private func go(_ next: Stage) {
        withAnimation(.snappy) { stage = next }
    }

    private func startClaiming() {
        if app.isPremium {
            afterSubscribing()
        } else {
            go(.paywall)
        }
    }

    /// Sign-in is offered after paying, never required to pay.
    private func afterSubscribing() {
        if app.auth.isAuthenticated || app.auth.isSampleMode {
            go(.reminders)
        } else {
            go(.signIn)
        }
    }

    private enum Stage {
        case welcome
        case brands
        case scanning
        case results
        case paywall
        case signIn
        case reminders
    }
}

private struct WelcomeStep: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                BrandSeal()
                Text(AppConstants.name)
                    .font(RightfulFont.mono(12, weight: .medium))
                    .foregroundStyle(RightfulColor.muted)
            }
            .padding(.top, 18)

            Spacer()

            Text("Companies have paid out billions in settlements. Some of it may be yours.")
                .font(RightfulFont.display(40))
                .minimumScaleFactor(0.82)
                .foregroundStyle(RightfulColor.ink)
                .padding(.bottom, 18)

            Text(
                "Tap the apps you’ve used. We’ll check open settlements and show what you could claim—before asking you to pay."
            )
            .font(RightfulFont.body(17))
            .foregroundStyle(RightfulColor.muted)
            .fixedSize(horizontal: false, vertical: true)

            Spacer()

            HStack {
                Label("Tap the apps you’ve used", systemImage: "checkmark.square")
                Spacer()
                Text("30 SEC")
                    .font(RightfulFont.mono(11, weight: .medium))
            }
            .font(RightfulFont.body(14, weight: .medium))
            .foregroundStyle(RightfulColor.muted)
            .padding(.bottom, 14)

            Button("Find my settlements", action: onContinue)
                .buttonStyle(PrimaryButtonStyle())
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 14)
        .safeAreaPadding(.top)
    }
}

struct BrandSeal: View {
    var body: some View {
        Text("R")
            .font(RightfulFont.mono(12, weight: .bold))
            .foregroundStyle(RightfulColor.money)
            .frame(width: 30, height: 30)
            .overlay(
                Circle()
                    .strokeBorder(RightfulColor.money, style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
            )
    }
}

private struct BrandPickerStep: View {
    @Environment(AppModel.self) private var app
    @State private var searchText = ""
    @State private var category: BrandCategory = .all
    let onContinue: () -> Void

    private var filteredBrands: [Brand] {
        app.brands.filter {
            (category == .all || $0.category == category)
                && $0.matches(searchText: searchText)
        }
    }

    var body: some View {
        @Bindable var app = app

        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Which of these have you used?")
                    .font(RightfulFont.display(30))
                Text("Any account since 2015 counts.")
                    .font(RightfulFont.body(14))
                    .foregroundStyle(RightfulColor.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 14)

            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(RightfulColor.muted)
                TextField("Search \(app.brands.count) apps & companies", text: $searchText)
                    .font(RightfulFont.body(15))
            }
            .padding(.horizontal, 13)
            .frame(height: 44)
            .background(RightfulColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(RightfulColor.divider)
            )
            .padding(.horizontal, 20)
            .padding(.top, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(BrandCategory.allCases) { item in
                        Button(item.rawValue) { category = item }
                            .font(RightfulFont.body(13, weight: .medium))
                            .foregroundStyle(category == item ? RightfulColor.onInk : RightfulColor.muted)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(category == item ? RightfulColor.ink : RightfulColor.surfaceMuted)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 20)
            }
            .padding(.vertical, 12)

            ScrollView {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3),
                    spacing: 10
                ) {
                    ForEach(filteredBrands) { brand in
                        let selected = app.selectedBrandIDs.contains(brand.id)
                        Button {
                            if selected {
                                app.selectedBrandIDs.remove(brand.id)
                            } else {
                                app.selectedBrandIDs.insert(brand.id)
                            }
                        } label: {
                            VStack(spacing: 7) {
                                BrandMonogram(brand: brand, fallbackName: brand.name, size: 40)
                                Text(brand.name)
                                    .font(RightfulFont.body(12, weight: .medium))
                                    .lineLimit(2)
                                    .minimumScaleFactor(0.85)
                                    .multilineTextAlignment(.center)
                                    .foregroundStyle(RightfulColor.ink)
                                    .padding(.horizontal, 4)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 96)
                            .background(selected ? RightfulColor.money.opacity(0.1) : RightfulColor.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 13)
                                    .stroke(
                                        selected ? RightfulColor.money : RightfulColor.divider,
                                        lineWidth: selected ? 2 : 1
                                    )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 13))
                        }
                        .buttonStyle(.plain)
                        .accessibilityValue(selected ? "Selected" : "Not selected")
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 110)
            }

            VStack(spacing: 8) {
                Text("\(app.selectedBrandIDs.count) selected")
                    .font(RightfulFont.mono(11))
                    .foregroundStyle(RightfulColor.muted)
                Button("Check open settlements", action: onContinue)
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(app.selectedBrandIDs.isEmpty)
                    .opacity(app.selectedBrandIDs.isEmpty ? 0.45 : 1)
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .background(RightfulColor.paper)
        }
        .safeAreaPadding(.top)
    }
}

private struct ScanStep: View {
    @Environment(AppModel.self) private var app
    @State private var progress = 0.05
    @State private var checkedCount = 0
    let onComplete: () -> Void

    var body: some View {
        VStack(spacing: 26) {
            Spacer()

            ZStack {
                Circle()
                    .stroke(RightfulColor.surfaceMuted, lineWidth: 9)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        RightfulColor.money,
                        style: StrokeStyle(lineWidth: 9, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 1) {
                    Text("\(checkedCount)")
                        .font(RightfulFont.display(38))
                    Text("of \(app.settlements.count)")
                        .font(RightfulFont.mono(11))
                        .foregroundStyle(RightfulColor.muted)
                }
            }
            .frame(width: 156, height: 156)

            VStack(spacing: 8) {
                Text("Checking open settlements")
                    .font(RightfulFont.display(28))
                Text("Matching happens securely on your phone.")
                    .font(RightfulFont.body(15))
                    .foregroundStyle(RightfulColor.muted)
            }
            .multilineTextAlignment(.center)

            VStack(spacing: 0) {
                ForEach(Array(app.matchedSettlements.prefix(4))) { settlement in
                    HStack {
                        Text("\(settlement.company) · \(settlement.title)")
                            .font(RightfulFont.body(14))
                        Spacer()
                        Text("Match")
                            .font(RightfulFont.mono(11, weight: .bold))
                            .foregroundStyle(RightfulColor.money)
                    }
                    .padding(.vertical, 12)
                    .overlay(alignment: .bottom) {
                        Divider().overlay(RightfulColor.divider)
                    }
                }
            }
            .padding(.horizontal, 24)

            Spacer()
        }
        .padding(.horizontal, 20)
        .task {
            for step in 1...24 {
                try? await Task.sleep(for: .milliseconds(70))
                progress = Double(step) / 24
                checkedCount = Int(progress * Double(app.settlements.count))
            }
            try? await Task.sleep(for: .milliseconds(250))
            onComplete()
        }
    }
}

private struct ResultsStep: View {
    @Environment(AppModel.self) private var app
    let onStartClaiming: () -> Void
    let onPickMore: () -> Void
    let onContinue: () -> Void

    private var matches: [Settlement] { app.matchedSettlements }

    private var noProofCount: Int {
        matches.filter { !$0.proofRequired }.count
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(matches.isEmpty ? "Scan complete" : "Good news")
                        .font(RightfulFont.mono(11, weight: .medium))
                        .foregroundStyle(RightfulColor.money)
                    Text(headline)
                        .font(RightfulFont.display(32))
                        .fixedSize(horizontal: false, vertical: true)

                    if matches.isEmpty {
                        Text("New settlements open every week. Add more companies you’ve used, or continue and we’ll show new matches as they’re verified.")
                            .font(RightfulFont.body(16))
                            .foregroundStyle(RightfulColor.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        if matches.allSatisfy(\.isSample) {
                            SampleBadge()
                        }

                        MoneyCheck(
                            number: String(format: "%04d", matches.count),
                            payee: "You",
                            amountLabel: "Est. up to",
                            amount: app.potentialMaximum,
                            memo: "\(matches.count) \(matches.count == 1 ? "settlement" : "settlements") · \(noProofCount) need no proof",
                            footer: "‖ \(app.settlements.count) CHECKED ‖ \(matches.count) MATCHED"
                        )
                        .padding(.vertical, 8)

                        ForEach(Array(matches.prefix(3))) { settlement in
                            Button(action: onStartClaiming) {
                                SettlementCard(settlement: settlement)
                            }
                            .buttonStyle(.plain)
                        }

                        if matches.count > 3 {
                            Text("+ \(matches.count - 3) more \(matches.count - 3 == 1 ? "match" : "matches")")
                                .font(RightfulFont.body(14, weight: .bold))
                                .foregroundStyle(RightfulColor.muted)
                                .frame(maxWidth: .infinity)
                        }

                        Text("Estimates come from court filings. Final amounts depend on how many people claim.")
                            .font(RightfulFont.body(12))
                            .foregroundStyle(RightfulColor.muted)
                            .fixedSize(horizontal: false, vertical: true)

                        if matches.contains(where: \.isSample) {
                            Text("Sample records are labeled and are not live claims.")
                                .font(RightfulFont.body(12))
                                .foregroundStyle(RightfulColor.muted)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 22)
                .padding(.bottom, 16)
            }

            VStack(spacing: 6) {
                if matches.isEmpty {
                    Button("Pick more companies", action: onPickMore)
                        .buttonStyle(PrimaryButtonStyle())
                    Button("Continue to Rightful", action: onContinue)
                        .font(RightfulFont.body(14, weight: .medium))
                        .foregroundStyle(RightfulColor.muted)
                        .padding(.vertical, 8)
                } else {
                    Button("Start claiming", action: onStartClaiming)
                        .buttonStyle(PrimaryButtonStyle())
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 8)
            .background(RightfulColor.paper)
        }
        .safeAreaPadding(.top)
    }

    private var headline: String {
        guard !matches.isEmpty else { return "No open matches yet" }
        return "You may qualify for \(matches.count) \(matches.count == 1 ? "settlement" : "settlements")"
    }
}

private struct RemindersStep: View {
    @Environment(AppModel.self) private var app
    let onEnable: () -> Void
    let onSkip: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            ExampleNotification(settlement: app.nearestDeadlineSettlement)
            Spacer()

            Text("Deadlines don’t wait")
                .font(RightfulFont.display(38))
            Text("We’ll remind you before a claim closes and when a new settlement matches you.")
                .font(RightfulFont.body(17))
                .foregroundStyle(RightfulColor.muted)
                .fixedSize(horizontal: false, vertical: true)

            Button("Turn on reminders", action: onEnable)
                .buttonStyle(PrimaryButtonStyle())
                .padding(.top, 8)
            Button("Not now", action: onSkip)
                .font(RightfulFont.body(15, weight: .medium))
                .foregroundStyle(RightfulColor.muted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 14)
        .safeAreaPadding(.top)
    }
}

private struct ExampleNotification: View {
    let settlement: Settlement?

    var body: some View {
        HStack(alignment: .top, spacing: 11) {
            Text("R")
                .font(RightfulFont.display(17))
                .foregroundStyle(RightfulColor.onMoney)
                .frame(width: 38, height: 38)
                .background(RightfulColor.money)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(AppConstants.name)
                        .font(RightfulFont.body(14, weight: .bold))
                    Spacer()
                    Text("now")
                        .font(RightfulFont.body(13))
                        .foregroundStyle(RightfulColor.muted)
                }
                Text(title)
                    .font(RightfulFont.body(15, weight: .bold))
                Text(detail)
                    .font(RightfulFont.body(14))
                    .foregroundStyle(RightfulColor.muted)
            }
        }
        .padding(14)
        .background(RightfulColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(RightfulColor.divider)
        )
        .shadow(color: .black.opacity(0.12), radius: 18, y: 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Example reminder. \(title). \(detail)")
    }

    private var title: String {
        guard let settlement else { return "A settlement you match closes in 3 days" }
        return "\(settlement.company) settlement closes in 3 days"
    }

    private var detail: String {
        guard let settlement, settlement.payoutMax > 0 else { return "Filing takes about 3 minutes." }
        return "Est. \(settlement.payoutRange). Filing takes about 3 minutes."
    }
}
