import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { ReactNode } from "react";

/** The website's line icons (website/src/components/icons.tsx), drawn with react-native-svg. */
function Icon({ size = 22, color, children }: { size?: number; color: string; children: ReactNode }) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export interface IconProps {
  color: string;
  size?: number;
}

export const HomeIcon = ({ color, size }: IconProps) => (
  <Icon color={color} size={size}>
    <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);

export const SearchIcon = ({ color, size }: IconProps) => (
  <Icon color={color} size={size}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="m20 20-3.5-3.5" />
  </Icon>
);

export const ClaimsIcon = ({ color, size }: IconProps) => (
  <Icon color={color} size={size}>
    <Path d="M12 2.5 14.3 4l2.8-.1.9 2.6 2.3 1.6-.9 2.6.9 2.6-2.3 1.6-.9 2.6-2.8-.1L12 21.5 9.7 20l-2.8.1-.9-2.6-2.3-1.6.9-2.6-.9-2.6L6 9.1l.9-2.6L9.7 4z" />
    <Path d="m8.8 12 2.2 2.2 4.2-4.4" />
  </Icon>
);

export const ProfileIcon = ({ color, size }: IconProps) => (
  <Icon color={color} size={size}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Icon>
);

export const ArrowRightIcon = ({ color, size = 18 }: IconProps) => (
  <Icon color={color} size={size}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const ExternalIcon = ({ color, size = 18 }: IconProps) => (
  <Icon color={color} size={size}>
    <Path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);

export const LockIcon = ({ color, size = 18 }: IconProps) => (
  <Icon color={color} size={size}>
    <Rect x="5" y="11" width="14" height="10" rx="2" />
    <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const GiftIcon = ({ color, size = 18 }: IconProps) => (
  <Icon color={color} size={size}>
    <Rect x="4" y="9" width="16" height="11" rx="1" />
    <Path d="M3 9h18M12 9v11M12 9c-1.5-3-5-3.5-5-1.25S10 9 12 9c2 0 5 .5 5-1.25S13.5 6 12 9" />
  </Icon>
);

export const CheckIcon = ({ color, size = 14 }: IconProps) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
