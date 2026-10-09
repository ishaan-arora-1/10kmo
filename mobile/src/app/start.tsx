import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { BrandPicker, BrandTile, TileGrid, useGridColumns } from "@/components/BrandPicker";
import { EmailCodeForm } from "@/components/EmailCodeForm";
import {
  Button,
  Eyebrow,
  FinePrint,
  FlowTitle,
  MonoNote,
  Muted,
  QuietButton,
  SampleBadge,
  SubTitle,
  Txt,
} from "@/components/primitives";
import { FlowScreen, Stack } from "@/components/screens";
import {
  CardAction,
  CardNote,
  CardRow,
  CardTop,
  historyHeadline,
  Monogram,
  MoneyCheck,
  PayoutHistoryCard,
  SettlementCard,
} from "@/components/ui";
import { clientKind, track } from "@/lib/analytics";
import { IAP_AVAILABLE } from "@/lib/iap";
import {
  ALSO_USED_COMPANIES,
  cappedTotal,
  isOpen,
  LIFE_EVENT_OPTIONS,
  matchSettlements,
  maxTotal,
  payoutRange,
  pendingCaseFor,
  plural,
  PROOF_OPTIONS,
  reminderSchedule,
  shortDay,
  sortBrandsForPicker,
  WATCHED_BRAND_NAMES,
  type Brand,
  type PendingCase,
  type Settlement,
} from "@/lib/models";
import { goTo } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { isSampleMode } from "@/lib/supabase";
import { useColors } from "@/theme";

type Stage = "brands" | "scanning" | "questions" | "results" | "reminders";

export default function Onboarding() {
  const [stage, setStage] = useState<Stage>("brands");
  // Stable callbacks: the scan's timer and the questions' skip check depend on them.
  const go = useMemo(
    () => ({
      brands: () => setStage("brands"),
      scanning: () => setStage("scanning"),
      questions: () => setStage("questions"),
      results: () => setStage("results"),
      reminders: () => setStage("reminders"),
    }),
    [],
  );

  return (
    <>
      {stage === "brands" && <PickStep onContinue={go.scanning} />}
      {stage === "scanning" && <ScanStep onDone={go.questions} />}
      {stage === "questions" && <QuestionsStep onDone={go.results} />}
      {stage === "results" && <ResultsStep onPickMore={go.brands} onReminders={go.reminders} />}
      {stage === "reminders" && <RemindersStep onBack={go.results} />}
    </>
  );
}

function PickStep({ onContinue }: { onContinue: () => void }) {
  const { brands, selectedBrandIds, session, toggleBrand } = useStore();
  const router = useRouter();
  const count = selectedBrandIds.size;

  // Links like claimrightful://start?brand=Netflix start with that company picked, like the website.
  const { brand: brandParam } = useLocalSearchParams<{ brand?: string }>();
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !brandParam) return;
    preselected.current = true;
    const brand = brands.find((b) => b.name.toLowerCase() === brandParam.toLowerCase());
    if (brand && !selectedBrandIds.has(brand.id)) toggleBrand(brand.id);
  }, [brandParam, brands, selectedBrandIds, toggleBrand]);

  return (
    <FlowScreen
      footer={
        <>
          <MonoNote>
            {count} {plural(count, "company", "companies")} selected
          </MonoNote>
          <Button onPress={onContinue} disabled={count === 0}>
            Check open settlements
          </Button>
        </>
      }
    >
      <Eyebrow>Step 1 · 30 seconds</Eyebrow>
      <FlowTitle>Which of these have you used?</FlowTitle>
      <Muted>Any US account since 2015 counts. No bank or email logins, ever.</Muted>
      <BrandPicker />
      {session ? (
        <Muted center>
          <Txt color="ink" style={styles.link} onPress={() => goTo("/")} accessibilityRole="link">
            Go to my dashboard
          </Txt>
        </Muted>
      ) : (
        !isSampleMode && (
          <Muted center>
            Already have an account?{" "}
            <Txt color="ink" style={styles.link} onPress={() => router.push("/sign-in")} accessibilityRole="link">
              Sign in
            </Txt>
          </Muted>
        )
      )}
    </FlowScreen>
  );
}

