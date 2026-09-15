import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BrandSeal } from "./components/ui";
import { Shell } from "./components/Shell";
import { useStore } from "./lib/store";
import { Browse } from "./pages/Browse";
import { Claims } from "./pages/Claims";
import { Home } from "./pages/Home";
import { Onboarding } from "./pages/Onboarding";
import { Paywall } from "./pages/Paywall";
import { Profile } from "./pages/Profile";
import { SettlementDetail } from "./pages/SettlementDetail";
import { SignIn } from "./pages/SignIn";
import { Welcome } from "./pages/Welcome";

export function App() {
  const { ready, error, dismissError } = useStore();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="boot" aria-busy="true" aria-label="Loading Rightful">
        <BrandSeal size={44} />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/start" element={<Onboarding />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/paywall" element={<Paywall />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route
          element={
            <RequireOnboarding>
              <Shell />
            </RequireOnboarding>
          }
        >
          <Route index element={<Home />} />
          <Route path="browse" element={<Browse />} />
          <Route path="settlements/:id" element={<SettlementDetail />} />
          <Route path="claims" element={<Claims />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {error && (
        <div className="toast" role="status">
          <span>{error}</span>
          <button type="button" className="toast-close" onClick={dismissError}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const { onboardingCompleted } = useStore();
  return onboardingCompleted ? children : <Navigate to="/start" replace />;
}
