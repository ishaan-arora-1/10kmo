# ClaimRightful app (iPhone + Android)

The ClaimRightful mobile app. It does everything the web app at `claimrightful.com/app` does, with the same design, the same copy, and the same Supabase backend. Someone can start on the website and continue on their phone with the same account.

Built with Expo (React Native, SDK 57) and Expo Router.

## What's in it

| Website (`website/src`) | App (`mobile/src`) |
| --- | --- |
| Landing page | `app/intro.tsx`: the mark rises out of the splash screen, then the pitch and "Check what I'm owed" |
| `/app/start`: pick companies, scan, 3 questions, results, reminder schedule + email sign-up | `app/start.tsx` |
| `/app/sign-in`: email → 6-digit code | `app/sign-in.tsx` |
| `/app/paywall`: Monthly $4.99 / Yearly $39.99 | `app/paywall.tsx` (App Store on iPhone, Razorpay on Android) |
| `/app/welcome` | `app/welcome.tsx` |
| Home, Browse, Claims, Profile tabs | `app/(tabs)/*` |
| `/app/settlements/:id`: checklist, free claim, file on official site, mark as filed | `app/settlements/[id].tsx` |
| `lib/models.ts`, `brands.json`, `sample.ts` | Copied unchanged, so matching, totals, and sorting are identical |
| `lib/store.tsx` | Same logic and the same account sync rules, plus App Store purchases |
| Colors, fonts, check, cards (`styles.css`, `app.css`) | `theme/index.ts`, `components/*`, light and dark |

Differences that exist because it's a phone app:

- Official claim sites open in an in-app browser. When the person comes back, the app asks "Did you submit your claim?", just as the website does when the tab regains focus.
- "Share the win" shares a PNG of the PAID check through the phone's share sheet.
- Meta Pixel isn't included because it's web-only. Funnel events still go to `funnel_events`, with `detail` set to `ios-app` or `android-app` where the website records the browser type.

## Apple App Store compliance

What the iPhone app does to meet the [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/):

| Guideline | What the app does |
| --- | --- |
| 3.1.1 In-app purchase | Subscriptions are sold with StoreKit 2 (`expo-iap`), not Razorpay. No other way to pay is mentioned or linked on iPhone. |
| 3.1.1 Restore | "Restore purchases" on the paywall and in Profile. |
| 3.1.2 Subscriptions | The paywall shows the App Store's own localized prices, with the billed amount ("$39.99/year") as the most prominent price and per-month as secondary. It shows the renewal terms Apple requires, plus links to Terms of Use and Privacy Policy. |
| 3.1.2 Manage | Profile → "Manage subscription" opens Apple's subscription sheet. |
| 3.1.3(b) Multiplatform | A website (Razorpay) subscription unlocks the app, and an App Store one unlocks the website, through the same account. Website subscribers can still cancel their web plan in Profile. |
| 5.1.1(v) Accounts optional | People can use the app and subscribe without an account ("Skip for now"). A purchase is saved to their account automatically if they sign in later (`verify-purchase`). |
| 5.1.1(v) Account deletion | Profile → "Delete account and data". It explains that Apple billing must be canceled separately and links to Manage Subscription. |
| 5.1.1 / 5.1.2 Privacy | Privacy Policy link in the app. The privacy manifest (`PrivacyInfo.xcprivacy`, from `app.json`) declares no tracking, the data collected, and the required-reason APIs used by the app's libraries. No ad tracking, so no tracking prompt. |
| 2.1 App Review access | App Review can't receive sign-in codes, so one review address signs in with a password (see below). |
| 4.8 Sign in with Apple | Not required: sign-in is email only, with no third-party or social login. |
| Export compliance | `ITSAppUsesNonExemptEncryption = NO` is set, so no export question on each upload. |

Android keeps the website's Razorpay checkout. Google Play has a similar rule for digital subscriptions (Play Billing), which would need a Google Play verification function on the server before an Android release.

## Run it

Requirements: Node 20+.

```bash
cd mobile
npm install
cp .env.example .env.local   # same Supabase URL + publishable key as the website
npx expo start
```

- **Expo Go** (scan the QR code) runs everything except App Store purchases; StoreKit isn't part of Expo Go.
- **Purchases** need a real build. The simplest is TestFlight (see "Build and submit" below): TestFlight purchases are free test purchases with your own Apple ID. For a development build that reloads code live instead: `npx eas-cli@latest device:create`, then `npx eas-cli@latest build --profile development --platform ios`, and sign in on the iPhone with a Sandbox Apple ID (Settings → Developer → Sandbox Apple Account).

Without `.env.local` the app runs in clearly labeled sample mode, like the website. Never ship a store build without the Supabase values.

Checks:

```bash
npm run typecheck
npm run lint
npx expo-doctor
```

## Configuration

