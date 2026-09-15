# Rightful

Rightful is a native iOS app that finds matching class-action settlements, guides users to official claim sites, and tracks claims through payout.

The app follows the supplied Rightful Blueprint: users pick companies, see estimated matches before the paywall, subscribe only when they are ready to file, and can track a claim through “I got paid.”

## What is included

- Native SwiftUI app for iOS 17+
- Complete onboarding, on-device matching, reveal, paywall, sign-in, filing, confirmation, claims, payout, and profile flows
- Light and dark themes matching the paper/ink/green design
- StoreKit 2 yearly and weekly subscriptions with a local StoreKit test configuration
- Sign in with Apple and Google through Supabase Auth
- Supabase Postgres schema, strict row-level security, sample seed data, and account deletion
- Apple transaction verification using Apple’s official server library
- Daily APNs job for new matches, deadlines, weekly digests, and payout windows
- Local notifications as an offline fallback
- Unit tests for matching and claim persistence

All built-in settlements are marked `SAMPLE DATA`. They are never represented as live claims.

## Run the iOS app

Requirements:

- macOS with Xcode 16.4 or newer
- iOS 17+ simulator or device
- XcodeGen 2.46.0 only if regenerating the project

Open `Rightful.xcodeproj` and run the shared `Rightful` scheme. The scheme uses `Rightful/Resources/Products.storekit`, so both subscription products work without App Store Connect.

The app runs without credentials in sample mode. Apple/Google cloud sign-in is replaced by a clearly labeled sample-mode continuation, while all other flows remain usable.

To regenerate the Xcode project:

```bash
brew install xcodegen
xcodegen generate
```

## Run the website and web app

The `website/` folder is a Vite + React project. It serves the marketing pages (`/`, `/privacy`, `/terms`, `/support`) and the full web app at `/app`, which does everything the iPhone app does against the same Supabase backend.

```bash
cd website
cp .env.example .env.local   # optional: add your Supabase URL and publishable key
npm install
npm run dev                  # http://localhost:5173 and http://localhost:5173/app
```

Without `.env.local` the web app runs in clearly labeled sample mode. Web subscriptions use Stripe and unlock the iPhone app too; web reminders are sent by email (Resend).

## Connect Supabase

1. Create a Supabase project.
2. Copy `Config/Secrets.xcconfig.example` to `Config/Secrets.xcconfig`.
3. Add the project URL, **publishable** key, and Apple Developer team ID.
   Never put a secret/service-role key in the app.
4. Link and deploy the database:

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

5. Enable Apple and Google providers in Supabase Auth.
6. Add `rightful://auth/callback` to the allowed redirect URLs.

For local database development (Docker required):

```bash
npx supabase start
npx supabase db reset
```

## Deploy server functions

Set the production secrets:

```bash
npx supabase secrets set \
  APPLE_BUNDLE_ID=com.rightful.app \
  APPLE_APP_ID=YOUR_NUMERIC_APP_ID \
  APPLE_TRANSACTION_ENVIRONMENT=both \
  APPLE_APNS_KEY_ID=YOUR_APNS_KEY_ID \
  APPLE_TEAM_ID=YOUR_TEAM_ID \
  APPLE_APNS_PRIVATE_KEY="$(cat AuthKey_YOUR_KEY.p8)"
```

Then deploy:

```bash
npx supabase functions deploy verify-purchase
npx supabase functions deploy delete-account
npx supabase functions deploy app-store-notifications --no-verify-jwt
npx supabase functions deploy notify --no-verify-jwt
```

Run these deployments with Docker available. The Apple verification functions
bundle root certificates through `static_files`, which Supabase cannot deploy
through its API-only fallback.

Create a named Supabase secret API key called `automations`. Schedule a daily POST to the `notify` function with that key in the `apikey` header.

The notification function uses Apple APNs directly. Production requires an APNs key, the Apple team ID, and device-token registration wiring in the Apple Developer portal.

In App Store Connect, set the Version 2 App Store Server Notifications URL to the deployed `app-store-notifications` function. It verifies Apple’s signed payload before changing subscription state. Keep `APPLE_TRANSACTION_ENVIRONMENT=both` in production: App Review purchases with Sandbox accounts, and rejecting those transactions would break review. Sandbox purchases only affect the server-side plan used for notifications.

## App Store Connect

Create one subscription group with:

| Product | ID | Price |
| --- | --- | --- |
| Rightful Yearly | `com.rightful.app.yearly` | $39.99/year, 3-day free trial |
| Rightful Weekly | `com.rightful.app.weekly` | $4.99/week |

Before release, replace `com.rightful.app` if needed in `project.yml`, `AppConstants`, StoreKit configuration, Supabase secrets, and App Store Connect.

## Settlement publishing workflow

Production settlements must:

1. be drafted from an official notice,
2. include the official notice URL,
3. be checked by a human editor,
4. record `source_checked_at`,
5. only then move to `verified`.

The database prevents an unlabeled, unverified record from being published as live. Company logos are intentionally not used.

## Infrastructure note

Railway is not required for the first production slice: Supabase already hosts the database, Auth, scheduled functions, and API. Adding Railway now would duplicate those responsibilities. It can be introduced later for a settlement-ingestion/admin service if that workload outgrows Edge Functions.
