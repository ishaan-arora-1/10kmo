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
          state_codes: string[];
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
          eligible_state_codes: string[];
          payout_min: number;
          payout_max: number;
          deadline: string;
          payout_window_start: string | null;
          created_at: string;
          published_at: string | null;
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
          p_signed_at: string;
          p_signed_transaction_hash: string;
        };
        Returns: string;
      };
      claim_notification_delivery: {
        Args: {
          p_id: string;
          p_user_id: string;
          p_device_id: string;
          p_notification_type: string;
          p_payload: Json;
        };
        Returns: boolean;
      };
      claim_pending_notification_deliveries: {
        Args: { p_limit?: number };
        Returns: {
          delivery_id: string;
          delivery_user_id: string;
          delivery_device_id: string;
          delivery_type: string;
          delivery_payload: Json;
          apns_token: string;
          apns_environment: "sandbox" | "production";
        }[];
      };
      apply_subscription_status: {
        Args: {
          p_notification_uuid: string;
          p_original_transaction_id: string;
          p_transaction_id: string;
          p_product_id: string;
          p_app_account_token: string | null;
          p_expires_at: string | null;
          p_revoked_at: string | null;
          p_signed_at: string;
          p_signed_transaction_hash: string;
        };
        Returns: string | null;
      };
      complete_notification_delivery: {
        Args: {
          p_id: string;
          p_result: "sent" | "failed" | "retry";
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
          signed_at: string;
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
          signed_at: string;
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
      pending_subscription_events: Table<
        {
          notification_uuid: string;
          transaction_id: string;
          original_transaction_id: string;
          product_id: string;
          app_account_token: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          signed_at: string;
          signed_transaction_hash: string;
          created_at: string;
        }
      >;
      notification_log: Table<
        {
          id: string;
          user_id: string;
          device_id: string | null;
          notification_type: string;
          payload: Json;
          status: "claimed" | "retry" | "sent" | "failed";
          attempt_count: number;
          attempted_at: string;
          next_attempt_at: string | null;
          sent_at: string | null;
        },
        {
          id: string;
          user_id: string;
          device_id?: string | null;
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