All values go in `.env.local` for development, or in EAS environment variables for builds (`npx eas-cli@latest env:create`). They're compiled into the app, so rebuild after changing them.

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Same as the website's `VITE_SUPABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `EXPO_PUBLIC_PRICE_YEARLY` / `EXPO_PUBLIC_PRICE_MONTHLY` | Android prices (match Razorpay). iPhone uses the App Store's prices. |
| `EXPO_PUBLIC_WEBSITE_URL` | `https://claimrightful.com` (Terms, Privacy, Support) |
| `EXPO_PUBLIC_ENABLE_EMAIL_REMINDERS` | `false` until email sending is set up |
| `EXPO_PUBLIC_REVIEW_EMAIL` | The App Review account's email, e.g. `appreview@claimrightful.com` |

App Store product IDs are in `src/lib/config.ts` (`APPLE_PRODUCT_IDS`).

## Publishing to the App Store

The code is ready; these are the steps that happen in Apple's and Supabase's dashboards.

### 1. Server (one time)

From the repo root:

```bash
npx supabase db push    # adds the new App Store product IDs (migration 20261010100000)
npx supabase secrets set \
  APPLE_BUNDLE_ID=com.claimrightful.app \
  APPLE_APP_ID=YOUR_NUMERIC_APPLE_ID \
  APPLE_TRANSACTION_ENVIRONMENT=both
npx supabase functions deploy verify-purchase
npx supabase functions deploy app-store-notifications --no-verify-jwt
```

`APPLE_APP_ID` is the numeric Apple ID shown in App Store Connect → App Information. Keep `APPLE_TRANSACTION_ENVIRONMENT=both`: App Review buys with Sandbox accounts. Both functions bundle Apple's root certificates, so deploy them with Docker running (not `--use-api`).

### 2. App Store Connect

1. **Create the app**: Apps → + → New App. Bundle ID `com.claimrightful.app` (register it under Certificates, Identifiers & Profiles first, or let EAS do it in step 3).
2. **Subscriptions**: Monetization → Subscriptions → create one group ("ClaimRightful Premium") with two auto-renewable subscriptions:

   | Reference name | Product ID | Duration | Price |
   | --- | --- | --- | --- |
   | Monthly | `com.claimrightful.app.monthly` | 1 month | $4.99 |
   | Yearly | `com.claimrightful.app.yearly` | 1 year | $39.99 |

   Give each a display name and description, and add a review screenshot of the paywall. On the first app version, attach both subscriptions under "In-App Purchases and Subscriptions" so they're reviewed together.
3. **Server notifications**: App Information → App Store Server Notifications → Production and Sandbox URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/app-store-notifications` (Version 2).
4. **App Review sign-in**: in Supabase → Authentication → Users → Add user, create `appreview@claimrightful.com` with a password and auto-confirm. Put the same address in `EXPO_PUBLIC_REVIEW_EMAIL`. In App Store Connect → App Review Information, enter that email and password. Suggested notes: "Enter the email on the Sign in screen and a password field appears. The app can also be used without signing in: tap Check what I'm owed, then Skip for now."
5. **Links**: Privacy Policy URL `https://claimrightful.com/privacy`, Support URL `https://claimrightful.com/support`. Add "Terms of Use: https://claimrightful.com/terms" to the description, or set it as a custom EULA. The site's terms already cover App Store billing and Apple's standard EULA.
6. **App Privacy** (nutrition label), matching the privacy manifest:
   - Contact Info → Email Address: linked to identity, app functionality.
   - Identifiers → User ID: linked, app functionality.
   - Purchases → Purchase History: linked, app functionality.
   - User Content → Other User Content (companies, states, claim IDs): linked, app functionality.
   - Usage Data → Product Interaction: linked, analytics.
   - Tracking: none.
7. **Age rating**: no objectionable content (likely 4+). **Category**: Finance. **Price**: Free (with in-app purchases).

### 3. Build and submit

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create   # the variables above, for the production environment
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios
```

`submit` uploads the build to TestFlight. It does not send the app for review. Once Apple finishes processing (about 10–30 minutes), add yourself under TestFlight → Internal Testing and install the TestFlight app on your iPhone. In-app purchases in TestFlight are free test purchases, and subscriptions renew every few minutes.

Test on TestFlight before submitting for review:

- buy monthly
- Restore Purchases on a reinstall
- Manage Subscription
- sign in afterwards and check the plan in Supabase (`profiles.plan_source = 'apple'`)
- check the website shows the plan too

To redraw the icons and splash: `python3 scripts/generate-icons.py` (requires Pillow).

## The older `Rightful/` folder

The SwiftUI app in `Rightful/` came before the current website. It still sells weekly plans and uses Apple/Google sign-in. This app replaces it and follows the website as it is today. Its old product IDs (`com.rightful.app.yearly` / `.weekly`) are still recognized by the server.
