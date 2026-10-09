import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alpha, fontFamily, RADIUS, useColors, type Colors, type Family, type Weight } from "@/theme";
import { CheckIcon, SearchIcon } from "./icons";

type ColorName = keyof Colors;

export interface TxtProps extends TextProps {
  f?: Family;
  w?: Weight;
  size?: number;
  color?: ColorName;
  /** Line height as a multiple of size. */
  lh?: number;
  /** Letter spacing in em, like the CSS. */
  ls?: number;
  upper?: boolean;
  center?: boolean;
}

/** All text in the app: the website's fonts, sizes, and colors. */
export function Txt({ f = "body", w = 400, size = 16, color = "ink", lh, ls, upper, center, style, ...rest }: TxtProps) {
  const c = useColors();
  const base: TextStyle = {
    fontFamily: fontFamily(f, w),
    fontSize: size,
    lineHeight: Math.round(size * (lh ?? (f === "display" ? 1.15 : 1.5))),
    color: c[color],
    letterSpacing: ls != null ? ls * size : f === "display" ? -0.02 * size : undefined,
    textTransform: upper ? "uppercase" : undefined,
    textAlign: center ? "center" : undefined,
  };
  return <Text {...rest} style={[base, style]} />;
}

export const Eyebrow = (props: TxtProps) => <Txt f="mono" size={13} ls={0.08} upper color="money" {...props} />;
export const FlowTitle = (props: TxtProps) => <Txt f="display" w={800} size={32} lh={1.06} accessibilityRole="header" {...props} />;
export const PageTitle = (props: TxtProps) => <Txt f="display" w={800} size={34} lh={1.07} accessibilityRole="header" {...props} />;
export const SectionLabel = (props: TxtProps) => <Txt f="mono" w={500} size={12} ls={0.12} upper color="muted" accessibilityRole="header" {...props} />;
export const SubTitle = (props: TxtProps) => <Txt f="display" w={700} size={18} lh={1.25} accessibilityRole="header" {...props} />;
export const Muted = (props: TxtProps) => <Txt color="muted" {...props} />;
export const FinePrint = (props: TxtProps) => <Txt size={13} color="muted" {...props} />;
export const MonoNote = (props: TxtProps) => <Txt f="mono" size={12} color="muted" {...props} />;

type ButtonKind = "primary" | "secondary" | "dark" | "danger";

/** The website's .btn: 54px tall, 14px corners, bold 17px label. */
export function Button({
  children,
  onPress,
  kind = "primary",
  disabled,
  block = true,
  icon,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  block?: boolean;
  icon?: (color: string) => ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const colors: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.money, fg: c.onMoney },
    secondary: { bg: c.surface, fg: c.ink, border: c.line },
    dark: { bg: c.ink, fg: c.paper },
    danger: { bg: c.danger, fg: "#FFFFFF" },
  };
  const { bg, fg, border } = colors[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        border ? { borderWidth: 1, borderColor: border } : null,
        block ? { alignSelf: "stretch" } : { alignSelf: "flex-start" },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Txt w={700} size={17} style={{ color: fg }} numberOfLines={1}>
          {children}
        </Txt>
      ) : (
        children
      )}
      {icon?.(fg)}
    </Pressable>
  );
}

/** The website's .btn-quiet: a muted text button. */
export function QuietButton({
  children,
  onPress,
  disabled,
  color = "muted",
  strong,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  color?: ColorName;
  strong?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [styles.quiet, { opacity: disabled ? 0.45 : pressed ? 0.6 : 1 }]}
    >
      <Txt w={strong ? 700 : 600} size={15} color={color} center>
        {children}
      </Txt>
    </Pressable>
  );
}

/** Inline underlined link inside fine print. */
export function LinkText({ children, onPress, size = 13 }: { children: ReactNode; onPress: () => void; size?: number }) {
  return (
    <Txt size={size} color="muted" style={{ textDecorationLine: "underline" }} onPress={onPress} accessibilityRole="link">
      {children}
    </Txt>
  );
}

/** Round × button (.icon-btn). */
export function CloseButton({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: c.sunk, opacity: pressed ? 0.7 : 1 }]}
    >
      <Txt size={24} lh={1} color="muted" style={{ marginTop: Platform.OS === "android" ? -2 : 0 }}>
        ×
      </Txt>
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: c.surface, borderColor: focused ? c.money : c.line, borderWidth: focused ? 2 : 1 },
      ]}
    >
      <SearchIcon color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={alpha(c.muted, 0.8)}
        accessibilityLabel={accessibilityLabel}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.searchInput, { color: c.ink, fontFamily: fontFamily("body", 400) }]}
      />
    </View>
  );
}

