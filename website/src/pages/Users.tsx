import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BrandSeal, Wordmark } from "../components/ui";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

type Day = { d: string; signups: number; total: number; active: number };
export type UsersData = {
  generated_at: string;
  total: number;
  daily: Day[];
  active_7d: number;
  active_30d: number;
  regions: { region: string; n: number }[];
  usage: { picked_companies: number; saved_claim: number; filed_claim: number; saw_paywall: number; paying: number };
  top_companies: { name: string; n: number }[];
};

const REFRESH_MS = 5 * 60 * 1000;

const REGION_LABEL: Record<string, string> = {
  US: "US",
  India: "India",
  Other: "Other countries",
  Unknown: "Not known (joined before tracking)",
};

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

const fmt = (n: number) => n.toLocaleString("en-US");

/** Owner-only user counts. The database refuses everyone not on the admin list. */
export function Users() {
  const { session } = useStore();
  const [data, setData] = useState<UsersData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setRefreshing(true);
    const { data: result, error } = await supabase.rpc("admin_users");
    setRefreshing(false);
    if (error) {
      setState(error.code === "42501" ? "denied" : "error");
      return;
    }
    setData(result as UsersData);
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
  return <UsersView data={data} failed={state === "error"} refreshing={refreshing} onRefresh={() => void load()} />;
}

export function UsersView({
  data,
  failed,
  refreshing,
  onRefresh,
}: {
  data: UsersData;
  failed: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const days = data.daily;
  const today = days[days.length - 1];
  const thisWeek = days.slice(-7).reduce((sum, d) => sum + d.signups, 0);
  const lastWeek = days.slice(-14, -7).reduce((sum, d) => sum + d.signups, 0);
  const pct = (n: number) => (data.total ? `${Math.round((n / data.total) * 100)}%` : "–");

  return (
    <div className="admin">
      <header className="admin-top">
        <div className="admin-title">
          <Wordmark />
          <span className="admin-chip">Users</span>
          <Link className="admin-nav small" to="/admin">Checkout stats</Link>
        </div>
        <div className="admin-refresh">
          <span className="mono small muted">{timeLabel(data.generated_at)}</span>
          <button type="button" className="btn secondary admin-btn" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>
      {failed && <p className="error-text">Refresh failed. These are the last numbers that loaded.</p>}

      <div className="admin-tiles">
        <Tile label="Total users" value={data.total} note={`+${today.signups} today`} />
        <Tile label="New this week" value={thisWeek} note={`Week before ${lastWeek}`} />
        <Tile label="Active this week" value={data.active_7d} note={`Today ${today.active}`} />
        <Tile label="Active in 30 days" value={data.active_30d} note={`${pct(data.active_30d)} of all users`} />
      </div>

      <section className="admin-block">
        <h2>Last 30 days</h2>
        <TotalChart days={days} />
      </section>

      <div className="admin-pair even">
        <section className="admin-block">
          <h2>Where they are</h2>
          <Bars rows={data.regions.map((r) => ({ label: REGION_LABEL[r.region] ?? r.region, n: r.n }))} total={data.total} />
        </section>
        <section className="admin-block">
          <h2>What they did</h2>
          <Bars
            total={data.total}
            rows={[
              { label: "Picked companies", n: data.usage.picked_companies },
              { label: "Saw the paywall", n: data.usage.saw_paywall },
              { label: "Saved a claim", n: data.usage.saved_claim },
              { label: "Marked a claim filed", n: data.usage.filed_claim },
              { label: "Paying", n: data.usage.paying },
            ]}
          />
        </section>
      </div>

      <section className="admin-block">
        <h2>Companies they picked</h2>
        <Bars rows={data.top_companies.map((c) => ({ label: c.name, n: c.n }))} total={data.total} />
      </section>

      <details className="admin-table">
        <summary>All days</summary>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>New</th>
                <th>Total</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.d}>
                  <td>{dayLabel(d.d, true)}</td>
                  <td className={d.signups === 0 ? "zero" : undefined}>{d.signups}</td>
                  <td>{fmt(d.total)}</td>
                  <td className={d.active === 0 ? "zero" : undefined}>{d.active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="admin-tile">
      <span className="admin-label">{label}</span>
      <span className="admin-big">{fmt(value)}</span>
      <span className="small muted">{note}</span>
    </div>
  );
}

function Bars({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  if (!rows.length) return <p className="admin-panel muted small">Nothing yet.</p>;
  return (
    <div className="admin-panel">
      {rows.map((r) => (
        <div key={r.label} className="admin-claim">
          <span>{r.label}</span>
          <span className="mono">
            {fmt(r.n)} <span className="muted">· {total ? Math.round((r.n / total) * 100) : 0}%</span>
          </span>
          <span className="track"><span className="fill" style={{ width: `${total ? Math.max(1, (r.n / total) * 100) : 0}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

function niceTick(max: number) {
  const raw = max / 5;
  const base = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * base >= raw) ?? 10;
  return step * base;
}

/** Total accounts at the end of each day, with new and active users on hover. */
function TotalChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 230;
  const L = 44;
  const R = 10;
  const T = 16;
  const B = 28;
  const max = Math.max(10, ...days.map((d) => d.total));
  const tick = niceTick(max);
  const top = Math.ceil(max / tick) * tick;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const slot = (W - L - R) / days.length;
  const x = (i: number) => L + slot * i + slot / 2;
  const ticks = useMemo(() => Array.from({ length: Math.round(top / tick) + 1 }, (_, i) => i * tick), [top, tick]);
  const line = days.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.total)}`).join(" ");
  const area = `${line} L${x(days.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const hovered = hover === null ? null : days[hover];
  const last = days.length - 1;

  return (
    <div className="admin-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Total users at the end of each day, last 30 days">
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="axis" x={L - 8} y={y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        <path className="area" d={area} />
        <path className="line" d={line} />
        <text className="value" x={x(last)} y={y(days[last].total) - 10} textAnchor="end">{fmt(days[last].total)}</text>
        {days.map((d, i) => (
          <g
            key={d.d}
            className="bar-group"
            tabIndex={0}
            aria-label={`${dayLabel(d.d, true)}: ${d.total} users, ${d.signups} new, ${d.active} active`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <rect className="hit" x={x(i) - slot / 2} y={0} width={slot} height={H - B} />
            {(hover === i || i === last) && <circle className="pt" cx={x(i)} cy={y(d.total)} r={4} />}
            {(last - i) % 5 === 0 && (
              <text className="axis" x={x(i)} y={H - 8} textAnchor="middle">{dayLabel(d.d)}</text>
            )}
          </g>
        ))}
        <line className="baseline" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
      </svg>
      {hovered && hover !== null && (
        <div
          className="admin-tip"
          style={{
            left: `clamp(70px, ${(x(hover) / W) * 100}%, calc(100% - 70px))`,
            top: `${(y(hovered.total) / H) * 100}%`,
          }}
        >
          <strong>{dayLabel(hovered.d, true)}</strong>
          <span>Total <b>{fmt(hovered.total)}</b></span>
          <span>New <b>{hovered.signups}</b></span>
          <span>Active <b>{hovered.active}</b></span>
        </div>
      )}
    </div>
  );
}
