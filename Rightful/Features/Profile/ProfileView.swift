import SwiftUI

struct ProfileView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.openURL) private var openURL
    @State private var showBrands = false
    @State private var showStates = false
    @State private var showSignIn = false
    @State private var showDeleteConfirmation = false
    @State private var legalPage: LegalPage?

    var body: some View {
        @Bindable var app = app

        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                RightfulNavigationTitle(
                    title: "Profile",
                    subtitle: app.auth.isAuthenticated
                        ? "Your progress is synced" : "Your progress is stored on this phone"
                )

                if !app.auth.isAuthenticated {
                    Button {
                        showSignIn = true
                    } label: {
                        HStack {
                            Image(systemName: "person.badge.key.fill")
                                .foregroundStyle(RightfulColor.money)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Protect your claims")
                                    .font(RightfulFont.body(16, weight: .bold))
                                Text("Sign in to sync across devices")
                                    .font(RightfulFont.body(13))
                                    .foregroundStyle(RightfulColor.muted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(RightfulColor.muted)
                        }
                        .padding(16)
                        .background(RightfulColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 15))
                    }
                    .buttonStyle(.plain)
                }

                SettingsGroup(title: "Your matches") {
                    settingsButton(
                        icon: "square.grid.2x2.fill",
                        title: "Companies you’ve used",
                        detail: "\(app.selectedBrandIDs.count) selected"
                    ) {
                        showBrands = true
                    }
                    Divider().overlay(RightfulColor.divider)
                    settingsButton(
                        icon: "map.fill",
                        title: "States you’ve lived in",
                        detail: app.selectedStateCodes.isEmpty
                            ? "Add to check state-only settlements"
                            : app.selectedStateCodes.sorted().joined(separator: ", ")
                    ) {
                        showStates = true
                    }
                }

                SettingsGroup(title: "Membership") {
                    settingsButton(
                        icon: "checkmark.seal.fill",
                        title: app.isPremium ? "Rightful Premium" : "Free plan",
                        detail: app.isPremium
                            ? app.subscriptions.plan.rawValue.capitalized : "Upgrade to file and track"
                    ) {
                        if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                            openURL(url)
                        }
                    }
                    Divider().overlay(RightfulColor.divider)
                    settingsButton(icon: "arrow.clockwise", title: "Restore purchases") {
                        Task {
                            await app.subscriptions.restore()
                            await app.syncProfileIfPossible()
                        }
                    }
                }

                SettingsGroup(title: "Alerts") {
                    Toggle(isOn: $app.notificationsEnabled) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Deadline notifications")
                                .font(RightfulFont.body(15, weight: .medium))
                            Text("New matches, deadlines, and payouts")
                                .font(RightfulFont.body(12))
                                .foregroundStyle(RightfulColor.muted)
                        }
                    }
                    .tint(RightfulColor.money)
                    .onChange(of: app.notificationsEnabled) { _, enabled in
                        if enabled {
                            Task {
                                let granted = await app.enableNotifications()
                                if !granted { app.notificationsEnabled = false }
                            }
                        } else {
                            Task { await app.disableNotifications() }
                        }
                    }
                }

                SettingsGroup(title: "About") {
                    settingsButton(icon: "hand.raised.fill", title: "Privacy policy") {
                        legalPage = .privacy
                    }
                    Divider().overlay(RightfulColor.divider)
                    settingsButton(icon: "doc.text.fill", title: "Terms of use") {
                        legalPage = .terms
                    }
                    Divider().overlay(RightfulColor.divider)
                    settingsButton(icon: "info.circle.fill", title: "Legal disclaimer") {
                        legalPage = .disclaimer
                    }
                }

                SettingsGroup(title: "Account") {
                    if app.auth.isAuthenticated {
                        settingsButton(icon: "rectangle.portrait.and.arrow.right", title: "Sign out") {
                            Task { await app.signOutAndReset() }
                        }
                        Divider().overlay(RightfulColor.divider)
                    }
                    settingsButton(
                        icon: "trash.fill",
                        title: "Delete account and data",
                        destructive: true
                    ) {
                        showDeleteConfirmation = true
                    }
                }

                #if DEBUG
                    Button("Reset sample experience") {
                        app.resetDemo()
                    }
                    .font(RightfulFont.mono(11))
                    .foregroundStyle(RightfulColor.muted)
                    .frame(maxWidth: .infinity)
                #endif

                VStack(spacing: 4) {
                    Text("Rightful 1.0")
                    Text("Not a law firm. Not affiliated with settlement administrators.")
                }
                .font(RightfulFont.body(11))
                .foregroundStyle(RightfulColor.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 18)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
        }
        .sheet(isPresented: $showBrands) {
            EditBrandsView()
        }
        .sheet(isPresented: $showStates) {
            EditStatesView()
        }
        .sheet(isPresented: $showSignIn) {
            SignInView(
                onSkip: { showSignIn = false },
                onComplete: {
                    showSignIn = false
                    Task { await app.syncProfileIfPossible() }
                }
            )
        }
        .sheet(item: $legalPage) { page in
            LegalView(page: page)
        }
        .confirmationDialog(
            "Delete your account?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete account and all data", role: .destructive) {
                Task { _ = await app.deleteAccountAndLocalData() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your profile and claims. It does not cancel an App Store subscription.")
        }
        .navigationBarHidden(true)
        .rightfulScreen()
    }

    private func settingsButton(
        icon: String,
        title: String,
        detail: String? = nil,
        destructive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(destructive ? RightfulColor.danger : RightfulColor.money)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(RightfulFont.body(15, weight: .medium))
                    if let detail {
                        Text(detail)
                            .font(RightfulFont.body(12))
                            .foregroundStyle(RightfulColor.muted)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(RightfulColor.muted)
            }
            .foregroundStyle(destructive ? RightfulColor.danger : RightfulColor.ink)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct SettingsGroup<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            SectionLabel(text: title)
            VStack(spacing: 13) {
                content
            }
            .padding(15)
            .background(RightfulColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 15))
        }
    }
}

