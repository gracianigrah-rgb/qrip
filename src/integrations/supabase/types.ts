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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      billing_settings: {
        Row: {
          currency: string
          daily_export_price: number
          id: number
          instructions: string | null
          monthly_price: number
          payment_link: string | null
          payment_number: string | null
          updated_at: string
          yearly_price: number
        }
        Insert: {
          currency?: string
          daily_export_price?: number
          id?: number
          instructions?: string | null
          monthly_price?: number
          payment_link?: string | null
          payment_number?: string | null
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          currency?: string
          daily_export_price?: number
          id?: number
          instructions?: string | null
          monthly_price?: number
          payment_link?: string | null
          payment_number?: string | null
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      export_history: {
        Row: {
          created_at: string
          format: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          format: string
          id?: string
          label: string
          user_id?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          ai_confidence: number | null
          ai_kind: Database["public"]["Enums"]["invoice_kind"] | null
          amount: number
          category: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          id: string
          image_path: string | null
          invoice_date: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          merchant: string | null
          note: string | null
          on_credit: boolean
          settled_at: string | null
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_kind?: Database["public"]["Enums"]["invoice_kind"] | null
          amount?: number
          category?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          id?: string
          image_path?: string | null
          invoice_date?: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          merchant?: string | null
          note?: string | null
          on_credit?: boolean
          settled_at?: string | null
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_kind?: Database["public"]["Enums"]["invoice_kind"] | null
          amount?: number
          category?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          id?: string
          image_path?: string | null
          invoice_date?: string
          kind?: Database["public"]["Enums"]["invoice_kind"]
          merchant?: string | null
          note?: string | null
          on_credit?: boolean
          settled_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      loan_requests: {
        Row: {
          admin_note: string | null
          amount: number
          commission: number
          created_at: string
          duration_months: number
          id: string
          monthly_revenue: number
          partner: string | null
          purpose: string
          score: number
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          commission?: number
          created_at?: string
          duration_months: number
          id?: string
          monthly_revenue?: number
          partner?: string | null
          purpose: string
          score?: number
          status?: string
          user_id?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          commission?: number
          created_at?: string
          duration_months?: number
          id?: string
          monthly_revenue?: number
          partner?: string | null
          purpose?: string
          score?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          business_phone: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          id: string
          logo_path: string | null
          neighborhood: string | null
          owner_name: string | null
          phone: string
        }
        Insert: {
          business_name?: string | null
          business_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id: string
          logo_path?: string | null
          neighborhood?: string | null
          owner_name?: string | null
          phone: string
        }
        Update: {
          business_name?: string | null
          business_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          logo_path?: string | null
          neighborhood?: string | null
          owner_name?: string | null
          phone?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          admin_note: string | null
          amount: number
          confirmed_at: string | null
          created_at: string
          currency: string
          export_date: string | null
          id: string
          payer_ref: string | null
          period_end: string | null
          period_start: string | null
          plan: string
          proof_path: string | null
          receipt_no: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          export_date?: string | null
          id?: string
          payer_ref?: string | null
          period_end?: string | null
          period_start?: string | null
          plan: string
          proof_path?: string | null
          receipt_no?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          export_date?: string | null
          id?: string
          payer_ref?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string
          proof_path?: string | null
          receipt_no?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      review_payment: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      send_notification: {
        Args: {
          _body: string
          _city?: string
          _country?: string
          _currency?: string
          _incomplete_only?: boolean
          _title: string
        }
        Returns: number
      }
      verify_certificate: {
        Args: { _code: string }
        Returns: {
          business_name: string
          city: string
          country: string
          issued_at: string
          kind: string
          score: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      invoice_kind: "achat" | "vente"
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
      app_role: ["admin", "user"],
      invoice_kind: ["achat", "vente"],
    },
  },
} as const
