import SwiftUI

struct OnboardingFlowView: View {
    @Environment(AppModel.self) private var app
    @State private var stage: Stage = .welcome
    @State private var selectedSettlement: Settlement?
    @State private var claimReference = ""

    var body: some View {
        ZStack {
            switch stage {
            case .welcome:
                WelcomeStep {
                    withAnimation(.snappy) { stage = .brands }
                }
            case .brands:
                BrandPickerStep {
                    withAnimation(.snappy) { stage = .scanning }
                }
            case .scanning:
                ScanStep {
                    withAnimation(.snappy) { stage = .results }
                }
            case .results:
                ResultsStep(
                    onSelect: { settlement in
                        selectedSettlement = settlement
                        withAnimation(.snappy) {
                            stage = app.isPremium ? .signIn : .paywall
                        }
                    },
                    onExplore: app.completeOnboarding
                )
            case .paywall:
                PaywallView(
                    onClose: { withAnimation(.snappy) { stage = .results } },
                    onSubscribed: { withAnimation(.snappy) { stage = .signIn } }
                )
            case .signIn:
                SignInView(
                    onSkip: { withAnimation(.snappy) { stage = .detail } },
                    onComplete: {
                        Task { await app.syncProfileIfPossible() }
                        withAnimation(.snappy) { stage = .detail }
                    }
                )
            case .detail:
                if let selectedSettlement {
                    NavigationStack {
                        SettlementDetailView(
                            settlement: selectedSettlement,
                            onFiledExternally: {
                                withAnimation(.snappy) { stage = .confirmation }
                            }
                        )
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) {
                                Button {
                                    withAnimation(.snappy) { stage = .results }
                                } label: {
                                    Image(systemName: "chevron.left")
                                }
                            }
                        }
                    }
                }
            case .confirmation:
                if let selectedSettlement {
                    SubmissionConfirmationView(
                        settlement: selectedSettlement,
                        reference: $claimReference,
                        onFiled: {
                            Task {
                                await app.markFiled(
                                    settlement: selectedSettlement,
                                    reference: claimReference
                                )
                                app.completeOnboarding()
                                app.selectedTab = 2
                            }
                        },
                        onRemind: {
                            app.remindTomorrow(for: selectedSettlement)
                            app.completeOnboarding()
                        }
                    )
                }
            }
        }
        .transition(.opacity.combined(with: .move(edge: .trailing)))
        .rightfulScreen()
    }

    private enum Stage {
        case welcome
        case brands
        case scanning
        case results
        case paywall
        case signIn
        case detail
        case confirmation
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
                            .foregroundStyle(category == item ? .white : RightfulColor.muted)
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
                            VStack(spacing: 8) {
                                BrandMonogram(brand: brand, fallbackName: brand.name, size: 42)
                                Text(brand.name)
                                    .font(RightfulFont.body(12, weight: .medium))
                                    .lineLimit(1)
                                    .foregroundStyle(RightfulColor.ink)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 92)
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
    let onSelect: (Settlement) -> Void
    let onExplore: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Good news")
                    .font(RightfulFont.mono(11, weight: .medium))
                    .foregroundStyle(RightfulColor.money)
                Text(
                    "You may qualify for \(app.matchedSettlements.count) \(app.matchedSettlements.count == 1 ? "settlement" : "settlements")"
                )
                .font(RightfulFont.display(34))

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("EST. UP TO")
                            .font(RightfulFont.mono(10))
                            .foregroundStyle(RightfulColor.muted)
                        Spacer()
                        if !app.matchedSettlements.isEmpty,
                            app.matchedSettlements.allSatisfy(\.isSample)
                        {
                            SampleBadge()
                        }
                    }
                    Text(app.potentialMaximum.usd)
                        .font(RightfulFont.display(46))
                        .foregroundStyle(RightfulColor.money)
                    Text("Estimated ranges, never promised")
                        .font(RightfulFont.body(13))
                        .foregroundStyle(RightfulColor.muted)
                }
                .padding(18)
                .background(RightfulColor.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(RightfulColor.divider)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16))

                ForEach(app.matchedSettlements) { settlement in
                    Button {
                        onSelect(settlement)
                    } label: {
                        SettlementCard(settlement: settlement)
                    }
                    .buttonStyle(.plain)
                }

                if app.matchedSettlements.isEmpty {
                    ContentUnavailableView(
                        "No matches yet",
                        systemImage: "checkmark.magnifyingglass",
                        description: Text("Add more companies to improve your scan.")
                    )
                }

                if app.matchedSettlements.contains(where: \.isSample) {
                    Text(
                        "Sample records are labeled and are not live claims. Production records come from human-verified official notices."
                    )
                    .font(RightfulFont.body(12))
                    .foregroundStyle(RightfulColor.muted)
                    .padding(.vertical, 4)
                }

                Button("Explore all settlements", action: onExplore)
                    .buttonStyle(SecondaryButtonStyle())
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 22)
        }
        .safeAreaPadding(.top)
    }
}
