import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  brandFromRow,
  claimFromRow,
  claimToRow,
  matchSettlements,
  settlementFromRow,
  type Brand,
  type Claim,
  type Plan,
  type PlanSource,
  type Settlement,
} from "./models";
import { SAMPLE_BRANDS, SAMPLE_SETTLEMENTS } from "./sample";
import { isSampleMode, supabase } from "./supabase";

const STORAGE_KEY = "rightful.web.v1";

/** Everything a visitor does before signing in lives in the browser, like the iPhone app. */
interface LocalState {
  brandIds: string[];
  states: string[];
  claims: Claim[];
  dirtyClaimIds: string[];
  onboardingCompleted: boolean;
  sampleUnlocked: boolean;
}

const EMPTY_LOCAL: LocalState = {
  brandIds: [],
  states: [],
  claims: [],
  dirtyClaimIds: [],
  onboardingCompleted: false,
  sampleUnlocked: false,
};

function readLocal(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_LOCAL, ...(JSON.parse(raw) as Partial<LocalState>) } : EMPTY_LOCAL;
  } catch {
    return EMPTY_LOCAL;
  }
}

function writeLocal(state: LocalState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode); the session still works in memory.
  }
}

const timestamp = (value: string | null) => (value ? Date.parse(value) || 0 : 0);

export interface CheckoutResult {
  ok: boolean;
  redirected: boolean;
  message?: string;
}

export interface Store {
  ready: boolean;
  brands: Brand[];
  settlements: Settlement[];
  selectedBrandIds: ReadonlySet<string>;
  selectedStates: ReadonlySet<string>;
  claims: Claim[];
  onboardingCompleted: boolean;
  session: Session | null;
  plan: Plan;
  planSource: PlanSource;
  isPremium: boolean;
  isSampleData: boolean;
  emailReminders: boolean;
  error: string | null;
  matched: Settlement[];
  unfiled: Settlement[];
  nearest: Settlement | null;
  potentialMax: number;
  waitingMax: number;
  paidTotal: number;
  brandById(id: string): Brand | undefined;
  settlementById(id: string): Settlement | undefined;
  claimFor(settlementId: string): Claim | undefined;
  toggleBrand(id: string): void;
  toggleState(code: string): void;
  completeOnboarding(): void;
  markFiled(settlement: Settlement, reference: string): Promise<void>;
  markPaid(claimId: string, amount: number): Promise<void>;
  refreshPlan(): Promise<Plan>;
  startCheckout(plan: "yearly" | "weekly", next: string): Promise<CheckoutResult>;
  openBillingPortal(): Promise<void>;
  setEmailReminders(on: boolean): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<boolean>;
  resetSample(): void;
  dismissError(): void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<LocalState>(readLocal);
  const [brands, setBrands] = useState<Brand[]>(SAMPLE_BRANDS);
  const [settlements, setSettlements] = useState<Settlement[]>(
    isSampleMode ? SAMPLE_SETTLEMENTS : [],
  );
  const [publicLoaded, setPublicLoaded] = useState(isSampleMode);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(isSampleMode);
  const [plan, setPlan] = useState<Plan>("free");
  const [planSource, setPlanSource] = useState<PlanSource>(null);
  const [emailReminders, setEmailRemindersState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);

  const localRef = useRef(local);
  localRef.current = local;
  const settlementsRef = useRef(settlements);
  settlementsRef.current = settlements;

  useEffect(() => writeLocal(local), [local]);

  // Public catalog: companies and verified settlements.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    (async () => {
      const [brandResult, settlementResult] = await Promise.all([
        client.from("brands").select("*").order("name"),
        client.from("settlements").select("*").eq("status", "verified").order("deadline"),
      ]);
      if (cancelled) return;
      if (brandResult.error || settlementResult.error) {
        setBrands(SAMPLE_BRANDS);
        setSettlements(SAMPLE_SETTLEMENTS);
        setError("Live settlements couldn’t be loaded. Showing clearly labeled sample data.");
      } else {
        if (brandResult.data.length > 0) setBrands(brandResult.data.map(brandFromRow));
        setSettlements(settlementResult.data.map(settlementFromRow));
      }
      setPublicLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auth session.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const pushClaims = useCallback(async (claims: Claim[], uid: string) => {
    const client = supabase;
    if (!client || claims.length === 0) return;
    const { error: upsertError } = await client
      .from("claims")
      .upsert(claims.map((claim) => claimToRow(claim, uid)), { onConflict: "user_id,settlement_id" });
    if (upsertError) throw upsertError;
  }, []);

