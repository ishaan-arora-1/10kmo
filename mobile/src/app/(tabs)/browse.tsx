import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Chips, EmptyCard, PageTitle, SearchField, Txt } from "@/components/primitives";
import { PageScreen, Stack } from "@/components/screens";
import { SettlementCard } from "@/components/ui";
import { daysUntil } from "@/lib/models";
import { useStore } from "@/lib/store";

const FILTERS = ["All", "Matches me", "No proof", "Closing soon", "Highest payout"] as const;
type Filter = (typeof FILTERS)[number];

export default function Browse() {
  const store = useStore();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
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
    <PageScreen>
      <View>
        <PageTitle>Open settlements</PageTitle>
        <Txt color="muted" style={{ marginTop: 4 }}>
          {store.settlements.length} available · refreshed weekly
        </Txt>
      </View>

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search companies or settlements"
        accessibilityLabel="Search settlements"
      />
      <Chips items={FILTERS} value={filter} onChange={setFilter} label="Filter settlements" />

      {results.length === 0 ? (
        <EmptyCard
          title="No settlements found"
          body={
            filter === "Matches me"
              ? "Add more companies or states in Profile to see more matches."
              : "Try another search or filter."
          }
        />
      ) : (
        <Stack>
          {results.map((settlement) => (
            <Pressable
              key={settlement.id}
              onPress={() => router.push(`/settlements/${settlement.id}`)}
              accessibilityRole="link"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <SettlementCard settlement={settlement} />
            </Pressable>
          ))}
        </Stack>
      )}
    </PageScreen>
  );
}
