import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { brandMatchesSearch, CATEGORIES, isOpen, pendingCaseFor, sortBrandsForPicker, type Brand, type Category } from "@/lib/models";
import { useStore } from "@/lib/store";
import { GUTTER, useColors } from "@/theme";
import { Chips, SearchField, Txt } from "./primitives";
import { Monogram } from "./ui";

const TILE_MIN = 104;
const GAP = 10;

/** Columns for the website's repeat(auto-fill, minmax(104px, 1fr)) grid. */
export function useGridColumns(inset = GUTTER * 2): { columns: number; tileWidth: number } {
  const { width } = useWindowDimensions();
  const available = Math.min(width, 640) - inset;
  const columns = Math.max(2, Math.floor((available + GAP) / (TILE_MIN + GAP)));
  // Whole points: an exact fraction (e.g. 123.33 on a 430pt iPhone) can overflow the row in layout
  // rounding and wrap the last tile, leaving two columns.
  return { columns, tileWidth: Math.floor((available - GAP * (columns - 1)) / columns) };
}

export const BrandTile = memo(function BrandTile({
  brand,
  selected,
  open,
  pending,
  width,
  onToggle,
}: {
  brand: Brand;
  selected: boolean;
  open: boolean;
  pending: boolean;
  width: number;
  onToggle: (id: string) => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => onToggle(brand.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={open ? `${brand.name}, open settlement` : pending ? `${brand.name}, case pending` : brand.name}
      style={({ pressed }) => [
        styles.tile,
        {
          width,
          backgroundColor: selected ? c.moneySoft : c.surface,
          borderColor: selected ? c.money : pressed ? c.checkLine : c.line,
          borderWidth: selected ? 2 : 1,
          padding: selected ? 9 : 10,
        },
      ]}
    >
      <Monogram brand={brand} name={brand.name} size={40} />
      <Txt w={600} size={13} lh={1.2} center numberOfLines={2}>
        {brand.name}
      </Txt>
      {(open || pending) && (
        <View style={[styles.flag, { backgroundColor: open ? c.moneySoft : c.deadlineSoft }]}>
          <Txt f="mono" w={500} size={9.5} ls={0.02} upper lh={1.3} color={open ? "money" : "deadline"}>
            {open ? "Open claim" : "Case pending"}
          </Txt>
        </View>
      )}
    </Pressable>
  );
});

/** A wrapping grid of tiles. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function BrandPicker({ inset }: { inset?: number }) {
  const { brands, settlements, selectedBrandIds, toggleBrand } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const { tileWidth } = useGridColumns(inset);

  const openBrandIds = useMemo(
    () => new Set(settlements.filter(isOpen).map((settlement) => settlement.brandId)),
    [settlements],
  );
  const ordered = useMemo(() => {
    const best = new Map<string, number>();
    for (const settlement of settlements.filter(isOpen)) {
      best.set(settlement.brandId, Math.max(best.get(settlement.brandId) ?? 0, settlement.payoutMax));
    }
    return sortBrandsForPicker(brands, openBrandIds, (id) => best.get(id) ?? 0);
  }, [brands, settlements, openBrandIds]);

  const visible = useMemo(
    () =>
      ordered.filter(
        (brand) => (category === "All" || brand.category === category) && brandMatchesSearch(brand, query),
      ),
    [ordered, category, query],
  );

  return (
    <View style={{ gap: 14 }}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={`Search ${brands.length} apps & companies`}
        accessibilityLabel="Search companies"
      />
      <Chips items={CATEGORIES} value={category} onChange={setCategory} label="Filter by category" />
      <TileGrid>
        {visible.map((brand) => {
          const open = openBrandIds.has(brand.id);
          return (
            <BrandTile
              key={brand.id}
              brand={brand}
              selected={selectedBrandIds.has(brand.id)}
              open={open}
              pending={!open && Boolean(pendingCaseFor(brand))}
              width={tileWidth}
              onToggle={toggleBrand}
            />
          );
        })}
      </TileGrid>
      {visible.length === 0 && (
        <Txt color="muted" center>
          No companies match “{query}”.
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: {
    minHeight: 100,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  flag: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 99 },
});
