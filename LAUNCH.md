# Rightful launch checklist: website

This gets the **website and web app** live: the landing page, legal pages, and the full app at `/app`, with Google sign-in, real settlements, and Razorpay subscriptions.

**Not in this checklist (on purpose):** the iPhone app (App Store, Apple sign-in, push notifications) and email reminders. The code for both is already in the repo; they'll get their own steps when you're ready.

Do the steps **in order**. Whenever you see **SAVE**, copy the value into a private note. Never commit those values to git.

**Accounts you'll need:** GitHub (you already have the repo), Vercel, Supabase, Google Cloud (any Gmail works), and Razorpay.

**On your Mac:** Node.js 20 or newer (`node -v` to check). Nothing else.

---

## 1. Support email (10 min)

The website shows a support email on every page, and Razorpay and Google both ask for one.

1. Create a free Gmail just for Rightful, for example `rightful.help.yourname@gmail.com`. **SAVE** it.
2. In Terminal, from the repo folder:
   ```bash
   git pull
   scripts/set-support-email.sh YOUR_SUPPORT_GMAIL
   git add -A
   git commit -m "Set support email"
   git push
   ```

## 2. Put the website online with Vercel (10 min)

Do this first. It gives you the web address every later step needs.

1. Go to [vercel.com](https://vercel.com) and **Sign Up → Continue with GitHub**.
2. **Add New… → Project** → find `10kmo` → **Import**.
3. **Project Name:** `rightful` (Vercel uses it for your address; if it's taken, pick another, like `rightful-claims`).
4. **Root Directory:** click **Edit** and choose `website`. Vercel detects **Vite** automatically.
5. Click **Deploy** and wait about a minute.
6. Open **Settings → Domains** and copy the `.vercel.app` address. **SAVE** it as **YOUR_SITE**, e.g. `https://rightful.vercel.app` (no slash at the end).
7. Check that these open: `YOUR_SITE`, `YOUR_SITE/privacy`, `YOUR_SITE/terms`, `YOUR_SITE/support`, `YOUR_SITE/app`.
   The app runs in **sample mode** for now; that's expected until step 6.

## 3. Create the database (Supabase) (15 min)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   - Name: `rightful`
   - Database password: click **Generate**, then **SAVE** it
   - Region: **East US (North Virginia)**
2. When it's ready, open **Project Settings → General**. **SAVE** the **Project ID** as **YOUR_PROJECT_REF** (a string like `abcdxyzabcdxyz`).
3. **Project Settings → API Keys.** **SAVE** the **Project URL** (`https://YOUR_PROJECT_REF.supabase.co`) and the **Publishable key** (`sb_publishable_…`).
4. **Authentication → URL Configuration:**
   - **Site URL:** `YOUR_SITE`
   - **Redirect URLs → Add URL:** `YOUR_SITE/app/**` (and optionally `http://localhost:5173/app/**` for testing on your Mac)
   - **Save**

Now load the tables, the 245 companies, and the real open settlements. In Terminal, from the repo folder:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

- `login` opens your browser once.
- `link` asks for the database password from 3.1.
- `db push` lists the migrations and asks you to confirm; type `Y`.

To check it worked: **Table Editor → settlements** should show 24 rows (22 settlements; the two Hyundai/Kia settlements have a row each for Hyundai and Kia), and **brands** should show 245.

## 4. Google sign-in (15 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), sign in with your support Gmail, and create a project named `Rightful`.
2. **APIs & Services → OAuth consent screen → Get started:**
   - App name: `Rightful`
   - User support email and developer contact: your support Gmail
   - Audience: **External**
   - Finish, then open **Audience** and click **Publish app**. With just email and profile access, Google doesn't require a review.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application**
   - Name: `Rightful web`
   - **Authorized redirect URIs → Add URI:** `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - **Create.** **SAVE** the **Client ID** and **Client secret**.
4. Back in Supabase: **Authentication → Sign In / Providers → Google** → turn it on, paste the Client ID and Client secret → **Save**.

## 5. Razorpay payments (30 min, plus activation time)

Start in **Test Mode** (the toggle at the top of the Razorpay dashboard). You can finish every step and test real flows before your account is activated.

1. Sign up at [razorpay.com](https://razorpay.com) and start **account activation** (business details, bank account, documents). Live payments only work after Razorpay approves this, which can take a few days.
2. Ask Razorpay to enable **International payments** (Account & Settings → International payments, or contact support). You need this to charge US customers in USD.
   - *If they won't approve it:* create the plans below in **INR** instead, and in step 6 set the price labels to match (e.g. `₹3,299`).
3. **Subscriptions → Plans → Create Plan**, twice:
   | Plan name | Billing frequency | Amount | Currency |
   |---|---|---|---|
   | Rightful Yearly | Yearly, every 1 year | 39.99 | USD |
   | Rightful Weekly | Weekly, every 1 week | 4.99 | USD |
   **SAVE** both plan IDs (`plan_…`).
4. **Account & Settings → API Keys → Generate Test Key.** **SAVE** the **Key ID** (`rzp_test_…`) and **Key Secret** (shown only once).
5. **Account & Settings → Webhooks → Add New Webhook:**
   - Webhook URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook`
   - Secret: make up a long random password. **SAVE** it as **WEBHOOK_SECRET**.
   - Active events: tick every event under **subscription** (authenticated, activated, charged, pending, halted, cancelled, completed, paused, resumed, updated).
   - **Create Webhook**

## 6. Connect everything (15 min)

**6a. Server secrets.** In Terminal, from the repo folder (keep the quotes and the backslashes):

```bash
npx supabase secrets set \
  RAZORPAY_KEY_ID=rzp_test_... \
  RAZORPAY_KEY_SECRET=... \
  RAZORPAY_WEBHOOK_SECRET=... \
  RAZORPAY_PLAN_YEARLY=plan_... \
  RAZORPAY_PLAN_WEEKLY=plan_... \
  WEB_APP_URL=YOUR_SITE \
  WEB_APP_ORIGINS=YOUR_SITE
```

**6b. Deploy the server functions:**

```bash
npx supabase functions deploy razorpay-subscribe --use-api
npx supabase functions deploy razorpay-verify --use-api
npx supabase functions deploy razorpay-cancel --use-api
npx supabase functions deploy razorpay-webhook --no-verify-jwt --use-api
npx supabase functions deploy delete-account --use-api
```

**6c. Website settings.** In Vercel: your project → **Settings → Environment Variables**. Add these for **Production** (and Preview):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Project URL from 3.3 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your Publishable key from 3.3 |
| `VITE_PRICE_YEARLY` | `$39.99` (or your INR price) |
| `VITE_PRICE_WEEKLY` | `$4.99` (or your INR price) |

Then **Deployments** → the latest one → **⋯ → Redeploy**. The website only reads these when it's built, so the redeploy is required.

## 7. Test the whole flow (15 min)

Open `YOUR_SITE/app` in a private browser window:

1. Pick a few companies (for example **CVS**, **Kroger**, **Toyota**) → **Check open settlements**. You should see real settlements, with **no** "Sample data" labels.
2. **Start claiming** → **Continue with Google** → you come back signed in and land on the paywall.
3. Choose **Weekly** → pay with a Razorpay **test card**. In the Razorpay dashboard: **Docs → Test card details**. Use a card that supports recurring payments.
4. You should land on **Home** with filing unlocked. Open a settlement, tick both boxes, and **File on official site** opens the real claim site in a new tab. Come back and **mark it as filed**; it appears in **Claims**.
5. **Profile** should show **Rightful Premium · Weekly · Renews …** Tap **Cancel subscription**; it should change to **Ends …**
6. In Razorpay (Test Mode) → **Subscriptions**, you should see the subscription, and under **Webhooks** the events should show as delivered.
7. Also try **Yearly** with a different Google account; it should say the first 3 days are free.

If something fails: Supabase → **Edge Functions → (function name) → Logs** shows the exact error.

## 8. Go live with real payments

Once Razorpay has **activated** your account (and approved international payments):

1. Switch Razorpay to **Live Mode**, and redo **5.3** (plans), **5.4** (live key `rzp_live_…`) and **5.5** (webhook). Live mode has its own plans, keys and webhooks.
2. Run **6a** again with the live values. You don't need to redeploy the functions.
3. Buy one real weekly subscription yourself, check that it works, then cancel it in Profile.

You're live. Share `YOUR_SITE` anywhere.

---

## Keeping settlements current

The database already has **22 real settlements that were open on September 16, 2026**, with deadlines between October 2026 and April 2027. Each one was checked on its official settlement website, or, where that site blocked automated access, against news coverage and claim trackers. Settlements disappear from the app automatically after their deadline.

About once a week, ask Claude: *"Draft new open settlements for Rightful."* You'll get a new migration file. Then run:

```bash
git pull
npx supabase db push
```

## Later (not needed now)

- **iPhone app:** App Store Connect, Apple sign-in, in-app purchases, and push notifications. Ask Claude to add these steps when you're ready.
- **Email reminders:** need your own domain for sending email. The code is in place and switched off.
- **Custom domain:** add it in Vercel → Settings → Domains, then update **Site URL** (3.4), `WEB_APP_URL`/`WEB_APP_ORIGINS` (6a), and redeploy.