/** The website's .field text input. */
export function Field({ style, mono, ...props }: TextInputProps & { mono?: boolean }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={alpha(c.muted, 0.8)}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[
        styles.field,
        {
          backgroundColor: c.surface,
          borderColor: focused ? c.money : c.line,
          borderWidth: focused ? 2 : 1,
          color: c.ink,
          fontFamily: fontFamily(mono ? "mono" : "body", 400),
        },
        style,
      ]}
    />
  );
}

/** Horizontal filter chips (.chips / .chip). */
export function Chips<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const c = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      style={{ flexGrow: 0 }}
    >
      {items.map((item) => {
        const on = item === value;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? c.ink : c.sunk }]}
          >
            <Txt w={600} size={14} style={{ color: on ? c.onInk : c.muted }}>
              {item}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Checkbox({ checked }: { checked: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.checkbox,
        { borderColor: checked ? c.money : c.muted, backgroundColor: checked ? c.money : c.surface },
      ]}
    >
      {checked && <CheckIcon color={c.onMoney} />}
    </View>
  );
}

export function Radio({ checked }: { checked: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.radio, { borderColor: checked ? c.money : c.muted }]}>
      {checked && <View style={[styles.radioDot, { backgroundColor: c.money }]} />}
    </View>
  );
}

/** A labeled switch row (.toggle-row). */
export function Toggle({
  value,
  onValueChange,
  label,
  description,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[styles.toggleRow, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w={600}>{label}</Txt>
        {description && (
          <Txt size={13} color="muted">
            {description}
          </Txt>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: c.money, false: c.line }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={c.line}
      />
    </View>
  );
}

/** Small uppercase pill (.status-badge, .sample-badge, .badge). */
export function Pill({
  children,
  tone = "money",
  size = 11,
  style,
}: {
  children: ReactNode;
  tone?: "money" | "deadline" | "muted";
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const tones = {
    money: { fg: c.money, bg: c.moneySoft },
    deadline: { fg: c.deadline, bg: c.deadlineSoft },
    muted: { fg: c.muted, bg: c.sunk },
  };
  return (
    <View style={[styles.pill, { backgroundColor: tones[tone].bg }, style]}>
      <Txt f="mono" w={500} size={size} upper ls={0.06} lh={1.3} style={{ color: tones[tone].fg }}>
        {children}
      </Txt>
    </View>
  );
}

export function SampleBadge() {
  return <Pill tone="deadline">Sample data</Pill>;
}

/** Bordered surface card. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>{children}</View>;
}

export function EmptyCard({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Txt w={700} center>
        {title}
      </Txt>
      <Txt color="muted" center>
        {body}
      </Txt>
      {action}
    </View>
  );
}

/** Green (or amber) notice strip (.notice). */
export function Notice({ children, warn, style }: { children: ReactNode; warn?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.notice, { backgroundColor: warn ? c.deadlineSoft : c.moneySoft }, style]}>{children}</View>;
}

export function Spinner() {
  const c = useColors();
  return <ActivityIndicator size="large" color={c.money} />;
}

/**
 * The website's modal, as on phones: a sheet from the bottom with a title and a × button.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  scroll = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: c.backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: c.paper, paddingBottom: Math.max(20, insets.bottom + 8) }]}
          >
            <View style={styles.sheetHead}>
              <Txt f="display" w={800} size={24} style={{ flex: 1 }} accessibilityRole="header">
                {title}
              </Txt>
              <CloseButton onPress={onClose} />
            </View>
            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={{ gap: 14, flexShrink: 1 }}>{children}</View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  quiet: { padding: 10, alignSelf: "center" },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 0, height: "100%" },
  field: { height: 50, paddingHorizontal: 14, borderRadius: 12, fontSize: 16 },
  chip: { borderRadius: 99, paddingVertical: 8, paddingHorizontal: 14 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 14,
  },
  pill: { alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  card: { borderWidth: 1, borderRadius: RADIUS, padding: 14 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 20, borderWidth: 1, borderRadius: 18 },
  notice: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12 },
});
