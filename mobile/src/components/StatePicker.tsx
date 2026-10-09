import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { US_STATES } from "@/lib/models";
import { useStore } from "@/lib/store";
import { useColors } from "@/theme";
import { Checkbox, SearchField, Txt } from "./primitives";

export function StatePicker() {
  const c = useColors();
  const { selectedStates, toggleState } = useStore();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return US_STATES;
    return US_STATES.filter(([code, name]) => name.toLowerCase().includes(q) || code.toLowerCase() === q);
  }, [query]);

  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} color="muted">
        Some settlements only cover people in certain states. Pick every state you’ve lived in since 2015.
      </Txt>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search states" accessibilityLabel="Search states" />
      <View style={[styles.list, { borderColor: c.line }]}>
        {visible.map(([code, name], index) => {
          const checked = selectedStates.has(code);
          return (
            <Pressable
              key={code}
              onPress={() => toggleState(code)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={name}
              style={[
                styles.row,
                {
                  backgroundColor: checked ? c.moneySoft : c.surface,
                  borderTopColor: c.line,
                  borderTopWidth: index === 0 ? 0 : 1,
                },
              ]}
            >
              <Txt w={checked ? 600 : 400}>{name}</Txt>
              <Checkbox checked={checked} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