function ScanStep({ onDone }: { onDone: () => void }) {
  const c = useColors();
  const { settlements, matched, selectedBrandIds } = useStore();
  const [progress, setProgress] = useState(0.04);

  useEffect(() => {
    track("brands_picked", { detail: `${selectedBrandIds.size} companies` });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        timer = setTimeout(onDone, 400);
        return;
      }
      let step = 0;
      interval = setInterval(() => {
        step += 1;
        setProgress(step / 24);
        if (step >= 24) {
          clearInterval(interval);
          timer = setTimeout(onDone, 250);
        }
      }, 70);
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onDone]);

  const checked = Math.round(progress * settlements.length);
  const ring = 164;
  const stroke = 10;
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <FlowScreen bodyStyle={{ alignItems: "center", paddingTop: 48 }}>
      <View style={{ width: ring, height: ring }} accessibilityLiveRegion="polite">
        <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
          <Circle cx={ring / 2} cy={ring / 2} r={radius} stroke={c.line} strokeWidth={stroke} fill="none" />
          <Circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            stroke={c.money}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Txt f="display" w={700} size={42} lh={1}>
            {checked}
          </Txt>
          <Txt f="mono" size={12} color="muted">
            of {settlements.length}
          </Txt>
        </View>
      </View>
      <FlowTitle center>Checking open settlements</FlowTitle>
      <Muted center>Matching happens right here on your phone.</Muted>
      <View style={{ width: "100%", maxWidth: 420 }}>
        {matched.slice(0, 4).map((settlement) => (
          <View key={settlement.id} style={[styles.scanRow, { borderBottomColor: c.line }]}>
            <Txt style={{ flex: 1 }}>
              {settlement.company} · {settlement.title}
            </Txt>
            <Txt f="mono" w={700} size={12} color="money">
              Match
            </Txt>
          </View>
        ))}
      </View>
    </FlowScreen>
  );
}

