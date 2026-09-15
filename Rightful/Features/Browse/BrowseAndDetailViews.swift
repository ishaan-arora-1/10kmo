import SafariServices
import SwiftUI

struct BrowseView: View {
    @Environment(AppModel.self) private var app
    @State private var filter: BrowseFilter = .matches
    @State private var searchText = ""

    private var filteredSettlements: [Settlement] {
        var values = app.settlements.filter {
            searchText.isEmpty
                || $0.company.localizedCaseInsensitiveContains(searchText)
                || $0.title.localizedCaseInsensitiveContains(searchText)
        }

        switch filter {
        case .matches:
            values = values.filter { app.selectedBrandIDs.contains($0.brandID) }
        case .noProof:
            values = values.filter { !$0.proofRequired }
        case .closingSoon:
            values = values.filter(\.isClosingSoon)
        case .highestPayout:
            values.sort { $0.payoutMax > $1.payoutMax }
        }

        if filter != .highestPayout {
            values.sort { $0.deadline < $1.deadline }
        }
        return values
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 13) {
                RightfulNavigationTitle(
                    title: "Open settlements",
                    subtitle: "\(app.settlements.count) available · refreshed weekly"
                )

                HStack(spacing: 9) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(RightfulColor.muted)
                    TextField("Search companies or settlements", text: $searchText)
                        .font(RightfulFont.body(15))
                }
                .padding(.horizontal, 13)
                .frame(height: 44)
                .background(RightfulColor.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(RightfulColor.divider)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(BrowseFilter.allCases) { item in
                        Button(item.rawValue) { filter = item }
                            .font(RightfulFont.body(13, weight: .medium))
                            .foregroundStyle(filter == item ? .white : RightfulColor.muted)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 8)
                            .background(filter == item ? RightfulColor.ink : RightfulColor.surfaceMuted)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 18)
            }
            .padding(.vertical, 13)

            if filteredSettlements.isEmpty {
                ContentUnavailableView {
                    Label("No settlements found", systemImage: "magnifyingglass")
                } description: {
                    Text(
                        filter == .matches
                            ? "Add more companies in Profile to see more matches."
                            : "Try another search or filter.")
                }
                .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(filteredSettlements) { settlement in
                            NavigationLink(value: settlement) {
                                SettlementCard(settlement: settlement)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 24)
                }
                .refreshable {
                    await app.prepare()
                }
            }
        }
        .navigationDestination(for: Settlement.self) { settlement in
            SettlementDetailView(settlement: settlement)
        }
        .navigationBarHidden(true)
        .rightfulScreen()
    }
}

struct SettlementDetailView: View {
    @Environment(AppModel.self) private var app
    let settlement: Settlement
    var onFiledExternally: (() -> Void)?

    @State private var checks: [Bool]
    @State private var showSafari = false
    @State private var showConfirmation = false
    @State private var showPaywall = false
    @State private var showSignIn = false
    @State private var claimReference = ""

    init(settlement: Settlement, onFiledExternally: (() -> Void)? = nil) {
        self.settlement = settlement
        self.onFiledExternally = onFiledExternally
        _checks = State(initialValue: Array(repeating: false, count: settlement.eligibilityDetails.count))
    }