  // Merge browser progress with the account (same rules as the iPhone app), then save back.
  const hydrate = useCallback(
    async (uid: string) => {
      const client = supabase;
      if (!client) return;
      const [profileResult, picksResult, claimsResult] = await Promise.all([
        client
          .from("profiles")
          .select("plan,plan_source,state_codes,email_reminders")
          .eq("user_id", uid)
          .maybeSingle(),
        client.from("profile_brands").select("brand_id").eq("user_id", uid),
        client.from("claims").select("*").eq("user_id", uid),
      ]);
      const failure = profileResult.error ?? picksResult.error ?? claimsResult.error;
      if (failure) throw failure;

      const current = localRef.current;
      const brandIds = new Set([
        ...current.brandIds,
        ...(picksResult.data ?? []).map((row) => String(row.brand_id)),
      ]);
      const states = new Set([
        ...current.states,
        ...((profileResult.data?.state_codes as string[] | null) ?? []),
      ]);

      const remoteClaims = (claimsResult.data ?? []).map(claimFromRow);
      const dirty = new Set(current.dirtyClaimIds);
      const merged = new Map(current.claims.map((claim) => [claim.settlementId, claim]));
      const remoteSettlementIds = new Set(remoteClaims.map((claim) => claim.settlementId));
      for (const claim of current.claims) {
        if (!remoteSettlementIds.has(claim.settlementId)) dirty.add(claim.id);
      }
      for (const remote of remoteClaims) {
        const mine = merged.get(remote.settlementId);
        if (!mine) {
          merged.set(remote.settlementId, remote);
        } else if (!dirty.has(mine.id)) {
          if (timestamp(mine.modifiedAt) > timestamp(remote.modifiedAt)) dirty.add(mine.id);
          else merged.set(remote.settlementId, remote);
        }
      }
      const claims = [...merged.values()];

      // Settlements that have since closed still need to show on tracked claims.
      const known = new Set(settlementsRef.current.map((s) => s.id));
      const missing = claims.map((claim) => claim.settlementId).filter((id) => !known.has(id));
      if (missing.length > 0) {
        const { data } = await client.from("settlements").select("*").in("id", missing);
        if (data && data.length > 0) {
          const extra = data.map(settlementFromRow);
          setSettlements((previous) => [
            ...previous,
            ...extra.filter((s) => !previous.some((p) => p.id === s.id)),
          ]);
        }
      }

      const [brandsSave, statesSave] = await Promise.all([
        client.rpc("replace_profile_brands", { p_brand_ids: [...brandIds] }),
        client.from("profiles").update({ state_codes: [...states].sort() }).eq("user_id", uid),
      ]);
      if (brandsSave.error || statesSave.error) throw brandsSave.error ?? statesSave.error;
      await pushClaims(claims.filter((claim) => dirty.has(claim.id)), uid);

      setLocal((previous) => ({
        ...previous,
        brandIds: [...brandIds],
        states: [...states],
        claims,
        dirtyClaimIds: [],
      }));
      setPlan((profileResult.data?.plan as Plan | undefined) ?? "free");
      setPlanSource((profileResult.data?.plan_source as PlanSource | undefined) ?? null);
      setEmailRemindersState(Boolean(profileResult.data?.email_reminders));
    },
    [pushClaims],
  );

