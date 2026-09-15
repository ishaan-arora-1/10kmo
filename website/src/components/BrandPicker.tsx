import { useMemo, useState } from "react";
import { brandMatchesSearch, CATEGORIES, type Category } from "../lib/models";
import { useStore } from "../lib/store";
import { SearchIcon } from "./icons";
import { Monogram } from "./ui";

export function BrandPicker({ idPrefix = "brands" }: { idPrefix?: string }) {
  const { brands, selectedBrandIds, toggleBrand } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");

  const visible = useMemo(
    () =>
      brands.filter(
        (brand) => (category === "All" || brand.category === category) && brandMatchesSearch(brand, query),
      ),
    [brands, category, query],
  );

  return (
    <div className="brand-picker">
      <label className="search-field" htmlFor={`${idPrefix}-search`}>
        <SearchIcon />
        <span className="visually-hidden">Search companies</span>
        <input
          id={`${idPrefix}-search`}
          type="search"
          placeholder={`Search ${brands.length} apps & companies`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </label>

      <div className="chips" role="group" aria-label="Filter by category">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className={`chip${item === category ? " on" : ""}`}
            aria-pressed={item === category}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="brand-grid">
        {visible.map((brand) => {
          const selected = selectedBrandIds.has(brand.id);
          return (
            <button
              key={brand.id}
              type="button"
              className={`brand-tile${selected ? " on" : ""}`}
              aria-pressed={selected}
              onClick={() => toggleBrand(brand.id)}
            >
              <Monogram brand={brand} name={brand.name} size={40} />
              <span>{brand.name}</span>
            </button>
          );
        })}
      </div>
      {visible.length === 0 && <p className="empty-note">No companies match “{query}”.</p>}
    </div>
  );
}