function ResultsStep({ onPickMore, onReminders }: { onPickMore: () => void; onReminders: () => void }) {
  const store = useStore();
  const router = useRouter();
  useEffect(() => {
    track("results_seen", { detail: `${store.matched.length} matches` });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = store.matched;
  // Their matches plus the claims open to everyone: the same claims and total as the dashboard.
  const claimable = [...matches, ...store.featured];
  const noProof = claimable.filter((s) => !s.proofRequired).length;
  const upTo = store.potentialMax + store.estimateMax + store.featuredMax;

  const startClaiming = () => {
    if (store.isPremium || store.session) router.push("/welcome");
    else onReminders();
  };

  if (matches.length === 0) {
    return <NoMatches onPickMore={onPickMore} onContinue={startClaiming} />;
  }

  return (
    <FlowScreen footer={<Button onPress={startClaiming}>Start claiming</Button>}>
      <Eyebrow>Good news</Eyebrow>
      <FlowTitle>
        You may qualify for {claimable.length} {plural(claimable.length, "settlement", "settlements")}
      </FlowTitle>
      {matches.every((s) => s.isSample) && <SampleBadge />}
      <MoneyCheck
        number={String(claimable.length).padStart(4, "0")}
        // Never "Varies": add pending/past figures, else show what settlements paid people this year.
        payee={upTo > 0 ? "You" : "People like you"}
        amountLabel={upTo > 0 ? "Up to" : "Paid this past year"}
        amount={upTo > 0 ? upTo : store.history.total}
        capped
        memo={`${claimable.length} ${plural(claimable.length, "settlement", "settlements")} · ${noProof} need no proof`}
        footer={`‖ ${store.settlements.length} CHECKED ‖ ${claimable.length} MATCHED`}
      />
      <Stack>
        {matches.slice(0, 3).map((settlement) => (
          <Pressable key={settlement.id} onPress={startClaiming} accessibilityRole="button">
            <SettlementCard settlement={settlement} />
          </Pressable>
        ))}
      </Stack>
      {matches.length > 3 && (
        <Txt w={700} color="muted" center>
          + {matches.length - 3} more {plural(matches.length - 3, "match", "matches")}
        </Txt>
      )}
      <EstimatedPayouts onSelect={startClaiming} />
      <PendingCases onSelect={startClaiming} />
      <FeaturedSettlements onSelect={startClaiming} />
      <FinePrint>
        Amounts are the most each settlement pays, from court filings. Most people get less, and final amounts depend
        on how many people claim and what you can document.
        {matches.some((s) => s.isSample) && " Sample records are labeled and are not live claims."}
      </FinePrint>
      {store.history.total > 0 && (
        <>
          <SubTitle style={{ marginTop: 8 }}>{historyHeadline(store.history)}</SubTitle>
          <PayoutHistoryCard history={store.history} />
        </>
      )}
    </FlowScreen>
  );
}

/** No open match: show what they missed, suggest more companies, then continue to membership. */
function NoMatches({ onPickMore, onContinue }: { onPickMore: () => void; onContinue: () => void }) {
  const { brands, settlements, selectedBrandIds, toggleBrand, history, estimates, estimateMax, featured, featuredMax } =
    useStore();
  const { tileWidth } = useGridColumns();
  const upTo = estimateMax + featuredMax;
  const open = settlements.filter(isOpen);
  const openBrandIds = new Set(open.map((settlement) => settlement.brandId));
  const topPayout = (brandId: string) =>
    Math.max(0, ...open.filter((s) => s.brandId === brandId).map((s) => s.payoutMax));
  const suggestions = sortBrandsForPicker(
    brands.filter((brand) => openBrandIds.has(brand.id) && !selectedBrandIds.has(brand.id)),
    openBrandIds,
  )
    .sort((a, b) => topPayout(b.id) - topPayout(a.id))
    .slice(0, 12);

  return (
    <FlowScreen
      footer={
        <>
          <Button onPress={onContinue}>Continue</Button>
          <QuietButton onPress={onPickMore}>Search all companies</QuietButton>
        </>
      }
    >
      <Eyebrow>Scan complete</Eyebrow>
      {upTo > 0 ? (
        <>
          <FlowTitle>You may qualify for up to {cappedTotal(upTo)}</FlowTitle>
          <Muted>
            {featured.length > 0
              ? `${featured.length} ${plural(featured.length, "claim", "claims")} most people qualify for ${plural(featured.length, "is", "are")} open now.`
              : "Nothing to claim today."}
            {estimates.length > 0 &&
              ` We’ll email you the day ${estimates.length === 1 ? "yours opens" : "each of yours opens"}.`}
          </Muted>
          <MoneyCheck
            number={String(estimates.length + featured.length).padStart(4, "0")}
            payee="You"
            amountLabel="Up to"
            amount={upTo}
            capped
            memo={[
              ...estimates.map(({ brand, estimate }) => `${brand.name}: ${estimate.label.toLowerCase()}`),
              featured.length > 0 && `${featured.length} open to most people`,
            ]
              .filter(Boolean)
              .join(" · ")}
            footer={`‖ ${settlements.length} CHECKED ‖ ${estimates.length + featured.length} FOR YOU`}
          />
          <FeaturedSettlements onSelect={onContinue} />
          <EstimatedPayouts onSelect={onContinue} />
          <PendingCases onSelect={onContinue} />
          {history.total > 0 && (
            <>
              <SubTitle style={{ marginTop: 8 }}>{historyHeadline(history)}</SubTitle>
              <PayoutHistoryCard history={history} />
            </>
          )}
        </>
      ) : (
        <>
          <FlowTitle>{historyHeadline(history)}</FlowTitle>
          <Muted>None of the companies you picked has a settlement open right now.</Muted>
          <PayoutHistoryCard history={history} />
          <PendingCases onSelect={onContinue} />
          <FeaturedSettlements onSelect={onContinue} />
        </>
      )}
      <SubTitle style={{ marginTop: 8 }}>Add more options</SubTitle>
      <TileGrid>
        {suggestions.map((brand) => (
          <BrandTile
            key={brand.id}
            brand={brand}
            selected={false}
            open={false}
            pending={false}
            width={tileWidth}
            onToggle={toggleBrand}
          />
        ))}
      </TileGrid>
    </FlowScreen>
  );
}

/** Picked companies with a lawsuit still in court: nothing to claim yet, members get emailed when it opens. */
function PendingCases({ onSelect }: { onSelect: () => void }) {
  const { brands, selectedBrandIds, matched } = useStore();
  // Once a company's settlement is open it shows as a match instead.
  const openBrandIds = new Set(matched.map((settlement) => settlement.brandId));
  const pending = brands
    .filter((brand) => selectedBrandIds.has(brand.id) && !openBrandIds.has(brand.id))
    .flatMap((brand) => {
      const pendingCase = pendingCaseFor(brand);
      return pendingCase ? [{ brand, pendingCase }] : [];
    });
  const names = pending.map(({ brand }) => brand.name).join(",");
  useEffect(() => {
    if (names) track("pending_case_seen", { detail: names });
  }, [names]);
  if (pending.length === 0) return null;
  return (
    <>
      <SubTitle style={{ marginTop: 8 }}>Coming up for you</SubTitle>
      <Stack>
        {pending.map(({ brand, pendingCase }) => (
          <PendingCaseCard key={brand.id} brand={brand} pendingCase={pendingCase} onSelect={onSelect} />
        ))}
      </Stack>
    </>
  );
}

function PendingCaseCard({
  brand,
  pendingCase,
  onSelect,
}: {
  brand: Brand;
  pendingCase: PendingCase;
  onSelect: () => void;
}) {
  const { isPremium, estimates } = useStore();
  const estimate = estimates.find((e) => e.brand.id === brand.id)?.estimate;
  return (
    <Pressable onPress={onSelect} accessibilityRole="button">
      <CardRow brand={brand} name={brand.name}>
        <CardTop
          title={`${brand.name} · ${pendingCase.title}`}
          amount={estimate ? `Up to ${cappedTotal(estimate.amount)}` : <CasePending />}
        />
        {estimate && <CasePending />}
        <CardNote>{pendingCase.summary}</CardNote>
        <CardAction>
          {isPremium
            ? "As a member, you’ll get an email the day claims open."
            : "Get a Rightful plan and we’ll email you the day claims open."}
        </CardAction>
      </CardRow>
    </Pressable>
  );
}

function CasePending() {
  const c = useColors();
  return (
    <View style={[styles.casePending, { backgroundColor: c.deadlineSoft }]}>
      <Txt f="mono" w={500} size={11} upper lh={1.3} color="deadline">
        Case pending
      </Txt>
    </View>
  );
}

/** Picked companies with nothing open: their sourced "up to" figure. Pending cases show in PendingCases instead. */
function EstimatedPayouts({ onSelect }: { onSelect: () => void }) {
  const { estimates, isPremium } = useStore();
  const shown = estimates.filter(({ brand }) => !pendingCaseFor(brand));
  if (shown.length === 0) return null;
  return (
    <>
      <SubTitle style={{ marginTop: 8 }}>What your companies have paid</SubTitle>
      <Stack>
        {shown.map(({ brand, estimate }) => (
          <Pressable key={brand.id} onPress={onSelect} accessibilityRole="button">
            <CardRow brand={brand} name={brand.name}>
              <CardTop title={`${brand.name} · ${estimate.label}`} amount={`Up to ${cappedTotal(estimate.amount)}`} />
              <CardNote>{estimate.note}</CardNote>
              <CardAction>
                {isPremium
                  ? "As a member, you’ll get an email the day a new one opens."
                  : "Get a Rightful plan and we’ll email you the day a new one opens."}
              </CardAction>
            </CardRow>
          </Pressable>
        ))}
      </Stack>
    </>
  );
}

/** Big settlements anyone in the US may qualify for, shown whatever they picked. */
function FeaturedSettlements({ onSelect }: { onSelect: () => void }) {
  const { featured } = useStore();
  if (featured.length === 0) return null;
  return (
    <>
      <SubTitle style={{ marginTop: 8 }}>Open to everyone in the US</SubTitle>
      <Stack>
        {featured.map((settlement) => (
          <Pressable key={settlement.id} onPress={onSelect} accessibilityRole="button">
            <SettlementCard settlement={settlement} />
          </Pressable>
        ))}
      </Stack>
    </>
  );
}

type QuestionId = "life" | "also" | "proof";

/**
 * Three quick questions between the scan and the results. Answers can only add matches
 * (questions 1 and 2) or change the encouragement (question 3); they never lower the total.
 */
function QuestionsStep({ onDone }: { onDone: () => void }) {
  const { brands, settlements, matched, selectedBrandIds, selectedStates, toggleBrand } = useStore();
  const [question, setQuestion] = useState<QuestionId>("life");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const open = settlements.filter(isOpen);
  const matchedIds = new Set(matched.map((settlement) => settlement.id));
  const brandIdsFor = (companies: string[]) =>
    new Set(open.filter((s) => companies.includes(s.company)).map((s) => s.brandId));

  const lifeOptions = LIFE_EVENT_OPTIONS.filter((option) =>
    [...brandIdsFor(option.companies)].some((id) => !selectedBrandIds.has(id)),
  );
  const alsoOptions = ALSO_USED_COMPANIES.flatMap((company) => {
    const offers = open.filter((s) => s.company === company && !selectedBrandIds.has(s.brandId));
    const best = offers.sort((a, b) => b.payoutMax - a.payoutMax)[0];
    return best ? [best] : [];
  });
  const proofOptions = PROOF_OPTIONS.filter((option) => matched.some(option.appliesTo));
  const noProof = matched.filter((s) => !s.proofRequired).length;

  const order: QuestionId[] = ["life", "also", "proof"];
  const available: Record<QuestionId, boolean> = {
    life: lifeOptions.length > 0,
    also: alsoOptions.length > 0,
    proof: proofOptions.length > 0,
  };
  // Answers to one question change what the next can offer, so availability is checked on arrival:
  // a question with nothing to offer this person is skipped.
  const current = order.slice(order.indexOf(question)).find((id) => available[id]);
  // Fixed count: what question 3 can offer isn't known until questions 1 and 2 are answered.
  const position = current ? order.indexOf(current) + 1 : order.length;

  useEffect(() => {
    if (!current) onDone();
  }, [current, onDone]);

  function advance() {
    const nextQuestion = current && order[order.indexOf(current) + 1];
    setPicked(new Set());
    if (nextQuestion) setQuestion(nextQuestion);
    else onDone();
  }

  const toggle = (id: string) =>
    setPicked((previous) => {
      const nextPicked = new Set(previous);
      if (nextPicked.has(id)) nextPicked.delete(id);
      else nextPicked.add(id);
      return nextPicked;
    });

  // Brands this question's answers would add, and the open settlements they bring.
  const addedBrandIds = new Set<string>();
  if (current === "life") {
    for (const option of lifeOptions) {
      if (picked.has(option.id)) brandIdsFor(option.companies).forEach((id) => addedBrandIds.add(id));
    }
  } else if (current === "also") {
    for (const settlement of alsoOptions) if (picked.has(settlement.id)) addedBrandIds.add(settlement.brandId);
  }
  for (const id of selectedBrandIds) addedBrandIds.delete(id);
  const newMatches = matchSettlements(settlements, addedBrandIds, selectedStates).filter((s) => !matchedIds.has(s.id));

  const submit = () => {
    track("question_answered", { detail: `${current}: ${[...picked].join(",") || "none"}` });
    for (const id of addedBrandIds) toggleBrand(id);
    advance();
  };

  if (!current) return null;

  const feedback =
    current === "proof"
      ? picked.size === 0
        ? noProof > 0
          ? `No problem: ${noProof} of your ${plural(noProof, "claim needs", "claims need")} no proof at all.`
          : "No problem. We’ll show you exactly what each claim needs."
        : `Nice, that helps on ${picked.size} ${plural(picked.size, "claim", "claims")}.`
      : newMatches.length > 0
        ? `+${newMatches.length} ${plural(newMatches.length, "settlement", "settlements")} found${
            maxTotal(newMatches) > 0 ? ` · up to ${cappedTotal(maxTotal(newMatches))} more` : ""
          }`
        : "";

  return (
    <FlowScreen
      key={current}
      footer={
        <Button onPress={submit}>
          {picked.size > 0 ? "Continue" : current === "also" ? "Skip" : "None of these"}
        </Button>
      }
    >
      <QuestionProgress position={position} total={order.length} />
      <Eyebrow>
        Question {position} of {order.length}
      </Eyebrow>

      {current === "life" && (
        <>
          <FlowTitle>Which of these have happened to you since 2015?</FlowTitle>
          <Muted>Tap any that apply. Some settlements cover things people never think to check.</Muted>
          <Stack gap={10}>
            {lifeOptions.map((option) => (
              <QuestionOption key={option.id} on={picked.has(option.id)} onPress={() => toggle(option.id)}>
                <Txt w={600}>{option.label}</Txt>
              </QuestionOption>
            ))}
          </Stack>
        </>
      )}

      {current === "also" && (
        <>
          <FlowTitle>Have you used any of these too?</FlowTitle>
          <Muted>Each one has a settlement open right now. Tap to add it.</Muted>
          <Stack gap={10}>
            {alsoOptions.map((settlement) => (
              <AlsoUsedOption
                key={settlement.id}
                settlement={settlement}
                brand={brands.find((brand) => brand.id === settlement.brandId)}
                on={picked.has(settlement.id)}
                onToggle={() => toggle(settlement.id)}
              />
            ))}
          </Stack>
        </>
      )}

      {current === "proof" && (
        <>
          <FlowTitle>Do you have any of these?</FlowTitle>
          <Muted>Tap any you have. It’s fine if you don’t.</Muted>
          <Stack gap={10}>
            {proofOptions.map((option) => (
              <QuestionOption key={option.id} on={picked.has(option.id)} onPress={() => toggle(option.id)}>
                <Txt w={600}>{option.label}</Txt>
                {picked.has(option.id) && (
                  <Txt w={500} size={14} color="money">
                    {option.feedback}
                  </Txt>
                )}
              </QuestionOption>
            ))}
          </Stack>
        </>
      )}

      <Txt w={700} color="money" accessibilityLiveRegion="polite" style={{ minHeight: 24 }}>
        {feedback}
      </Txt>
    </FlowScreen>
  );
}

function QuestionProgress({ position, total }: { position: number; total: number }) {
  const c = useColors();
  return (
    <View style={styles.progress} accessibilityLabel={`Question ${position} of ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.progressBar, { backgroundColor: index < position ? c.money : c.line }]} />
      ))}
    </View>
  );
}

function QuestionOption({ on, onPress, children }: { on: boolean; onPress: () => void; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: on ? c.moneySoft : c.surface,
          borderColor: on ? c.money : pressed ? c.checkLine : c.line,
          borderWidth: on ? 2 : 1,
          padding: on ? 13 : 14,
          paddingHorizontal: on ? 15 : 16,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

function AlsoUsedOption({
  settlement,
  brand,
  on,
  onToggle,
}: {
  settlement: Settlement;
  brand: Brand | undefined;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <QuestionOption on={on} onPress={onToggle}>
      <View style={styles.company}>
        <Monogram brand={brand} name={settlement.company} size={34} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt w={700}>{settlement.company}</Txt>
          <Txt w={500} size={13} color="muted">
            {settlement.title}
          </Txt>
        </View>
        <Txt f="mono" size={13} color="money">
          {payoutRange(settlement)}
        </Txt>
      </View>
    </QuestionOption>
  );
}

/** What members get emailed about, built from real deadlines; entering an email here signs them in. */
function RemindersStep({ onBack }: { onBack: () => void }) {
  const c = useColors();
  const router = useRouter();
  const { brands, matched, featured, selectedBrandIds, session } = useStore();
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    track("reminders_seen", { detail: clientKind() });
  }, []);

  const rows = reminderSchedule([...matched, ...featured]);
  const shown = rows.slice(0, 5);
  const featuredIds = new Set(featured.map((settlement) => settlement.id));
  const openBrandIds = new Set(matched.map((settlement) => settlement.brandId));
  const pending = brands.filter(
    (brand) => selectedBrandIds.has(brand.id) && !openBrandIds.has(brand.id) && pendingCaseFor(brand),
  );
  const scheduled = new Set([...rows.map((row) => row.settlement.company), ...pending.map((brand) => brand.name)]);
  const watched = WATCHED_BRAND_NAMES.filter((name) => !scheduled.has(name)).slice(0, 4);

  // Accounts land on their dashboard; the paywall waits until they go to file a claim.
  const toDashboard = () => router.push("/welcome");

  const rowStyle = [styles.reminderRow, { borderTopColor: c.line }];

  return (
    <FlowScreen>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "flex-start" }}>
        <Txt w={600} size={15} color="muted">
          ← Back
        </Txt>
      </Pressable>
      <Eyebrow>Almost there</Eyebrow>
      <FlowTitle>Your reminder schedule</FlowTitle>
      <Muted>Rightful members get an email before every deadline, so nothing closes on you.</Muted>

      <View style={[styles.reminderList, { backgroundColor: c.surface, borderColor: c.line }]}>
        {shown.map((row, index) => (
          <View key={row.settlement.id} style={[rowStyle, index === 0 && { borderTopWidth: 0 }]}>
            <Txt f="mono" size={12} upper ls={0.04} color="money" style={styles.reminderDate}>
              {shortDay(row.sendOn)}
            </Txt>
            <View style={{ flex: 1 }}>
              <Txt size={15}>
                <Txt w={700} size={15}>
                  {row.settlement.company}
                </Txt>{" "}
                · {row.settlement.title}
              </Txt>
              <Txt size={13} color="muted">
                Closes {row.closes}
                {featuredIds.has(row.settlement.id) && " · open to everyone"}
              </Txt>
            </View>
          </View>
        ))}
        {pending.map((brand, index) => (
          <View key={brand.id} style={[rowStyle, shown.length === 0 && index === 0 && { borderTopWidth: 0 }]}>
            <Txt f="mono" size={12} upper ls={0.04} color="money" style={styles.reminderDate}>
              When it opens
            </Txt>
            <View style={{ flex: 1 }}>
              <Txt size={15}>
                <Txt w={700} size={15}>
                  {brand.name}
                </Txt>{" "}
                · {pendingCaseFor(brand)?.title}
              </Txt>
              <Txt size={13} color="muted">
                The day claims open
              </Txt>
            </View>
          </View>
        ))}
        {rows.length > shown.length && (
          <View style={rowStyle}>
            <Txt size={14} color="muted">
              + {rows.length - shown.length} more {plural(rows.length - shown.length, "reminder", "reminders")}
            </Txt>
          </View>
        )}
      </View>
      {watched.length > 0 && (
        <Txt size={15} color="muted">
          👀 We also watch <Txt w={700} size={15} color="muted">{watched.join(", ")}</Txt> and{" "}
          {brands.length - watched.length}+ other companies, and email members the day a new settlement opens.
        </Txt>
      )}

      {session ? (
        <>
          <Muted>
            Reminders go to <Txt w={700} color="muted">{session.user.email}</Txt>.
          </Muted>
          <Button onPress={toDashboard}>Continue</Button>
        </>
      ) : isSampleMode ? (
        <Button onPress={toDashboard}>Continue in sample mode</Button>
      ) : (
        <>
          {!codeSent && <SubTitle style={{ marginTop: 8 }}>Where should we send them?</SubTitle>}
          <EmailCodeForm
            submitLabel="Send my reminders here"
            onCodeSent={(email) => setCodeSent(email !== null)}
            onVerified={toDashboard}
          />
          <FinePrint center>This creates your Rightful account. No password needed.</FinePrint>
          {/* An account is optional on iPhone (App Review Guideline 5.1.1): everything but email works without one. */}
          {IAP_AVAILABLE && !codeSent && <QuietButton onPress={toDashboard}>Skip for now</QuietButton>}
        </>
      )}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  link: { textDecorationLine: "underline" },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  scanRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderStyle: "dashed",
  },
  casePending: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 99 },
  progress: { flexDirection: "row", gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 99 },
  option: { borderRadius: 14, gap: 6 },
  company: { flexDirection: "row", alignItems: "center", gap: 12 },
  reminderList: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  reminderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  reminderDate: { width: 92 },
});
