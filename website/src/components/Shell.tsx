import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useStore } from "../lib/store";
import { ClaimsIcon, HomeIcon, ProfileIcon, SearchIcon } from "./icons";
import { BrandSeal, SampleBadge } from "./ui";

const TABS: { to: string; label: string; icon: () => ReactNode }[] = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/browse", label: "Browse", icon: SearchIcon },
  { to: "/claims", label: "Claims", icon: ClaimsIcon },
  { to: "/profile", label: "Profile", icon: ProfileIcon },
];

export function Shell() {
  const { isSampleData } = useStore();
  return (
    <div className="shell">
      <header className="app-top">
        <a className="brand" href="/">
          <BrandSeal />
          Rightful
        </a>
        <nav className="app-nav" aria-label="Main">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.to === "/"} className="app-nav-link">
              {tab.label}
            </NavLink>
          ))}
        </nav>
        {isSampleData && <SampleBadge />}
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <NavLink key={tab.to} to={tab.to} end={tab.to === "/"} className="tab">
              <TabIcon />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
