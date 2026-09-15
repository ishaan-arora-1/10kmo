import { useMemo, useState } from "react";
import { US_STATES } from "../lib/models";
import { useStore } from "../lib/store";
import { SearchIcon } from "./icons";

export function StatePicker() {
  const { selectedStates, toggleState } = useStore();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return US_STATES;
    return US_STATES.filter(([code, name]) => name.toLowerCase().includes(q) || code.toLowerCase() === q);
  }, [query]);

  return (
    <div className="state-picker">
      <p className="muted small">
        Some settlements only cover people in certain states. Pick every state you’ve lived in since 2015.
      </p>
      <label className="search-field" htmlFor="state-search">
        <SearchIcon />
        <span className="visually-hidden">Search states</span>
        <input
          id="state-search"
          type="search"
          placeholder="Search states"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </label>
      <ul className="state-list">
        {visible.map(([code, name]) => {
          const checked = selectedStates.has(code);
          return (
            <li key={code}>
              <label className={`state-row${checked ? " on" : ""}`} htmlFor={`state-${code}`}>
                <span>{name}</span>
                <input
                  id={`state-${code}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleState(code)}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
