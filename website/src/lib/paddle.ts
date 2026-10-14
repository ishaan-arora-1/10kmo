import { initializePaddle, type Paddle, type PaddleEventData } from "@paddle/paddle-js";
import { PADDLE } from "./config";

type Listener = (event: PaddleEventData) => void;

const listeners = new Set<Listener>();
let loading: Promise<Paddle | undefined> | null = null;

/** Loads Paddle.js once (it refuses a second initialize) and fans its events out to listeners. */
export function loadPaddle(): Promise<Paddle | undefined> {
  loading ??= initializePaddle({
    token: PADDLE.token,
    environment: PADDLE.environment,
    eventCallback: (event) => listeners.forEach((listener) => listener(event)),
    checkout: {
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        theme: "light",
        locale: "en",
        allowLogout: false,
        showAddDiscounts: false,
      },
    },
  }).catch(() => {
    loading = null;
    return undefined;
  });
  return loading;
}

/** Listens to checkout events; returns a function that stops listening. */
export function onPaddleEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
