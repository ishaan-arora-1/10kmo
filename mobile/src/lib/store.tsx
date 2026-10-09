import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { randomUUID } from "expo-crypto";
import { AppState } from "react-native";
import {
  brandEstimates,
  brandFromRow,
  type BrandEstimate,
  claimFromRow,
  claimToRow,
  matchSettlements,
  featuredSettlements,
  isUpcoming,
  missedPayouts,
  maxTotal,
  payoutHistory,
  type PayoutHistory,
  recentPayoutFromRow,
  settlementFromRow,
  type RecentPayout,
  type Brand,
  type Claim,
  type Plan,
  type PlanSource,
  type Settlement,
  withParentBrands,
} from "./models";
import { track } from "./analytics";
import { useCheckout } from "./checkout";
import { SUPPORT_EMAIL, type WebPlan } from "./config";
import { SAMPLE_BRANDS, SAMPLE_SETTLEMENTS } from "./sample";
import { isSampleMode, supabase } from "./supabase";

const STORAGE_KEY = "rightful.app.v1";

/** Everything someone does before signing in lives on the device, like on the website. */
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
    // Storage can fail (disk full); the session still works in memory.
  }
}

const timestamp = (value: string | null) => (value ? Date.parse(value) || 0 : 0);

/** An account's plan as loaded from its profile. */
interface PlanState {
  userId: string | null;
  plan: Plan;
  source: PlanSource;
  renews: boolean | null;
  expiresAt: string | null;
  emailReminders: boolean;
}

const NO_PLAN: PlanState = {
  userId: null,
  plan: "free",
  source: null,
  renews: null,
  expiresAt: null,
  emailReminders: false,
};

type ProfileRow = Record<string, unknown> | null | undefined;

function planFromProfile(userId: string, row: ProfileRow, emailReminders: boolean): PlanState {
  return {
    userId,
    plan: (row?.plan as Plan | undefined) ?? "free",
    source: (row?.plan_source as PlanSource | undefined) ?? null,
    renews: (row?.plan_renews as boolean | null | undefined) ?? null,
    expiresAt: (row?.plan_expires_at as string | null | undefined) ?? null,
    emailReminders,
  };
}

export interface CheckoutResult {
  ok: boolean;
  cancelled?: boolean;
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
  /** Web plans only: false once canceled (access continues until planExpiresAt). */
  planRenews: boolean | null;
  planExpiresAt: string | null;
  isPremium: boolean;
  isSampleData: boolean;
  emailReminders: boolean;
  error: string | null;
  matched: Settlement[];
  /** Open to everyone, whatever companies they picked. */
  featured: Settlement[];
  /** Everything they can act on: their own unfiled matches, then unfiled claims open to everyone. */
  toFile: Settlement[];
  /** The most the open-to-everyone claims pay, added up (unpaid ones). */
  featuredMax: number;
  unfiled: Settlement[];
  nearest: Settlement | null;
  /** The most the matched settlements pay, added up. */
  potentialMax: number;
  waitingMax: number;
  /** Picked companies with nothing open but a sourced "up to" figure (pending case or past payout). */
  estimates: { brand: Brand; estimate: BrandEstimate }[];
  estimateMax: number;
  paidTotal: number;
  /** Free accounts get one claim to file without paying; true until they start it. */
  freeClaimAvailable: boolean;
  /** Members file anything; free accounts their free claim (any claim they've started or filed). */
  canFile(settlement: Settlement): boolean;
  /** Real past payouts to show instead of $0 (see payoutHistory). */
  history: PayoutHistory;
  /** The biggest payouts anyone got this past year, for social proof whatever they picked. */
  peoplePaid: PayoutHistory;
  /** Every past payout for the chosen companies (dashboard "You missed"). */
  missed: RecentPayout[];
  brandById(id: string): Brand | undefined;
  settlementById(id: string): Settlement | undefined;
  claimFor(settlementId: string): Claim | undefined;
  toggleBrand(id: string): void;
  toggleState(code: string): void;
  completeOnboarding(): void;
  markFiled(settlement: Settlement, reference: string): Promise<void>;
  /** Uses the free claim on this settlement: saves it as "To file" so it stays unlocked. */
  startFreeClaim(settlement: Settlement): Promise<void>;
  markPaid(claimId: string, amount: number): Promise<void>;
  refreshPlan(): Promise<Plan>;
  startCheckout(plan: WebPlan): Promise<CheckoutResult>;
  /** Returns when access ends ("" if it ended now), or null if cancellation failed. */
  cancelSubscription(): Promise<string | null>;
  setEmailReminders(on: boolean): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<boolean>;
  resetSample(): void;
  dismissError(): void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const openCheckout = useCheckout();
  const [local, setLocal] = useState<LocalState>(readLocal);
  const [brands, setBrands] = useState<Brand[]>(SAMPLE_BRANDS);
  const [settlements, setSettlements] = useState<Settlement[]>(
    isSampleMode ? SAMPLE_SETTLEMENTS : [],
  );
  const [recentPayouts, setRecentPayouts] = useState<RecentPayout[]>([]);
  const [publicLoaded, setPublicLoaded] = useState(isSampleMode);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(isSampleMode);
  const [planState, setPlanState] = useState<PlanState>(NO_PLAN);
  const [error, setError] = useState<string | null>(null);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  /** The account whose plan has been loaded, so members aren't sent to onboarding before it arrives. */
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const localRef = useRef(local);
  const settlementsRef = useRef(settlements);
  useLayoutEffect(() => {
    localRef.current = local;
    settlementsRef.current = settlements;
  }, [local, settlements]);

