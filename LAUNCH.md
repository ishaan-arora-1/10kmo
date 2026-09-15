# Rightful launch checklist

Do these in order. Each step says where to click and what to copy. Keep a private note with every value marked **SAVE**. Never commit those values to git.

Status: all planned app code is in. `db push` also loads a ~230-company catalog and adds the `state_codes` column. If you already ran step 5 before pulling, run `npx supabase db push` again and re-run the function deploys in step 5.6.

---

## 0. Decide two things first (5 min)

- **Bundle ID:** `com.rightful.app`. If Apple says it's taken in step 1.1, pick another, for example `com.yourname.rightful`, and tell Claude, who will update the code.
- **Domain + support email:** the app and website use `support@rightful.app`. Buy a domain (for example `rightful.app`, or a variant if it's taken) and set up that inbox. ImprovMX gives free forwarding to your Gmail. Tell Claude the final domain and email.

## 1. Apple Developer ([developer.apple.com/account](https://developer.apple.com/account))

1. **Identifiers → + → App IDs → App**
   - Bundle ID (explicit): `com.rightful.app`
   - Capabilities: **Sign in with Apple** and **Push Notifications**
2. **Keys → +**: name it "Rightful APNs" and tick **Apple Push Notifications service (APNs)**. Download the `.p8` file (you can only download it once).
   - **SAVE:** Key ID, `.p8` file
3. **Membership details**: **SAVE:** Team ID

## 2. App Store Connect ([appstoreconnect.apple.com](https://appstoreconnect.apple.com))

1. **Business → Agreements**: sign the **Paid Apps** agreement and add bank and tax info. Subscriptions won't load until it's **Active**.
2. **Apps → + → New App**: iOS, name "Rightful" (if taken: "Rightful: Settlement Finder"), bundle ID from step 1.1, SKU `rightful-ios`.
   - **SAVE:** the numeric **Apple ID** under App Information (this is `APPLE_APP_ID`)
3. **Monetization → Subscriptions → Create group** "Rightful Premium", then add:
   | Reference name | Product ID | Duration | Price | Intro offer |
   |---|---|---|---|---|
   | Rightful Yearly | `com.rightful.app.yearly` | 1 year | $39.99 | Free trial, 3 days |
   | Rightful Weekly | `com.rightful.app.weekly` | 1 week | $4.99 | none |
   - For each: add a localization (display name + description) and a **Review screenshot** of the paywall.
4. **Users and Access → Sandbox → Test Accounts → +**: create a sandbox tester for purchase testing.
5. **App Information**:
   - Category: **Finance**
   - Privacy Policy URL: `https://YOUR_DOMAIN/privacy`
   - **App Store Server Notifications**, Version 2, for both Production and Sandbox: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/app-store-notifications` (fill this in after step 5)
6. **App Privacy** (Data Types), all "linked to the user", "not used for tracking":
   - Contact Info → Name, Email Address (App Functionality)
   - Identifiers → User ID (App Functionality)
   - Purchases → Purchase History (App Functionality)
   - User Content → Other User Content (the companies picked and claim progress) (App Functionality)
7. **Age Rating**: answer the questionnaire (no objectionable content).
8. Version page: Support URL `https://YOUR_DOMAIN/support`, Marketing URL `https://YOUR_DOMAIN`.

## 3. Google sign-in ([console.cloud.google.com](https://console.cloud.google.com))

1. Create project "Rightful".
2. **APIs & Services → OAuth consent screen**: External, app name Rightful, support email, privacy URL. Publish the app when you're ready.
3. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - **SAVE:** Client ID, Client secret

## 4. Supabase project ([supabase.com/dashboard](https://supabase.com/dashboard))

1. **New project**: name `rightful`, region **East US**, strong DB password (**SAVE**).
2. **Project Settings → General**: **SAVE:** Project ref.
3. **Project Settings → API Keys**: **SAVE:** Project URL and **publishable** key.
4. **API Keys → Secret keys → New secret key** named exactly `automations`. **SAVE** it.
5. **Authentication → Sign In / Providers**:
   - **Apple**: enable; Client IDs = `com.rightful.app`
   - **Google**: enable; paste Client ID and secret from step 3
6. **Authentication → URL Configuration → Redirect URLs**: add `rightful://auth/callback`

## 5. Database + server functions (Terminal, in the repo folder)

Install and open **Docker Desktop** first (needed to deploy the Apple functions).

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`db push` creates the tables. It does **not** load the sample data, which is correct for production.

Set secrets. Note `APPLE_TRANSACTION_ENVIRONMENT=both`: Apple's reviewers buy with sandbox accounts, so production must accept sandbox purchases or review breaks.

```bash
npx supabase secrets set \
  APPLE_BUNDLE_ID=com.rightful.app \
  APPLE_APP_ID=YOUR_NUMERIC_APPLE_ID \
  APPLE_TRANSACTION_ENVIRONMENT=both \
  APPLE_APNS_KEY_ID=YOUR_KEY_ID \
  APPLE_TEAM_ID=YOUR_TEAM_ID \
  APPLE_APNS_PRIVATE_KEY="$(cat /path/to/AuthKey_YOUR_KEY_ID.p8)"
```

Deploy (step 5.6, re-run after code updates):

```bash
npx supabase functions deploy verify-purchase
npx supabase functions deploy delete-account
npx supabase functions deploy app-store-notifications --no-verify-jwt
npx supabase functions deploy notify --no-verify-jwt
```

7. **Daily notifications**: Dashboard → **Integrations → Cron → Create job**
   - Name `daily-notify`, schedule `0 15 * * *` (11am US Eastern)
   - Type: HTTP request, **POST** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify`
   - Header `apikey: <your automations secret key>`
8. Go back to step 2.5 and paste the App Store Server Notifications URL.

## 6. Connect the app (Xcode)

1. In the repo: `cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig` (it's git-ignored), then fill in:
   ```
   SUPABASE_URL = https:/$()/YOUR_PROJECT_REF.supabase.co
   SUPABASE_PUBLISHABLE_KEY = sb_publishable_...
   DEVELOPMENT_TEAM = YOUR_TEAM_ID
   ```
   Keep the `https:/$()/` spelling. It stops Xcode treating `//` as a comment.
2. Open `Rightful.xcodeproj` → target **Rightful** → **Signing & Capabilities**: choose your team and confirm **Sign in with Apple** and **Push Notifications** are listed.
3. Run on a **real iPhone** (Settings → App Store → Sandbox Account: sign in with your tester). Check that:
   - onboarding → matches → paywall → purchase works
   - Restore purchases works
   - Apple sign-in and Google sign-in both work
   - file a claim → "Did you submit?" → Claims tab
   - Profile → Delete account works

## 7. Real settlement data (the big one)

The app shows only what's in the `settlements` table with `status = verified`. Before submitting:

1. Add ~40 **currently open** settlements from official administrator sites. Claude can draft these as SQL from official notices; **you** must check each one against the notice.
2. Each needs: company brand, payout range, deadline, proof required, a plain-English "who qualifies" summary, 2 eligibility checkboxes, `claim_url` (official site), `official_notice_url`, and `source_checked_at` (the database refuses to publish without these).
3. The company picker already has ~230 brands from the `brand_catalog` migration. Add a brand row whenever a new settlement names a company that isn't listed.
4. If a settlement only covers certain states, fill `eligible_state_codes` (for example `{CA,IL}`). Only users who picked one of those states will match or be notified.
5. Re-check weekly: close expired settlements and add new ones.

## 8. Website

1. [vercel.com](https://vercel.com) → **Add New → Project** → import `ishaan-arora-1/10kmo` → **Root Directory: `website`** → Deploy.
2. **Settings → Domains**: add your domain and follow the DNS instructions.
3. Check `/privacy`, `/terms` and `/support` load. These are the App Store URLs.

## 9. Ship

1. Xcode → **Product → Archive** → **Distribute App → App Store Connect → Upload**.
2. TestFlight: install on your phone and repeat the step 6.3 checks with production data.
3. App Store Connect → version page: screenshots (6.9" and 6.5"), description, keywords, attach both subscriptions to the version, review notes:
   > Rightful helps users find class-action settlements and links to official administrator claim sites. It is not a law firm and does not file claims. Sign in is optional for browsing; use Sign in with Apple to test syncing. Subscriptions can be tested with a sandbox account.
4. **Submit for Review.**
