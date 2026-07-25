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
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          phone_number?: string | null;
          notify_whatsapp?: boolean;
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
    };
    Views: Record<string, never>;
    Functions: {
      join_group_by_code: { Args: { _code: string }; Returns: string };
      preview_group_by_code: {
        Args: { _code: string };
        Returns: { id: string; name: string; member_count: number }[];
      };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
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
