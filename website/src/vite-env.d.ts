/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PRICE_YEARLY?: string;
  readonly VITE_PRICE_MONTHLY?: string;
  readonly VITE_ENABLE_EMAIL_REMINDERS?: string;
  readonly VITE_PADDLE_CLIENT_TOKEN?: string;
  readonly VITE_PADDLE_ENV?: string;
  readonly VITE_PADDLE_PRICE_MONTHLY?: string;
  readonly VITE_PADDLE_PRICE_YEARLY?: string;
  readonly VITE_GUMROAD_MONTHLY_URL?: string;
  readonly VITE_GUMROAD_YEARLY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