private struct EditBrandsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var brands: [Brand] {
        app.brands.filter { $0.matches(searchText: searchText) }
    }

    var body: some View {
        @Bindable var app = app

        NavigationStack {
            List {
                ForEach(brands) { brand in
                    Button {
                        if app.selectedBrandIDs.contains(brand.id) {
                            app.selectedBrandIDs.remove(brand.id)
                        } else {
                            app.selectedBrandIDs.insert(brand.id)
                        }
                    } label: {
                        HStack(spacing: 12) {
                            BrandMonogram(brand: brand, fallbackName: brand.name, size: 36)
                            Text(brand.name)
                                .font(RightfulFont.body(15, weight: .medium))
                                .foregroundStyle(RightfulColor.ink)
                            Spacer()
                            Image(
                                systemName: app.selectedBrandIDs.contains(brand.id)
                                    ? "checkmark.circle.fill"
                                    : "circle"
                            )
                            .foregroundStyle(
                                app.selectedBrandIDs.contains(brand.id)
                                    ? RightfulColor.money
                                    : RightfulColor.muted)
                        }
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(RightfulColor.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(RightfulColor.paper)
            .searchable(text: $searchText, prompt: "Search companies")
            .navigationTitle("Companies")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        Task { await app.syncProfileIfPossible() }
                        dismiss()
                    }
                }
            }
        }
        .rightfulScreen()
    }
}

struct EditStatesView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var states: [(code: String, name: String)] {
        guard !searchText.isEmpty else { return USStates.all }
        return USStates.all.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
                || $0.code.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(states, id: \.code) { state in
                        let selected = app.selectedStateCodes.contains(state.code)
                        Button {
                            if selected {
                                app.selectedStateCodes.remove(state.code)
                            } else {
                                app.selectedStateCodes.insert(state.code)
                            }
                        } label: {
                            HStack {
                                Text(state.name)
                                    .font(RightfulFont.body(15, weight: .medium))
                                    .foregroundStyle(RightfulColor.ink)
                                Spacer()
                                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selected ? RightfulColor.money : RightfulColor.muted)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(RightfulColor.surface)
                        .accessibilityValue(selected ? "Selected" : "Not selected")
                    }
                } footer: {
                    Text("Some settlements only cover people in certain states. Pick every state you’ve lived in since 2015.")
                        .font(RightfulFont.body(12))
                }
            }
            .scrollContentBackground(.hidden)
            .background(RightfulColor.paper)
            .searchable(text: $searchText, prompt: "Search states")
            .navigationTitle("States")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        Task { await app.syncProfileIfPossible() }
                        dismiss()
                    }
                }
            }
        }
        .rightfulScreen()
    }
}

enum LegalPage: String, Identifiable {
    case privacy = "Privacy policy"
    case terms = "Terms of use"
    case disclaimer = "Legal disclaimer"

    var id: String { rawValue }
}

struct LegalView: View {
    @Environment(\.dismiss) private var dismiss
    let page: LegalPage

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(page.rawValue)
                        .font(RightfulFont.display(32))
                    Text(copy)
                        .font(RightfulFont.body(15))
                        .foregroundStyle(RightfulColor.muted)
                        .lineSpacing(5)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .rightfulScreen()
        }
    }

    private var copy: String {
        switch page {
        case .privacy:
            """
            Rightful stores your selected companies and claim progress on your device. If you sign in, that information is encrypted in transit and stored in Supabase under your account.

            Rightful does not request or store bank credentials, card credentials, or your email password. Official claim forms open on the settlement administrator’s website and information entered there is governed by that administrator’s policy.

            You may delete your account and associated Rightful data from Profile at any time.
            """
        case .terms:
            """
            Rightful provides informational tools for discovering and tracking class-action settlements. It does not provide legal advice and does not guarantee eligibility, claim approval, payout timing, or payout amount.

            A paid subscription unlocks filing guides, alerts, and claim tracking. Subscriptions are billed by Apple and renew automatically unless canceled in Apple ID subscription settings.

            Always review the official settlement notice before submitting a claim. Submit only truthful information.
            """
        case .disclaimer:
            """
            Rightful is not a law firm and is not affiliated with any company, court, settlement administrator, or government agency.

            Settlement names, deadlines, eligibility information, and payout ranges must be verified against official notices. Estimated payout ranges are never promises. Sample records in the app are clearly labeled and are not live settlement offers.
            """
        }
    }
}