    private var isEligible: Bool {
        !checks.isEmpty && checks.allSatisfy { $0 }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(alignment: .center, spacing: 12) {
                    BrandMonogram(
                        brand: app.brand(for: settlement),
                        fallbackName: settlement.company,
                        size: 48
                    )
                    VStack(alignment: .leading, spacing: 3) {
                        Text(settlement.company)
                            .font(RightfulFont.mono(11, weight: .medium))
                            .foregroundStyle(RightfulColor.money)
                        Text(settlement.title)
                            .font(RightfulFont.display(32))
                    }
                    Spacer()
                }

                if settlement.isSample {
                    HStack(alignment: .top, spacing: 10) {
                        SampleBadge()
                        Text(
                            "This is demonstration content, not a live claim. The filing button opens the FTC refunds hub."
                        )
                        .font(RightfulFont.body(12))
                        .foregroundStyle(RightfulColor.muted)
                    }
                    .padding(12)
                    .background(RightfulColor.deadline.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                HStack(spacing: 0) {
                    metric("EST. PAYOUT", settlement.payoutRange, RightfulColor.money)
                    Divider()
                    metric("DEADLINE", settlement.deadlineLabel, RightfulColor.deadline)
                    Divider()
                    metric("PROOF", settlement.proofRequired ? "Needed" : "Not needed", RightfulColor.ink)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(RightfulColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: 15))

                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: "Who qualifies")
                    Text(settlement.qualifiesSummary)
                        .font(RightfulFont.body(16))
                        .fixedSize(horizontal: false, vertical: true)
                }

                VStack(alignment: .leading, spacing: 14) {
                    SectionLabel(text: "Before you file")
                    ForEach(Array(settlement.eligibilityDetails.enumerated()), id: \.offset) { index, detail in
                        CheckRow(title: detail, isChecked: $checks[index])
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    SectionLabel(text: "If approved")
                    Text("Expected payout \(settlement.expectedPayoutDate)")
                        .font(RightfulFont.body(15, weight: .medium))
                    Text("Amounts are estimates and depend on the final number of valid claims.")
                        .font(RightfulFont.body(12))
                        .foregroundStyle(RightfulColor.muted)
                }

                Button {
                    if app.isPremium {
                        showSafari = true
                    } else {
                        showPaywall = true
                    }
                } label: {
                    HStack {
                        Text(app.isPremium ? "File on official site" : "Unlock filing guide")
                        Image(systemName: app.isPremium ? "arrow.up.right" : "lock.fill")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!isEligible)
                .opacity(isEligible ? 1 : 0.42)

                Text(
                    "Verified settlement administrator link. Rightful is not a law firm and is not affiliated with this company."
                )
                .font(RightfulFont.body(11))
                .foregroundStyle(RightfulColor.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 16)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPaywall) {
            PaywallView(
                onClose: { showPaywall = false },
                onSubscribed: {
                    showPaywall = false
                    if app.auth.isAuthenticated || app.auth.isSampleMode {
                        showSafari = true
                    } else {
                        showSignIn = true
                    }
                }
            )
        }
        .sheet(isPresented: $showSignIn) {
            SignInView(
                onSkip: { showSignIn = false },
                onComplete: {
                    Task {
                        await app.syncProfileIfPossible()
                        showSignIn = false
                        showSafari = true
                    }
                }
            )
        }
        .sheet(isPresented: $showSafari, onDismiss: finishedOfficialSite) {
            SafariView(url: settlement.claimURL)
                .ignoresSafeArea()
        }
        .sheet(isPresented: $showConfirmation) {
            SubmissionConfirmationView(
                settlement: settlement,
                reference: $claimReference,
                onFiled: {
                    Task {
                        await app.markFiled(settlement: settlement, reference: claimReference)
                        showConfirmation = false
                        app.selectedTab = 2
                    }
                },
                onRemind: {
                    Task {
                        await app.remindTomorrow(for: settlement)
                        showConfirmation = false
                    }
                }
            )
            .presentationDetents([.medium, .large])
        }
        .rightfulScreen()
    }

    private func metric(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 5) {
            Text(label)
                .font(RightfulFont.mono(9, weight: .medium))
                .foregroundStyle(RightfulColor.muted)
            Text(value)
                .font(RightfulFont.mono(12, weight: .bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
    }

    private func finishedOfficialSite() {
        if let onFiledExternally {
            onFiledExternally()
        } else {
            showConfirmation = true
        }
    }
}

struct SubmissionConfirmationView: View {
    let settlement: Settlement
    @Binding var reference: String
    let onFiled: () -> Void
    let onRemind: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Capsule()
                .fill(RightfulColor.divider)
                .frame(width: 38, height: 5)
                .frame(maxWidth: .infinity)

            BrandMonogram(brand: nil, fallbackName: settlement.company, size: 42)
            Text("Did you submit your claim?")
                .font(RightfulFont.display(29))
            Text("Add the claim ID from the confirmation page so you can check its status later.")
                .font(RightfulFont.body(15))
                .foregroundStyle(RightfulColor.muted)

            TextField("Claim ID (optional)", text: $reference)
                .textInputAutocapitalization(.characters)
                .font(RightfulFont.mono(14))
                .padding(.horizontal, 13)
                .frame(height: 48)
                .background(RightfulColor.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(RightfulColor.divider)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))

            Button("Yes, mark as filed", action: onFiled)
                .buttonStyle(PrimaryButtonStyle())

            Button("Not yet · Remind me tomorrow", action: onRemind)
                .font(RightfulFont.body(14, weight: .medium))
                .foregroundStyle(RightfulColor.muted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
        .padding(20)
        .frame(maxHeight: .infinity, alignment: .top)
        .rightfulScreen()
    }
}

private struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.preferredControlTintColor = UIColor(RightfulColor.money)
        controller.dismissButtonStyle = .done
        return controller
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