  useEffect(() => writeLocal(local), [local]);

  // Public catalog: companies and verified settlements.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    (async () => {
      const [brandResult, settlementResult, recentResult] = await Promise.all([
        client.from("brands").select("*").order("name"),
        client.from("settlements").select("*").eq("status", "verified").order("deadline"),
        client.from("recent_payouts").select("*"),
      ]);
      if (cancelled) return;
      if (!recentResult.error) setRecentPayouts(recentResult.data.map(recentPayoutFromRow));
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
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Signed out: nothing is synced until the next account's data has been merged.
      if (!next) setSyncedUserId(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  // A plan only counts for the account it was loaded for, so signing out drops it at once.
  const { plan, source: planSource, renews: planRenews, expiresAt: planExpiresAt, emailReminders } =
    userId && planState.userId === userId ? planState : NO_PLAN;

  const pushClaims = useCallback(async (claims: Claim[], uid: string) => {
    const client = supabase;
    if (!client || claims.length === 0) return;
    const { error: upsertError } = await client
      .from("claims")
      .upsert(claims.map((claim) => claimToRow(claim, uid)), { onConflict: "user_id,settlement_id" });
    if (upsertError) throw upsertError;
  }, []);

  // Merge device progress with the account (same rules as the website), then save back.
  const hydrate = useCallback(
    async (uid: string) => {
      const client = supabase;
      if (!client) return;
      const [profileResult, picksResult, claimsResult] = await Promise.all([
        client
          .from("profiles")
          .select("plan,plan_source,plan_renews,plan_expires_at,state_codes,email_reminders")
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
      setPlanState(planFromProfile(uid, profileResult.data, Boolean(profileResult.data?.email_reminders)));
    },
    [pushClaims],
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    hydrate(userId)
      .then(() => {
        if (!cancelled) setSyncedUserId(userId);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Your picks are saved on this device. Cloud sync will retry next time you open the app.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedUserId(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, hydrate]);

  // Keep companies and states saved to the account as they change.
  useEffect(() => {
    const client = supabase;
    if (!client || !userId || syncedUserId !== userId) return;
    const timer = setTimeout(async () => {
      const [brandsSave, statesSave] = await Promise.all([
        client.rpc("replace_profile_brands", { p_brand_ids: local.brandIds }),
        client.from("profiles").update({ state_codes: [...local.states].sort() }).eq("user_id", userId),
      ]);
      if (brandsSave.error || statesSave.error) {
        setError("Couldn’t save your changes to your account. They’re kept on this device.");
      }
    }, 700);
    return () => clearTimeout(timer);
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
        setError("Your claim is saved on this device and will sync later.");
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
        id: existing?.id ?? randomUUID(),
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

  const startFreeClaim = useCallback(
    async (settlement: Settlement) => {
      if (localRef.current.claims.some((c) => c.settlementId === settlement.id)) return;
      await saveClaim({
        id: randomUUID(),
        settlementId: settlement.id,
        status: "To file",
        claimRef: null,
        filedAt: null,
        paidAmount: null,
        paidAt: null,
        modifiedAt: new Date().toISOString(),
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
      .select("plan,plan_source,plan_renews,plan_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    const next = planFromProfile(userId, data, false);
    setPlanState((previous) => ({
      ...next,
      emailReminders: previous.userId === userId ? previous.emailReminders : false,
    }));
    return next.plan;
  }, [userId]);

  const startCheckout = useCallback(
    async (chosen: WebPlan): Promise<CheckoutResult> => {
      const client = supabase;
      if (!client) {
        setLocal((previous) => ({ ...previous, sampleUnlocked: true }));
        return { ok: true };
      }

      const userId = session?.user.id ?? null;
      track("checkout_opened", { plan: chosen, userId });
      const { data, error: invokeError } = await client.functions.invoke<{
        subscription_id?: string;
        key_id?: string;
        email?: string | null;
        name?: string | null;
      }>("razorpay-subscribe", { body: { plan: chosen } });
      const subscriptionId = data?.subscription_id;
      const keyId = data?.key_id;
      if (invokeError || !subscriptionId || !keyId) {
        track("checkout_failed", { plan: chosen, userId, detail: "subscribe_failed" });
        // Already a member (for example, subscribed on the website): pick the plan up instead.
        if ((await refreshPlan()) !== "free") return { ok: true };
        return {
          ok: false,
          message: "Checkout couldn’t start. Check your connection and try again.",
        };
      }

      // Same Razorpay Checkout as the website.
      const outcome = await openCheckout(
        {
          key: keyId,
          subscription_id: subscriptionId,
          name: "Rightful",
          description: chosen === "yearly" ? "Rightful Premium · Yearly" : "Rightful Premium · Monthly",
          prefill: { email: data?.email ?? undefined, name: data?.name ?? undefined },
          theme: { color: "#0E7A4B" },
        },
        (failure) => track("checkout_failed", { plan: chosen, userId, detail: failure }),
      );

      if (outcome.type === "load_failed") {
        track("checkout_failed", { plan: chosen, userId, detail: "script_blocked" });
        return {
          ok: false,
          message: "The payment window couldn’t load. Check your connection, then try again.",
        };
      }
      if (outcome.type === "dismissed") {
        track("checkout_dismissed", { plan: chosen, userId, detail: outcome.failure ?? "closed" });
        return outcome.failure ? { ok: false, message: outcome.failure } : { ok: false, cancelled: true };
      }

      const { data: verified, error: verifyError } = await client.functions.invoke<{
        verified?: boolean;
      }>("razorpay-verify", { body: outcome.response });
      if (verifyError || !verified?.verified) {
        return {
          ok: false,
          message: "Payment received but not confirmed yet. Reopen the app in a minute and filing will unlock automatically.",
        };
      }
      await refreshPlan();
      track("checkout_paid", { plan: chosen, userId });
      return { ok: true };
    },
    [refreshPlan, session, openCheckout],
  );

  // A payment confirmed by webhook, or a plan bought on the website, shows up when the app comes back.
  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPlan();
    });
    return () => subscription.remove();
  }, [userId, refreshPlan]);

  const cancelSubscription = useCallback(async (): Promise<string | null> => {
    const client = supabase;
    if (!client) return null;
    const { data, error: invokeError } = await client.functions.invoke<{
      cancelled?: boolean;
      accessUntil?: string | null;
    }>("razorpay-cancel", { body: {} });
    if (invokeError || !data?.cancelled) {
      setError(`Your subscription couldn’t be canceled. Please try again or email ${SUPPORT_EMAIL}.`);
      return null;
    }
    await refreshPlan();
    return data.accessUntil ?? "";
  }, [refreshPlan]);

  const setEmailReminders = useCallback(
    async (on: boolean) => {
      const client = supabase;
      if (!client || !userId) return;
      const setReminders = (value: boolean) =>
        setPlanState((previous) => (previous.userId === userId ? { ...previous, emailReminders: value } : previous));
      setReminders(on);
      const { error: updateError } = await client
        .from("profiles")
        .update({ email_reminders: on })
        .eq("user_id", userId);
      if (updateError) {
        setReminders(!on);
        setError("Email reminders couldn’t be updated. Please try again.");
      }
    },
    [userId],
  );

  const resetAll = useCallback(() => {
    setLocal(EMPTY_LOCAL);
    setPlanState(NO_PLAN);
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
        const status = (invokeError as { context?: { status?: number } } | null)?.context?.status;
        track("account_delete_failed", {
          userId,
          detail: [invokeError?.name ?? "no_confirmation", status].filter(Boolean).join(" "),
        });
        setError(`We couldn’t delete your account. Please email ${SUPPORT_EMAIL}.`);
        return false;
      }
      track("account_deleted");
      // The account is already gone on the server, so only this device's session is left to clear.
      await client.auth.signOut({ scope: "local" });
    }
    resetAll();
    return true;
  }, [userId, resetAll]);

  const value = useMemo<Store>(() => {
    const selectedBrandIds = new Set(local.brandIds);
    const selectedStates = new Set(local.states);
    // A Gmail pick also matches Google's settlements and payouts.
    const matchBrandIds = withParentBrands(selectedBrandIds, brands);
    const matched = matchSettlements(settlements, matchBrandIds, selectedStates);
    const claimBySettlement = new Map(local.claims.map((claim) => [claim.settlementId, claim]));
    const notFiled = (settlement: Settlement) => {
      const status = claimBySettlement.get(settlement.id)?.status;
      return !status || status === "To file" || status === "Rejected";
    };
    const unfiled = matched.filter(notFiled);
    const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
    const history = payoutHistory(recentPayouts, matchBrandIds);
    const estimates = brandEstimates(brands, matchBrandIds, matched);
    const settlementMap = new Map(settlements.map((settlement) => [settlement.id, settlement]));
    const featured = featuredSettlements(settlements, matched);
    const toFile = [...unfiled, ...featured.filter(notFiled)];
    const isPremium = plan !== "free" || (isSampleMode && local.sampleUnlocked);

    return {
      ready: publicLoaded && authReady && (!userId || loadedUserId === userId),
      brands,
      settlements,
      selectedBrandIds,
      selectedStates,
      claims: local.claims,
      onboardingCompleted: local.onboardingCompleted,
      session,
      plan,
      planSource,
      planRenews,
      planExpiresAt,
      isPremium,
      isSampleData: isSampleMode || settlements.some((settlement) => settlement.isSample),
      emailReminders,
      error,
      matched,
      featured,
      toFile,
      featuredMax: maxTotal(featured.filter((s) => claimBySettlement.get(s.id)?.status !== "Paid")),
      unfiled,
      nearest:
        toFile.filter((s) => !isUpcoming(s)).sort((a, b) => a.deadline.localeCompare(b.deadline))[0] ?? null,
      potentialMax: maxTotal(matched),
      waitingMax: maxTotal(
        matched.filter((s) => claimBySettlement.get(s.id)?.status !== "Paid"),
      ),
      estimates,
      estimateMax: estimates.reduce((total, { estimate }) => total + estimate.amount, 0),
      paidTotal: local.claims.reduce((total, claim) => total + (claim.paidAmount ?? 0), 0),
      freeClaimAvailable: !isPremium && local.claims.length === 0,
      canFile: (settlement) => isPremium || local.claims.length === 0 || claimBySettlement.has(settlement.id),
      history,
      peoplePaid: payoutHistory(recentPayouts, new Set()),
      missed: missedPayouts(recentPayouts, matchBrandIds),
      brandById: (id) => brandMap.get(id),
      settlementById: (id) => settlementMap.get(id),
      claimFor: (settlementId) => claimBySettlement.get(settlementId),
      toggleBrand,
      toggleState,
      completeOnboarding,
      markFiled,
      startFreeClaim,
      markPaid,
      refreshPlan,
      startCheckout,
      cancelSubscription,
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
    recentPayouts,
    publicLoaded,
    loadedUserId,
    userId,
    authReady,
    session,
    plan,
    planSource,
    planRenews,
    planExpiresAt,
    emailReminders,
    error,
    toggleBrand,
    toggleState,
    completeOnboarding,
    markFiled,
    startFreeClaim,
    markPaid,
    refreshPlan,
    startCheckout,
    cancelSubscription,
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
