import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Modal, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useColors } from "@/theme";
import type { CheckoutOutcome, OpenCheckout, RazorpayOptions } from "./checkout-types";
import { WEBSITE_URL } from "./config";

const CheckoutContext = createContext<OpenCheckout | null>(null);

interface Session {
  options: RazorpayOptions;
  onFailure: (description: string) => void;
  resolve: (outcome: CheckoutOutcome) => void;
}

/** Razorpay's own Checkout page, the same one the website opens, run in a WebView. */
function checkoutPage(options: RazorpayOptions): string {
  const json = JSON.stringify(options).replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>html,body{margin:0;height:100%;background:transparent}</style></head>
<body>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
(function () {
  function post(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  if (!window.Razorpay) { post({ type: "load_failed" }); return; }
  var lastFailure = null;
  var options = ${json};
  options.handler = function (response) { post({ type: "success", response: response }); };
  options.modal = { ondismiss: function () { post({ type: "dismissed", failure: lastFailure }); } };
  var checkout = new window.Razorpay(options);
  // Razorpay keeps the window open after a failed attempt so the user can retry.
  checkout.on("payment.failed", function (failure) {
    lastFailure = (failure && failure.error && failure.error.description) || "The payment didn\\u2019t go through. Please try another card.";
    post({ type: "failed", description: lastFailure });
  });
  checkout.open();
})();
</script>
</body></html>`;
}

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  const finish = useCallback((outcome: CheckoutOutcome) => {
    const current = sessionRef.current;
    if (!current) return;
    sessionRef.current = null;
    setSession(null);
    current.resolve(outcome);
  }, []);

  const open = useCallback<OpenCheckout>((options, onFailure) => {
    return new Promise<CheckoutOutcome>((resolve) => {
      const next = { options, onFailure, resolve };
      sessionRef.current = next;
      setLoading(true);
      setSession(next);
    });
  }, []);

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { type?: string; response?: unknown; failure?: string | null; description?: string };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === "failed" && message.description) sessionRef.current?.onFailure(message.description);
    else if (message.type === "success") finish({ type: "success", response: message.response as never });
    else if (message.type === "dismissed") finish({ type: "dismissed", failure: message.failure ?? null });
    else if (message.type === "load_failed") finish({ type: "load_failed" });
  };

  return (
    <CheckoutContext.Provider value={open}>
      {children}
      <Modal
        visible={session !== null}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => finish({ type: "dismissed", failure: null })}
      >
        <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {session && (
            <WebView
              source={{ html: checkoutPage(session.options), baseUrl: WEBSITE_URL }}
              originWhitelist={["*"]}
              onMessage={onMessage}
              onLoadEnd={() => setLoading(false)}
              onError={() => finish({ type: "load_failed" })}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              setSupportMultipleWindows={false}
              style={styles.webview}
              containerStyle={styles.webview}
              // Bank and UPI apps open outside the WebView.
              onShouldStartLoadWithRequest={(request) => {
                if (/^(https?|about|data|blob):/i.test(request.url)) return true;
                void Linking.openURL(request.url).catch(() => undefined);
                return false;
              }}
              {...(Platform.OS === "ios" ? { contentInsetAdjustmentBehavior: "never" as const } : {})}
            />
          )}
          {loading && (
            <View style={styles.loading} pointerEvents="none">
              <ActivityIndicator size="large" color={c.money} />
            </View>
          )}
        </View>
      </Modal>
    </CheckoutContext.Provider>
  );
}

export function useCheckout(): OpenCheckout {
  const open = useContext(CheckoutContext);
  if (!open) throw new Error("useCheckout must be used inside CheckoutProvider");
  return open;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(8, 18, 12, 0.5)" },
  webview: { flex: 1, backgroundColor: "transparent" },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
