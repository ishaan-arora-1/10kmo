import SwiftUI
import UIKit

enum RightfulColor {
    static let paper = dynamic(light: "#F1F5F0", dark: "#0B120F")
    static let surface = dynamic(light: "#FFFFFF", dark: "#131D18")
    static let surfaceMuted = dynamic(light: "#E5ECE7", dark: "#1D2A23")
    static let ink = dynamic(light: "#14291A", dark: "#EEF5F0")
    static let muted = dynamic(light: "#586B62", dark: "#A9B8B0")
    static let divider = dynamic(light: "#CFD9D1", dark: "#2C3B33")
    static let money = dynamic(light: "#0E7A48", dark: "#3FC486")
    static let deadline = dynamic(light: "#A85B0C", dark: "#F3A65A")
    static let danger = dynamic(light: "#83261E", dark: "#EB6A4E")

    private static func dynamic(light: String, dark: String) -> Color {
        Color(
            UIColor { traits in
                UIColor(Color(hex: traits.userInterfaceStyle == .dark ? dark : light))
            }
        )
    }
}

enum RightfulFont {
    static func display(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .custom("Bricolage Grotesque", size: size, relativeTo: .title).weight(weight)
    }

    static func body(_ size: CGFloat = 16, weight: Font.Weight = .regular) -> Font {
        .custom("Hanken Grotesk", size: size, relativeTo: .body).weight(weight)
    }

    static func mono(_ size: CGFloat = 12, weight: Font.Weight = .regular) -> Font {
        .custom("IBM Plex Mono", size: size, relativeTo: .caption).weight(weight)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var role: ButtonRole?

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(RightfulFont.body(16, weight: .bold))
            .foregroundStyle(role == .destructive ? Color.white : Color.white)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(role == .destructive ? RightfulColor.danger : RightfulColor.money)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(configuration.isPressed ? 0.78 : 1)
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(RightfulFont.body(16, weight: .bold))
            .foregroundStyle(RightfulColor.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(RightfulColor.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(RightfulColor.divider)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}

struct SectionLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(RightfulFont.mono(11, weight: .medium))
            .tracking(1.2)
            .foregroundStyle(RightfulColor.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct SampleBadge: View {
    var body: some View {
        Text("SAMPLE DATA")
            .font(RightfulFont.mono(10, weight: .bold))
            .tracking(0.7)
            .foregroundStyle(RightfulColor.deadline)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(RightfulColor.deadline.opacity(0.1))
            .clipShape(Capsule())
            .accessibilityLabel("Sample data, not a live settlement")
    }
}

struct BrandMonogram: View {
    let brand: Brand?
    let fallbackName: String
    var size: CGFloat = 38

    var body: some View {
        Text(brand?.initial ?? String(fallbackName.prefix(1)).uppercased())
            .font(RightfulFont.body(size * 0.36, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(hex: brand?.monogramColorHex ?? "#0E7A48"))
            .clipShape(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
            .accessibilityHidden(true)
    }
}

struct CheckRow: View {
    let title: String
    @Binding var isChecked: Bool

    var body: some View {
        Button {
            isChecked.toggle()
        } label: {
            HStack(alignment: .top, spacing: 11) {
                Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(isChecked ? RightfulColor.money : RightfulColor.muted)
                Text(title)
                    .font(RightfulFont.body(15))
                    .foregroundStyle(RightfulColor.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(isChecked ? "Checked" : "Not checked")
    }
}

struct RightfulNavigationTitle: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(RightfulFont.display(30))
                .foregroundStyle(RightfulColor.ink)
            if let subtitle {
                Text(subtitle)
                    .font(RightfulFont.body(14))
                    .foregroundStyle(RightfulColor.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension View {
    func rightfulScreen() -> some View {
        self
            .background(RightfulColor.paper.ignoresSafeArea())
            .tint(RightfulColor.money)
    }
}