  useEffect(() => {
    if (!userId) {
      setPlan("free");
      setPlanSource(null);
      setEmailRemindersState(false);
      setSyncedUserId(null);
      return;
    }
    let cancelled = false;
    hydrate(userId)
      .then(() => {
        if (!cancelled) setSyncedUserId(userId);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Your picks are saved in this browser. Cloud sync will retry when you reload.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, hydrate]);

  // Keep companies and states saved to the account as they change.
  useEffect(() => {
    const client = supabase;
    if (!client || !userId || syncedUserId !== userId) return;
    const timer = window.setTimeout(async () => {
      const [brandsSave, statesSave] = await Promise.all([
        client.rpc("replace_profile_brands", { p_brand_ids: local.brandIds }),
        client.from("profiles").update({ state_codes: [...local.states].sort() }).eq("user_id", userId),
      ]);
      if (brandsSave.error || statesSave.error) {
        setError("Couldn’t save your changes to your account. They’re kept in this browser.");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [local.brandIds, local.states, userId, syncedUserId]);

  const toggleBrand = useCallback((id: string) => {
    setLocal((previous) => ({
      ...previous,
      brandIds: previous.brandIds.includes(id)
        ? previous.brandIds.filter((value) => value !== id)
        : [...previous.brandIds, id],
    }));
  }, []);

  const toggleState = useCallback((code: string) => {
    setLocal((previous) => ({
      ...previous,
      states: previous.states.includes(code)
        ? previous.states.filter((value) => value !== code)
        : [...previous.states, code],
    }));
  }, []);

  const completeOnboarding = useCallback(() => {
    setLocal((previous) => ({ ...previous, onboardingCompleted: true }));
  }, []);

  const saveClaim = useCallback(
    async (claim: Claim) => {
      setLocal((previous) => ({
        ...previous,
        claims: [...previous.claims.filter((c) => c.settlementId !== claim.settlementId), claim],
      }));
      if (!userId) return;
      try {
        await pushClaims([claim], userId);
      } catch {
        setLocal((previous) => ({
          ...previous,
          dirtyClaimIds: [...new Set([...previous.dirtyClaimIds, claim.id])],
        }));
        setError("Your claim is saved in this browser and will sync later.");
      }
    },
    [userId, pushClaims],
  );

  const markFiled = useCallback(
    async (settlement: Settlement, reference: string) => {
      const existing = localRef.current.claims.find((c) => c.settlementId === settlement.id);
      if (existing?.status === "Paid") return;
      const now = new Date().toISOString();
      const cleanReference = reference.trim();
      await saveClaim({
        id: existing?.id ?? crypto.randomUUID(),
        settlementId: settlement.id,
        status: "Filed",
        claimRef: cleanReference || null,
        filedAt: now,
        paidAmount: null,
        paidAt: null,
        modifiedAt: now,
      });
    },
    [saveClaim],
  );

  const markPaid = useCallback(
    async (claimId: string, amount: number) => {
      const claim = localRef.current.claims.find((c) => c.id === claimId);
      if (!claim) return;
      const now = new Date().toISOString();
      await saveClaim({ ...claim, status: "Paid", paidAmount: amount, paidAt: now, modifiedAt: now });
    },
    [saveClaim],
  );

  const refreshPlan = useCallback(async (): Promise<Plan> => {
    const client = supabase;
    if (!client || !userId) return "free";
    const { data } = await client
      .from("profiles")
      .select("plan,plan_source")
      .eq("user_id", userId)
      .maybeSingle();
    const next = (data?.plan as Plan | undefined) ?? "free";
    setPlan(next);
    setPlanSource((data?.plan_source as PlanSource | undefined) ?? null);
    return next;
  }, [userId]);

  const startCheckout = useCallback(
    async (chosen: "yearly" | "weekly", next: string): Promise<CheckoutResult> => {
      const client = supabase;
      if (!client) {
        setLocal((previous) => ({ ...previous, sampleUnlocked: true }));
        return { ok: true, redirected: false };
      }
      const { data, error: invokeError } = await client.functions.invoke<{ url?: string }>(
        "stripe-checkout",
        { body: { plan: chosen, next } },
      );
      if (invokeError || !data?.url) {
        return {
          ok: false,
          redirected: false,
          message:
            "Checkout couldn’t start. If you already subscribed (on the web or iPhone), refresh this page.",
        };
      }
      window.location.assign(data.url);
      return { ok: true, redirected: true };
    },
    [],
  );

  const openBillingPortal = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    const { data, error: invokeError } = await client.functions.invoke<{ url?: string }>(
      "stripe-portal",
      { body: {} },
    );
    if (invokeError || !data?.url) {
      setError("Billing couldn’t open. If you subscribed on iPhone, manage it in Settings → Subscriptions.");
      return;
    }
    window.location.assign(data.url);
  }, []);

  const setEmailReminders = useCallback(
    async (on: boolean) => {
      const client = supabase;
      if (!client || !userId) return;
      setEmailRemindersState(on);
      const { error: updateError } = await client
        .from("profiles")
        .update({ email_reminders: on })
        .eq("user_id", userId);
      if (updateError) {
        setEmailRemindersState(!on);
        setError("Email reminders couldn’t be updated. Please try again.");
      }
    },
    [userId],
  );

  const resetAll = useCallback(() => {
    setLocal(EMPTY_LOCAL);
    setPlan("free");
    setPlanSource(null);
    setEmailRemindersState(false);
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    resetAll();
  }, [resetAll]);

  const deleteAccount = useCallback(async () => {
    const client = supabase;
    if (client && userId) {
      const { data, error: invokeError } = await client.functions.invoke<{ deleted?: boolean }>(
        "delete-account",
        { body: {} },
      );
      if (invokeError || !data?.deleted) {
        setError("We couldn’t delete your account. Please email support@rightful.app.");
        return false;
      }
      await client.auth.signOut();
    }
    resetAll();
    return true;
  }, [userId, resetAll]);

  const value = useMemo<Store>(() => {
    const selectedBrandIds = new Set(local.brandIds);
    const selectedStates = new Set(local.states);
    const matched = matchSettlements(settlements, selectedBrandIds, selectedStates);
    const claimBySettlement = new Map(local.claims.map((claim) => [claim.settlementId, claim]));
    const unfiled = matched.filter((settlement) => {
      const status = claimBySettlement.get(settlement.id)?.status;
      return !status || status === "To file" || status === "Rejected";
    });
    const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
    const settlementMap = new Map(settlements.map((settlement) => [settlement.id, settlement]));

    return {
      ready: publicLoaded && authReady,
      brands,
      settlements,
      selectedBrandIds,
      selectedStates,
      claims: local.claims,
      onboardingCompleted: local.onboardingCompleted,
      session,
      plan,
      planSource,
      isPremium: plan !== "free" || (isSampleMode && local.sampleUnlocked),
      isSampleData: isSampleMode || settlements.some((settlement) => settlement.isSample),
      emailReminders,
      error,
      matched,
      unfiled,
      nearest: unfiled[0] ?? null,
      potentialMax: matched.reduce((total, s) => total + s.payoutMax, 0),
      waitingMax: matched
        .filter((s) => claimBySettlement.get(s.id)?.status !== "Paid")
        .reduce((total, s) => total + s.payoutMax, 0),
      paidTotal: local.claims.reduce((total, claim) => total + (claim.paidAmount ?? 0), 0),
      brandById: (id) => brandMap.get(id),
      settlementById: (id) => settlementMap.get(id),
      claimFor: (settlementId) => claimBySettlement.get(settlementId),
      toggleBrand,
      toggleState,
      completeOnboarding,
      markFiled,
      markPaid,
      refreshPlan,
      startCheckout,
      openBillingPortal,
      setEmailReminders,
      signOut,
      deleteAccount,
      resetSample: resetAll,
      dismissError: () => setError(null),
    };
  }, [
    local,
    brands,
    settlements,
    publicLoaded,
    authReady,
    session,
    plan,
    planSource,
    emailReminders,
    error,
    toggleBrand,
    toggleState,
    completeOnboarding,
    markFiled,
    markPaid,
    refreshPlan,
    startCheckout,
    openBillingPortal,
    setEmailReminders,
    signOut,
    deleteAccount,
    resetAll,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}
