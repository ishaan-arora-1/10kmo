import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const HomeIcon = () => (
  <Icon>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);

export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const ClaimsIcon = () => (
  <Icon>
    <path d="M12 2.5 14.3 4l2.8-.1.9 2.6 2.3 1.6-.9 2.6.9 2.6-2.3 1.6-.9 2.6-2.8-.1L12 21.5 9.7 20l-2.8.1-.9-2.6-2.3-1.6.9-2.6-.9-2.6L6 9.1l.9-2.6L9.7 4z" />
    <path d="m8.8 12 2.2 2.2 4.2-4.4" />
  </Icon>
);

export const ProfileIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Icon>
);

export const ArrowRightIcon = () => (
  <Icon width="18" height="18">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const ExternalIcon = () => (
  <Icon width="18" height="18">
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);

export const LockIcon = () => (
  <Icon width="18" height="18">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);
