import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BrandSeal, Wordmark } from "../components/ui";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

type Day = {
  d: string;
  signups: number;
  opens: number;
  picked: number;
  results: number;
  code_sent: number;
  signed_in: number;
  paywall: number;
  tapped_file: number;
  checkout: number;
  trials?: number;
  paid: number;
};
type Dashboard = {
  generated_at: string;
  total_signups?: number;
  daily: Day[];
  trials?: { on_trial: number; canceling: number; paid: number; canceled: number };
  subscribers: { plan: string; source: string; n: number }[];
  tried_to_file: { claim: string; people: number }[];
  checkouts: { at: string; event: string; detail: string | null; tz: string | null; who: string }[];
};

const STEPS: { key: keyof Day; label: string }[] = [
  { key: "opens", label: "Opened the app" },
  { key: "picked", label: "Picked companies" },
  { key: "results", label: "Saw results" },
  { key: "code_sent", label: "Sign-in code sent" },
  { key: "signed_in", label: "Signed in" },
  { key: "paywall", label: "Saw the paywall" },
  { key: "tapped_file", label: "Tapped File" },
  { key: "checkout", label: "Opened checkout" },
  { key: "trials", label: "Started free trial" },
  { key: "paid", label: "Paid" },
];

const REGIONS: Record<string, string> = {
  "America/New_York": "Eastern",
  "America/Detroit": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Phoenix": "Arizona",
  "America/Los_Angeles": "Pacific",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

const CHECKOUT_LABEL: Record<string, { text: string; tone: string }> = {
  checkout_opened: { text: "Opened", tone: "" },
  checkout_paid: { text: "Paid", tone: "good" },
  checkout_failed: { text: "Failed", tone: "bad" },
  checkout_dismissed: { text: "Closed", tone: "warn" },
};

const REFRESH_MS = 5 * 60 * 1000;

function dayLabel(iso: string, weekday = false) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: weekday ? "short" : undefined,
    timeZone: "UTC",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Owner-only stats page. The database refuses everyone not on the admin list. */
export function Admin() {
  const { session } = useStore();
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setRefreshing(true);
    const { data: result, error } = await supabase.rpc("admin_dashboard");
    setRefreshing(false);
    if (error) {
      setState(error.code === "42501" ? "denied" : "error");
      return;
    }
    setData(result as Dashboard);
    setState("ready");
  }, []);

  useEffect(() => {
    if (!session) return;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [session, load]);

  if (!session || state === "denied") return <Navigate to="/" replace />;
  if (!data) {
    return (
      <div className="boot" aria-busy={state === "loading"}>
        {state === "error" ? (
          <div className="stack center">
            <p className="muted">The numbers didn’t load.</p>
            <button type="button" className="btn secondary" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : (
          <BrandSeal size={44} />
        )}
      </div>
    );
  }

  const days = data.daily;
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2] ?? today;
  const day = days.find((d) => d.d === selected) ?? today;

  return (
    <div className="admin">
      <header className="admin-top">
        <div className="admin-title">
          <Wordmark />
          <span className="admin-chip">Admin</span>
          <Link className="admin-nav small" to="/users">User stats</Link>
        </div>
        <div className="admin-refresh">
          <span className="mono small muted">{timeLabel(data.generated_at)}</span>
          <button type="button" className="btn secondary admin-btn" onClick={() => void load()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>
      {state === "error" && <p className="error-text">Refresh failed. These are the last numbers that loaded.</p>}

      <Headline days={days} />

      <div className="admin-tiles">
        {data.total_signups !== undefined && (
          <div className="admin-tile total">
            <span className="admin-label">Total users</span>
            <span className="admin-big">{data.total_signups.toLocaleString("en-US")}</span>
            <span className="small muted">+{today.signups} today</span>
          </div>
        )}
        <Tile label="Sign-ups today" value={today.signups} compare={yesterday.signups} />
        <Tile label="Saw the paywall" value={today.paywall} compare={yesterday.paywall} />
        <Tile label="Opened checkout" value={today.checkout} compare={yesterday.checkout} />
        <Subscribers rows={data.subscribers} />
        {data.trials && (
          <div className="admin-tile">
            <span className="admin-label">Yearly trials</span>
            <span className="admin-big">{data.trials.on_trial + data.trials.canceling}</span>
            <span className="small muted">
              on trial ({data.trials.canceling} canceling) · {data.trials.paid} paid · {data.trials.canceled} canceled
            </span>
          </div>
        )}
      </div>

      <section className="admin-block">
        <h2>Last 14 days</h2>
        <DailyChart days={days} selected={day.d} onSelect={setSelected} />
      </section>

      <section className="admin-block">
        <div className="admin-block-head">
          <h2>{day.d === today.d ? "Today" : dayLabel(day.d, true)}</h2>
          <div className="admin-seg" role="group" aria-label="Choose day">
            <button type="button" aria-pressed={day.d === today.d} onClick={() => setSelected(today.d)}>
              Today
            </button>
            <button type="button" aria-pressed={day.d === yesterday.d} onClick={() => setSelected(yesterday.d)}>
              Yesterday
            </button>
          </div>
        </div>
        <Funnel day={day} />
      </section>

      <div className="admin-pair">
        <section className="admin-block">
          <h2>Trying to file</h2>
          <ClaimBars rows={data.tried_to_file} />
        </section>
        <section className="admin-block">
          <h2>Checkouts</h2>
          <Checkouts rows={data.checkouts} />
        </section>
      </div>

      <details className="admin-table">
        <summary>All days</summary>
        <DayTable days={days} />
      </details>
    </div>
  );
}

function Headline({ days }: { days: Day[] }) {
  const week = days.slice(-7);
  const opened = week.reduce((sum, d) => sum + d.checkout, 0);
  const paid = week.reduce((sum, d) => sum + d.paid, 0);
  return (
    <p className="admin-headline">
      This week <span className="money">{opened}</span> opened checkout and{" "}
      <span className="money">{paid}</span> paid.
    </p>
  );
}

function Tile({ label, value, compare }: { label: string; value: number; compare: number }) {
  return (
    <div className="admin-tile">
      <span className="admin-label">{label}</span>
      <span className="admin-big">{value}</span>
      <span className="small muted">Yesterday {compare}</span>
    </div>
  );
}

function Subscribers({ rows }: { rows: Dashboard["subscribers"] }) {
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  return (
    <div className="admin-tile goal">
      <span className="admin-label">Paying</span>
      <span className="admin-big money">{total}</span>
      <span className="small muted">
        {rows.length ? rows.map((r) => `${r.n} ${r.plan} · ${r.source}`).join(", ") : "None yet"}
      </span>
    </div>
  );
}

function DailyChart({ days, selected, onSelect }: { days: Day[]; selected: string; onSelect: (d: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 230;
  const L = 32;
  const R = 6;
  const T = 26;
  const B = 28;
  const max = Math.max(5, ...days.map((d) => d.signups));
  const tick = max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : 20;
  const top = Math.ceil(max / tick) * tick;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const slot = (W - L - R) / days.length;
  const bw = Math.min(26, slot * 0.58);
  const ticks = useMemo(() => Array.from({ length: top / tick + 1 }, (_, i) => i * tick), [top, tick]);
  const hovered = hover === null ? null : days[hover];

  return (
    <div className="admin-chart">
      <div className="admin-legend small muted">
        <span><i className="sw" />Sign-ups</span>
        <span><i className="sw dot" />Opened checkout</span>
        <span><i className="sw dot paid" />Paid</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sign-ups per day, last 14 days">
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="axis" x={L - 8} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = L + slot * i + slot / 2;
          const h = Math.max(0, y(0) - y(d.signups));
          const on = d.d === selected;
          return (
            <g
              key={d.d}
              className={`bar-group${on ? " on" : ""}`}
              tabIndex={0}
              role="button"
              aria-label={`${dayLabel(d.d, true)}: ${d.signups} sign-ups, ${d.checkout} opened checkout, ${d.paid} paid`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(d.d)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(d.d);
                }
              }}
            >
              <rect className="hit" x={cx - slot / 2} y={0} width={slot} height={H - B} />
              {h > 0 && (
                <path
                  className="bar"
                  d={`M${cx - bw / 2},${y(0)} V${y(d.signups) + Math.min(4, h)} q0,-4 4,-4 H${cx + bw / 2 - 4} q4,0 4,4 V${y(0)} Z`}
                />
              )}
              {(on || i === days.length - 1) && (
                <text className="value" x={cx} y={y(d.signups) - 6} textAnchor="middle">{d.signups}</text>
              )}
              {d.checkout > 0 && (
                <circle className={`ck${d.paid > 0 ? " paid" : ""}`} cx={cx} cy={9} r={Math.min(7, 3 + d.checkout / 2)} />
              )}
              {i % 2 === (days.length - 1) % 2 && (
                <text className="axis" x={cx} y={H - 8} textAnchor="middle">{dayLabel(d.d)}</text>
              )}
            </g>
          );
        })}
        <line className="baseline" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
      </svg>
      {hovered && hover !== null && (
        <div
          className="admin-tip"
          style={{
            left: `clamp(70px, ${((L + slot * hover + slot / 2) / W) * 100}%, calc(100% - 70px))`,
            top: `${(y(hovered.signups) / H) * 100}%`,
          }}
        >
          <strong>{dayLabel(hovered.d, true)}</strong>
          <span>Sign-ups <b>{hovered.signups}</b></span>
          <span>Paywall <b>{hovered.paywall}</b></span>
          <span>Checkout <b>{hovered.checkout}</b></span>
          <span>Paid <b>{hovered.paid}</b></span>
        </div>
      )}
    </div>
  );
}

