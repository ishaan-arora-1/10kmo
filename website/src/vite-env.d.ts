/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PRICE_YEARLY?: string;
  readonly VITE_PRICE_MONTHLY?: string;
  readonly VITE_ENABLE_EMAIL_REMINDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
