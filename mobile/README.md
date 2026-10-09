# ClaimRightful app (iPhone + Android)

The ClaimRightful mobile app. It does everything the web app at `claimrightful.com/app` does, with the same design, the same copy, and the same Supabase backend. Someone can start on the website and continue on their phone with the same account.

Built with Expo (React Native, SDK 57) and Expo Router. Nothing in `website/` or `supabase/` was changed for it.

## What's in it

| Website (`website/src`) | App (`mobile/src`) |
| --- | --- |
| `/app/start`: pick companies, scan, 3 questions, results, reminder schedule + email sign-up | `app/start.tsx` |
| `/app/sign-in`: email → 6-digit code | `app/sign-in.tsx` |
| `/app/paywall`: Monthly $4.99 / Yearly $39.99 through Razorpay | `app/paywall.tsx` |
| `/app/welcome` | `app/welcome.tsx` |
| Home, Browse, Claims, Profile tabs | `app/(tabs)/*` |
| `/app/settlements/:id`: checklist, free claim, file on official site, mark as filed | `app/settlements/[id].tsx` |
| `lib/models.ts`, `brands.json`, `sample.ts` | Copied unchanged, so matching, totals, and sorting are identical |
| `lib/store.tsx` | Same logic and the same account sync rules; data stays on the device until sign-in |
| Colors, fonts, check, cards (`styles.css`, `app.css`) | `theme/index.ts`, `components/*`, light and dark |

Differences that exist because it's a phone app:

- Official claim sites open in an in-app browser. When the person comes back, the app asks "Did you submit your claim?", just as the website does when the tab regains focus.
- Razorpay Checkout runs in a WebView inside the app instead of a browser popup. It uses the same plans and the same `razorpay-subscribe` and `razorpay-verify` functions.
- "Share the win" shares a PNG of the PAID check through the phone's share sheet.
- There's no landing page, so the app opens on company picking until the person has a dashboard.
- Meta Pixel isn't included because it's web-only. Funnel events still go to `funnel_events`, with `detail` set to `ios-app` or `android-app` where the website records the browser type.

## Run it

Requirements: Node 20+, and the Expo Go app on your phone (or an iOS simulator or Android emulator).

```bash
cd mobile
npm install
cp .env.example .env.local   # optional: same Supabase URL + publishable key as the website
npx expo start               # scan the QR code with Expo Go
```

Without `.env.local` the app runs in clearly labeled sample mode, like the website.

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
| `EXPO_PUBLIC_PRICE_YEARLY` / `EXPO_PUBLIC_PRICE_MONTHLY` | Same as the website's price labels |
| `EXPO_PUBLIC_WEBSITE_URL` | `https://claimrightful.com` (Terms, Privacy, Support) |
| `EXPO_PUBLIC_ENABLE_EMAIL_REMINDERS` | `false` until email sending is set up |

No backend changes are needed:

- Email-code sign-in needs no redirect URLs.
- Edge functions accept calls from the app as they are, because app requests don't send a browser `Origin`, so CORS never applies.
- Razorpay webhooks keep updating plans as they do for the website.

## Build and publish

Uses [EAS](https://docs.expo.dev/deploy/build-project/). No Mac is needed for the builds.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                              # links the project to your Expo account
npx eas-cli@latest build --platform all --profile preview      # installable test builds
npx eas-cli@latest build --platform all --profile production   # store builds
npx eas-cli@latest submit --platform ios             # App Store Connect / TestFlight
npx eas-cli@latest submit --platform android         # Google Play Console
```

The bundle ID and package name are both `com.claimrightful.app`. Change them in `app.json` before the first store build if you want something else. To redraw the icons and splash: `python3 scripts/generate-icons.py` (requires Pillow).

### Before submitting: payments and store rules

The app sells the website's Razorpay subscriptions inside the app. Apple and Google normally require their own in-app purchase for digital subscriptions. Court rulings now let US apps point people to outside payment, but that covers sending people out of the app; paying in a WebView inside the app is a gray area, and App Review or Play review may reject it. Choose one of these before you submit:

1. **Keep Razorpay.** Submit for the US storefront only and be ready to explain it to review.
2. **Pay on the website.** Open the website's paywall in the browser instead of the in-app checkout. A web subscription unlocks the app automatically, because the plan is stored on the account.
3. **Use Apple and Google in-app purchase.** The backend already verifies Apple purchases (`verify-purchase`, `plan_source = 'apple'`). It would need App Store products for monthly and yearly (only yearly and weekly are mapped today), plus a Google Play verification function.

## The older `Rightful/` folder

The SwiftUI app in `Rightful/` came before the current website. It still sells weekly plans and uses Apple/Google sign-in. This app replaces it and follows the website as it is today. Both can stay in the repo; they don't share any files.
