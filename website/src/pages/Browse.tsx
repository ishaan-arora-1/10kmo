import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchIcon } from "../components/icons";
import { SettlementCard } from "../components/ui";
import { daysUntil } from "../lib/models";
import { useStore } from "../lib/store";

const FILTERS = ["Matches me", "No proof", "Closing soon", "Highest payout"] as const;
type Filter = (typeof FILTERS)[number];

export function Browse() {
  const store = useStore();
  const [filter, setFilter] = useState<Filter>("Matches me");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchedIds = new Set(store.matched.map((s) => s.id));
    let values = store.settlements.filter(
      (s) =>
        s.status === "verified" &&
        (!q || s.company.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)),
    );
    switch (filter) {
      case "Matches me":
        values = values.filter((s) => matchedIds.has(s.id));
        break;
      case "No proof":
        values = values.filter((s) => !s.proofRequired);
        break;
      case "Closing soon":
        values = values.filter((s) => daysUntil(s.deadline) <= 21);
        break;
      case "Highest payout":
        return [...values].sort((a, b) => b.payoutMax - a.payoutMax);
    }
    return [...values].sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [store.settlements, store.matched, filter, query]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Open settlements</h1>
        <p>{store.settlements.length} available · refreshed weekly</p>
      </header>

      <label className="search-field" htmlFor="browse-search">
        <SearchIcon />
        <span className="visually-hidden">Search settlements</span>
        <input
          id="browse-search"
          type="search"
          placeholder="Search companies or settlements"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="chips" role="group" aria-label="Filter settlements">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`chip${item === filter ? " on" : ""}`}
            aria-pressed={item === filter}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="empty-card">
          <b>No settlements found</b>
          <p className="muted">
            {filter === "Matches me"
              ? "Add more companies or states in Profile to see more matches."
              : "Try another search or filter."}
          </p>
        </div>
      ) : (
        <div className="stack">
          {results.map((settlement) => (
            <Link key={settlement.id} to={`/settlements/${settlement.id}`} className="card-link">
              <SettlementCard settlement={settlement} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
