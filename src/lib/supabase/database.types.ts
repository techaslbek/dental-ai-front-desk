// Generated from the Supabase schema. Regenerate after every migration:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
// (or the Supabase MCP `generate_typescript_types` tool). Do not edit by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_requests: {
        Row: {
          clinic_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          conversation_id: string | null
          created_at: string
          dentist_id: string | null
          id: string
          notes: string | null
          patient_name: string
          patient_phone: string
          preferred_date: string | null
          preferred_time: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          dentist_id?: string | null
          id?: string
          notes?: string | null
          patient_name: string
          patient_phone: string
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          dentist_id?: string | null
          id?: string
          notes?: string | null
          patient_name?: string
          patient_phone?: string
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_conversation_id_clinic_id_fkey"
            columns: ["conversation_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "appointment_requests_dentist_id_clinic_id_fkey"
            columns: ["dentist_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "dentists"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "appointment_requests_service_id_clinic_id_fkey"
            columns: ["service_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          clinic_id: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          clinic_id: string
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          clinic_id?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          created_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_profiles: {
        Row: {
          about_ru: string | null
          about_uz: string | null
          address_ru: string | null
          address_uz: string | null
          clinic_id: string
          maps_url: string | null
          opening_hours: Json
          phone: string | null
          telegram: string | null
          updated_at: string
        }
        Insert: {
          about_ru?: string | null
          about_uz?: string | null
          address_ru?: string | null
          address_uz?: string | null
          clinic_id: string
          maps_url?: string | null
          opening_hours?: Json
          phone?: string | null
          telegram?: string | null
          updated_at?: string
        }
        Update: {
          about_ru?: string | null
          about_uz?: string | null
          address_ru?: string | null
          address_uz?: string | null
          clinic_id?: string
          maps_url?: string | null
          opening_hours?: Json
          phone?: string | null
          telegram?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          created_at: string
          default_locale: string
          id: string
          message_retention_days: number
          name: string
          plan_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_locale?: string
          id?: string
          message_retention_days?: number
          name: string
          plan_id?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_locale?: string
          id?: string
          message_retention_days?: number
          name?: string
          plan_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: string
          clinic_id: string
          closed_at: string | null
          consent_at: string
          id: string
          last_message_at: string
          locale: string | null
          started_at: string
          status: Database["public"]["Enums"]["conversation_status"]
          visitor_id: string
        }
        Insert: {
          channel?: string
          clinic_id: string
          closed_at?: string | null
          consent_at: string
          id?: string
          last_message_at?: string
          locale?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          visitor_id: string
        }
        Update: {
          channel?: string
          clinic_id?: string
          closed_at?: string | null
          consent_at?: string
          id?: string
          last_message_at?: string
          locale?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      dentists: {
        Row: {
          bio_ru: string | null
          bio_uz: string | null
          clinic_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          sort_order: number
          specialty_ru: string | null
          specialty_uz: string | null
          updated_at: string
        }
        Insert: {
          bio_ru?: string | null
          bio_uz?: string | null
          clinic_id: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          sort_order?: number
          specialty_ru?: string | null
          specialty_uz?: string | null
          updated_at?: string
        }
        Update: {
          bio_ru?: string | null
          bio_uz?: string | null
          clinic_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          specialty_ru?: string | null
          specialty_uz?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dentists_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer_ru: string | null
          answer_uz: string | null
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean
          question_ru: string | null
          question_uz: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_ru?: string | null
          answer_uz?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          question_ru?: string | null
          question_uz?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_ru?: string | null
          answer_uz?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question_ru?: string | null
          question_uz?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faqs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      handoffs: {
        Row: {
          claimed_by: string | null
          clinic_id: string
          conversation_id: string
          created_at: string
          id: string
          reason: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["handoff_status"]
        }
        Insert: {
          claimed_by?: string | null
          clinic_id: string
          conversation_id: string
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["handoff_status"]
        }
        Update: {
          claimed_by?: string | null
          clinic_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["handoff_status"]
        }
        Relationships: [
          {
            foreignKeyName: "handoffs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_conversation_id_clinic_id_fkey"
            columns: ["conversation_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      messages: {
        Row: {
          author_user_id: string | null
          clinic_id: string
          content: string
          conversation_id: string
          created_at: string
          id: number
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          role: Database["public"]["Enums"]["message_role"]
        }
        Insert: {
          author_user_id?: string | null
          clinic_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: never
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role: Database["public"]["Enums"]["message_role"]
        }
        Update: {
          author_user_id?: string | null
          clinic_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: never
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role?: Database["public"]["Enums"]["message_role"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_clinic_id_fkey"
            columns: ["conversation_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          monthly_conversation_limit: number
          monthly_message_limit: number
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          monthly_conversation_limit: number
          monthly_message_limit: number
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_conversation_limit?: number
          monthly_message_limit?: number
          name?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          clinic_id: string
          created_at: string
          currency: string
          description_ru: string | null
          description_uz: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          name_ru: string
          name_uz: string
          price_max: number | null
          price_min: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          currency?: string
          description_ru?: string | null
          description_uz?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name_ru: string
          name_uz: string
          price_max?: number | null
          price_min?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          currency?: string
          description_ru?: string | null
          description_uz?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name_ru?: string
          name_uz?: string
          price_max?: number | null
          price_min?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_monthly: {
        Row: {
          clinic_id: string
          conversations: number
          input_tokens: number
          messages: number
          month: string
          output_tokens: number
        }
        Insert: {
          clinic_id: string
          conversations?: number
          input_tokens?: number
          messages?: number
          month: string
          output_tokens?: number
        }
        Update: {
          clinic_id?: string
          conversations?: number
          input_tokens?: number
          messages?: number
          month?: string
          output_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_monthly_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      create_clinic: {
        Args: { p_default_locale?: string; p_name: string; p_slug: string }
        Returns: string
      }
      record_usage: {
        Args: {
          p_clinic_id: string
          p_conversations: number
          p_input_tokens: number
          p_messages: number
          p_output_tokens: number
        }
        Returns: undefined
      }
    }
    Enums: {
      appointment_status: "requested" | "contacted" | "confirmed" | "cancelled"
      conversation_status: "open" | "handoff" | "closed"
      handoff_status: "pending" | "claimed" | "resolved"
      member_role: "owner" | "staff"
      message_role: "patient" | "assistant" | "staff" | "system"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["requested", "contacted", "confirmed", "cancelled"],
      conversation_status: ["open", "handoff", "closed"],
      handoff_status: ["pending", "claimed", "resolved"],
      member_role: ["owner", "staff"],
      message_role: ["patient", "assistant", "staff", "system"],
    },
  },
} as const
