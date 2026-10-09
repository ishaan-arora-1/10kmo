import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { WEBSITE_URL } from "./config";

/**
 * Goes to a page the way the website's navigate(..., { replace: true }) does, without leaving
 * onboarding screens behind it: back from the dashboard never returns to the sign-up flow.
 */
export function goTo(href: string) {
  if (href === "/") {
    if (router.canDismiss()) router.dismissAll();
    router.replace("/");
    return;
  }
  router.dismissTo(href as Href);
}

/** Terms, Privacy, and Support live on the website. */
export function openWebsite(path: "/terms" | "/privacy" | "/support") {
  void WebBrowser.openBrowserAsync(`${WEBSITE_URL}${path}`);
}
