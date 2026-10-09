import { useColorScheme } from "react-native";

/** The website's color tokens (website/public/styles.css and src/app.css), light and dark. */
const light = {
  paper: "#F1F5F0",
  surface: "#FFFFFF",
  sunk: "#E8EEE8",
  ink: "#14201A",
  muted: "#5B6B62",
  line: "#D3DDD5",
  money: "#0E7A4B",
  onMoney: "#FFFFFF",
  moneySoft: "#DCEFE3",
  deadline: "#A85B0C",
  deadlineSoft: "#FBEAD4",
  check: "#E4EFE2",
  checkLine: "#9FBFA9",
  danger: "#B3261E",
  onInk: "#F1F5F0",
  backdrop: "rgba(8, 18, 12, 0.5)",
};

export type Colors = typeof light;

const dark: Colors = {
  paper: "#0B120F",
  surface: "#131D18",
  sunk: "#0F1813",
  ink: "#E3ECE6",
  muted: "#93A59A",
  line: "#26352D",
  money: "#3FC486",
  onMoney: "#06140D",
  moneySoft: "#143626",
  deadline: "#E8A04E",
  deadlineSoft: "#3A2812",
  check: "#16261E",
  checkLine: "#3C6150",
  danger: "#F2786F",
  onInk: "#0B120F",
  backdrop: "rgba(8, 18, 12, 0.5)",
};

export const palettes = { light, dark };

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === "dark";
}

/** Mixes a hex color with transparency, like CSS color-mix(in srgb, color N%, transparent). */
export function alpha(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${amount})`;
}

/**
 * The website's three typefaces. Static files per weight: Android can't pick weights from a
 * family by fontWeight, so each weight is its own family name.
 */
export type Family = "body" | "display" | "mono";
export type Weight = 400 | 500 | 600 | 700 | 800;

const FAMILIES: Record<Family, Partial<Record<Weight, string>>> = {
  display: {
    500: "BricolageGrotesque_500Medium",
    700: "BricolageGrotesque_700Bold",
    800: "BricolageGrotesque_800ExtraBold",
  },
  body: {
    400: "HankenGrotesk_400Regular",
    500: "HankenGrotesk_500Medium",
    600: "HankenGrotesk_600SemiBold",
    700: "HankenGrotesk_700Bold",
    800: "HankenGrotesk_800ExtraBold",
  },
  mono: {
    400: "IBMPlexMono_400Regular",
    500: "IBMPlexMono_500Medium",
  },
};

export function fontFamily(family: Family, weight: Weight): string {
  const faces = FAMILIES[family];
  if (faces[weight]) return faces[weight]!;
  const available = (Object.keys(faces).map(Number) as Weight[]).sort((a, b) => a - b);
  const nearest = available.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best));
  return faces[nearest]!;
}

/** Side padding of every page, like the website's 20px. */
export const GUTTER = 20;
export const RADIUS = 14;
