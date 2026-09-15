import Combine
import SwiftUI
import UIKit

@main
struct RightfulApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appModel)
                .preferredColorScheme(nil)
                .onOpenURL { url in
                    appModel.auth.handleOpenURL(url)
                }
                .onReceive(NotificationCenter.default.publisher(for: .didReceiveAPNsToken)) { notification in
                    guard let token = notification.object as? String else { return }
                    Task { await appModel.registerPushToken(token) }
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        NotificationCenter.default.post(name: .didReceiveAPNsToken, object: token)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: any Error
    ) {
        #if DEBUG
        print("Remote notification registration failed: \(error.localizedDescription)")
        #endif
    }
}

extension Notification.Name {
    static let didReceiveAPNsToken = Notification.Name("rightful.didReceiveAPNsToken")
}

struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Group {
            if app.onboardingCompleted {
                MainTabView()
            } else {
                OnboardingFlowView()
            }
        }
        .font(RightfulFont.body())
        .foregroundStyle(RightfulColor.ink)
        .rightfulScreen()
        .task {
            await app.prepare()
        }
        .alert(
            "Couldn’t refresh",
            isPresented: Binding(
                get: { app.dataError != nil },
                set: { if !$0 { app.dataError = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(app.dataError ?? "")
        }
    }
}

struct MainTabView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var app = app

        TabView(selection: $app.selectedTab) {
            NavigationStack {
                HomeView()
            }
            .tag(0)
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }

            NavigationStack {
                BrowseView()
            }
            .tag(1)
            .tabItem {
                Label("Browse", systemImage: "magnifyingglass")
            }

            NavigationStack {
                ClaimsView()
            }
            .tag(2)
            .tabItem {
                Label("Claims", systemImage: "checkmark.seal.fill")
            }

            NavigationStack {
                ProfileView()
            }
            .tag(3)
            .tabItem {
                Label("Profile", systemImage: "person.crop.circle")
            }
        }
        .tint(RightfulColor.money)
        .toolbarBackground(RightfulColor.surface, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}