function Funnel({ day }: { day: Day }) {
  const top = Math.max(1, day.opens);
  let worst = -1;
  let worstRate = 2;
  STEPS.forEach((s, i) => {
    if (i === 0) return;
    const prev = Number(day[STEPS[i - 1].key] ?? 0);
    const rate = Number(day[s.key] ?? 0) / prev;
    if (prev >= 3 && rate < worstRate) {
      worstRate = rate;
      worst = i;
    }
  });
  return (
    <div className="admin-funnel">
      {STEPS.map((s, i) => {
        const v = Number(day[s.key] ?? 0);
        const prev = i > 0 ? Number(day[STEPS[i - 1].key] ?? 0) : null;
        const pct = prev === null ? "" : prev > 0 ? `${Math.round((v / prev) * 100)}%` : "–";
        return (
          <div key={s.key} className={`admin-step${i === worst ? " drop" : ""}`}>
            <span className="name">{s.label}</span>
            <span className="track"><span className="fill" style={{ width: `${v ? Math.max(1.5, (v / top) * 100) : 0}%` }} /></span>
            <span className="val">{v}</span>
            <span className="pct">{pct}</span>
          </div>
        );
      })}
    </div>
  );
}

function ClaimBars({ rows }: { rows: Dashboard["tried_to_file"] }) {
  if (!rows.length) return <p className="admin-panel muted small">Nobody tapped File this week.</p>;
  const max = rows[0].people || 1;
  return (
    <div className="admin-panel">
      {rows.map((r) => (
        <div key={r.claim} className="admin-claim">
          <span>{r.claim}</span>
          <span className="mono">{r.people}</span>
          <span className="track"><span className="fill" style={{ width: `${Math.max(2, (r.people / max) * 100)}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

function Checkouts({ rows }: { rows: Dashboard["checkouts"] }) {
  if (!rows.length) return <p className="admin-panel muted small">No checkouts yet.</p>;
  return (
    <div className="admin-panel">
      {rows.slice(0, 12).map((r, i) => {
        const label = CHECKOUT_LABEL[r.event] ?? { text: r.event.replace("checkout_", ""), tone: "" };
        const raw = r.detail ?? "";
        const iphone = raw.startsWith("app_store");
        let detail = raw.replace(/^app_store:?\s*/, "");
        if (detail === "closed") detail = "";
        const meta = [
          REGIONS[r.tz ?? ""] ?? (r.tz ?? "").split("/").pop()?.replace(/_/g, " "),
          iphone ? "iPhone" : "Web",
          r.who === "guest" ? "signed out" : r.who,
          detail,
        ].filter(Boolean);
        return (
          <div key={`${r.at}-${i}`} className="admin-ck">
            <span className={`admin-pill ${label.tone}`}>{label.text}</span>
            <span>{timeLabel(r.at)}</span>
            <span className="meta small muted">{meta.join(" · ")}</span>
          </div>
        );
      })}
    </div>
  );
}

function DayTable({ days }: { days: Day[] }) {
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Sign-ups</th>
            {STEPS.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.d}>
              <td>{dayLabel(d.d, true)}</td>
              {[d.signups, ...STEPS.map((s) => Number(d[s.key] ?? 0))].map((v, i, all) => (
                <td key={i} className={v === 0 ? "zero" : i === all.length - 1 ? "money strong" : undefined}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
