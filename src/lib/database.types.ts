// Hand-authored to match supabase/migrations/20260725000000_init.sql.
// Regenerate against a live/local project with: `npm run db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          phone_number: string | null;
          notify_whatsapp: boolean;
          glowup_age_confirmed_at: string | null;
          glowup_consent_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          phone_number?: string | null;
          notify_whatsapp?: boolean;
          glowup_age_confirmed_at?: string | null;
          glowup_consent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          invite_code?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Insert"]>;
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: "owner" | "member";
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role?: "owner" | "member";
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_members"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          metric_type: "percentage_change" | "streak";
          direction: "increase" | "decrease";
          unit: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          metric_type: "percentage_change" | "streak";
          direction?: "increase" | "decrease";
          unit?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      category_baselines: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          baseline_value: number;
          baseline_date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          baseline_value: number;
          baseline_date?: string;
        };
        Update: Partial<Database["public"]["Tables"]["category_baselines"]["Insert"]>;
        Relationships: [];
      };
      entries: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          period_start: string;
          period_end: string;
          raw_value: number;
          share_raw_value: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          period_start: string;
          period_end: string;
          raw_value: number;
          share_raw_value?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["entries"]["Insert"]>;
        Relationships: [];
      };
      leaderboard_rankings: {
        Row: {
          id: string;
          group_id: string;
          category_id: string;
          period_start: string;
          period_end: string;
          user_id: string;
          pct_change: number;
          is_absolute: boolean;
          rank: number;
          computed_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          category_id: string;
          period_start: string;
          period_end: string;
          user_id: string;
          pct_change: number;
          is_absolute?: boolean;
          rank: number;
          computed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leaderboard_rankings"]["Insert"]>;
        Relationships: [];
      };
      share_cards: {
        Row: {
          id: string;
          user_id: string;
          ranking_id: string | null;
          image_url: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ranking_id?: string | null;
          image_url?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["share_cards"]["Insert"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: "free" | "premium";
          status: string;
          paystack_customer_id: string | null;
          paystack_subscription_code: string | null;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier?: "free" | "premium";
          status?: string;
          paystack_customer_id?: string | null;
          paystack_subscription_code?: string | null;
          current_period_end?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      // ── Feature track A: habit stakes ──────────────────────────────────────
      stake_cohorts: {
        Row: {
          id: string;
          name: string;
          habit_type: "steps";
          target_value: number;
          start_date: string;
          end_date: string;
          stake_amount: number;
          fee_rate: number;
          status: "open" | "active" | "completed" | "cancelled";
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          habit_type?: "steps";
          target_value: number;
          start_date: string;
          end_date: string;
          stake_amount: number;
          fee_rate?: number;
          status?: "open" | "active" | "completed" | "cancelled";
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stake_cohorts"]["Insert"]>;
        Relationships: [];
      };
      stakes: {
        Row: {
          id: string;
          cohort_id: string;
          user_id: string;
          amount: number;
          payment_reference: string | null;
          payment_confirmed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          cohort_id: string;
          user_id: string;
          amount: number;
          payment_reference?: string | null;
          payment_confirmed?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stakes"]["Insert"]>;
        Relationships: [];
      };
      daily_verification_logs: {
        Row: {
          id: string;
          stake_id: string;
          log_date: string;
          verified_value: number | null;
          source: "manual" | "google_fit" | "apple_health" | "fitbit";
          created_at: string;
        };
        Insert: {
          id?: string;
          stake_id: string;
          log_date: string;
          verified_value?: number | null;
          source?: "manual" | "google_fit" | "apple_health" | "fitbit";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_verification_logs"]["Insert"]>;
        Relationships: [];
      };
      payouts: {
        Row: {
          id: string;
          cohort_id: string;
          user_id: string;
          amount: number;
          kind: "winnings" | "refund";
          status: "pending" | "paid" | "failed";
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cohort_id: string;
          user_id: string;
          amount: number;
          kind?: "winnings" | "refund";
          status?: "pending" | "paid" | "failed";
          paid_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payouts"]["Insert"]>;
        Relationships: [];
      };
      // ── Feature track B: glow-up coaching ──────────────────────────────────
      glowup_reports: {
        Row: {
          id: string;
          user_id: string;
          goal: "dating_profile" | "job_interview" | "general_confidence";
          budget_tier: "low" | "mid" | "high";
          style_preference: string | null;
          report_json: Json | null;
          status: "pending" | "ready" | "failed";
          payment_reference: string | null;
          payment_status: "pending" | "paid" | "refunded";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal: "dating_profile" | "job_interview" | "general_confidence";
          budget_tier: "low" | "mid" | "high";
          style_preference?: string | null;
          report_json?: Json | null;
          status?: "pending" | "ready" | "failed";
          payment_reference?: string | null;
          payment_status?: "pending" | "paid" | "refunded";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["glowup_reports"]["Insert"]>;
        Relationships: [];
      };
      glowup_photos: {
        Row: {
          id: string;
          user_id: string;
          report_id: string | null;
          storage_path: string;
          photo_type: "face" | "outfit";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          report_id?: string | null;
          storage_path: string;
          photo_type: "face" | "outfit";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["glowup_photos"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_group_by_code: { Args: { _code: string }; Returns: string };
      preview_group_by_code: {
        Args: { _code: string };
        Returns: { id: string; name: string; member_count: number }[];
      };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      whoami: { Args: Record<string, never>; Returns: string };
      is_cohort_member: { Args: { _cohort_id: string }; Returns: boolean };
      cohort_progress: {
        Args: { _cohort_id: string };
        Returns: {
          user_id: string;
          display_name: string;
          current_progress: number;
          target_value: number;
          hit_target: boolean;
          rank: number;
        }[];
      };
      delete_my_glowup_data: {
        Args: Record<string, never>;
        Returns: { deleted_path: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Handy row aliases used across the app.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type CategoryBaseline = Database["public"]["Tables"]["category_baselines"]["Row"];
export type Entry = Database["public"]["Tables"]["entries"]["Row"];
export type LeaderboardRanking = Database["public"]["Tables"]["leaderboard_rankings"]["Row"];
export type ShareCard = Database["public"]["Tables"]["share_cards"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
