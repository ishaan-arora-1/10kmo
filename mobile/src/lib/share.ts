import * as Sharing from "expo-sharing";
import type { RefObject } from "react";
import { Platform, Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

export type ShareOutcome = "shared" | "text";

/** Shares the rendered PAID check as a 1080×1260 PNG; falls back to text where images can't be shared. */
export async function sharePaidCheck(card: RefObject<View | null>, text: string): Promise<ShareOutcome> {
  if (Platform.OS !== "web" && card.current && (await Sharing.isAvailableAsync())) {
    const uri = await captureRef(card, { format: "png", quality: 1, width: 1080, height: 1260, result: "tmpfile" });
    await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share the win" });
    return "shared";
  }
  await Share.share({ message: text });
  return "text";
}
