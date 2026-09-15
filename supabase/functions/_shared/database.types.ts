export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          user_id: string;
          display_name: string | null;
          state_code: string | null;
          plan: "free" | "yearly" | "weekly";
          notifications_enabled: boolean;
          created_at: string;
          updated_at: string;
        }
      >;
      notification_devices: Table<
        {
          id: string;
          user_id: string;
          apns_token: string;
          environment: "sandbox" | "production";
          last_seen_at: string;
        }
      >;
      profile_brands: Table<
        {
          user_id: string;
          brand_id: string;
          created_at: string;
        }
      >;
      settlements: Table<
        {
          id: string;
          company: string;
          title: string;
          brand_id: string;
          payout_min: number;
          payout_max: number;
          deadline: string;
          payout_window_start: string | null;
          created_at: string;
          status: "draft" | "verified" | "closed";
          is_sample: boolean;
        }
      >;
      claims: Table<
        {
          id: string;
          user_id: string;
          settlement_id: string;
          status: "To file" | "Filed" | "Approved" | "Rejected" | "Paid";
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      record_purchase_event: {
        Args: {
          p_transaction_id: string;
          p_user_id: string;
          p_product_id: string;
          p_original_transaction_id: string;
          p_expires_at: string | null;
          p_revoked_at: string | null;
          p_signed_transaction_hash: string;
        };
        Returns: string;
      };
      existing_notification_ids: {
        Args: { p_ids: string[] };
        Returns: { id: string }[];
      };
      apply_subscription_status: {
        Args: {
          p_original_transaction_id: string;
          p_transaction_id: string;
          p_product_id: string;
          p_expires_at: string | null;
          p_revoked_at: string | null;
          p_signed_transaction_hash: string;
        };
        Returns: string | null;
      };
      record_notification_sent: {
        Args: {
          p_id: string;
          p_user_id: string;
          p_notification_type: string;
          p_payload: Json;
        };
        Returns: undefined;
      };
      register_notification_device: {
        Args: {
          p_apns_token: string;
          p_environment: "sandbox" | "production";
        };
        Returns: undefined;
      };
    };
    Enums: {
      settlement_status: "draft" | "verified" | "closed";
      claim_status: "To file" | "Filed" | "Approved" | "Rejected" | "Paid";
      plan_type: "free" | "yearly" | "weekly";
    };
    CompositeTypes: Record<string, never>;
  };
  private: {
    Tables: {
      purchase_events: Table<
        {
          transaction_id: string;
          user_id: string;
          product_id: string;
          original_transaction_id: string;
          expires_at: string | null;
          revoked_at: string | null;
          signed_transaction_hash: string;
          created_at: string;
          updated_at: string;
        },
        {
          transaction_id: string;
          user_id: string;
          product_id: string;
          original_transaction_id: string;
          expires_at: string | null;
          revoked_at: string | null;
          signed_transaction_hash: string;
        }
      >;
      subscription_owners: Table<
        {
          original_transaction_id: string;
          user_id: string;
          created_at: string;
        },
        {
          original_transaction_id: string;
          user_id: string;
        }
      >;
      notification_log: Table<
        {
          id: string;
          user_id: string;
          notification_type: string;
          payload: Json;
          sent_at: string;
        },
        {
          id: string;
          user_id: string;
          notification_type: string;
          payload: Json;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
