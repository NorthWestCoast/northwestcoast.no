/**
 * GENERERT FRA DATABASEN – ikke rediger for hånd.
 *
 * Regenerer etter hver skjemaendring (migrasjon):
 *   npm run db:types
 * (krever Supabase CLI og SUPABASE_PROJECT_ID i miljøet), eller via Supabase
 * MCP-verktøyet generate_typescript_types.
 *
 * Sist generert 2026-11-18 mot prosjektet «northwestcoast», etter migrasjon
 * 20261118223552_harden_price_history_and_order_number_grants.
 */
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          address: string | null
          city: string | null
          country: string
          created_at: string
          id: string
          name: string
          org_number: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          name: string
          org_number?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          name?: string
          org_number?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["company_role"]
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["company_role"]
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["company_role"]
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          handled_at: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          product: string | null
          source: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          handled_at?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          product?: string | null
          source?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          handled_at?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          product?: string | null
          source?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          id: string
          notes: string | null
          order_id: string
          shipped_at: string | null
          tracking_reference: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          shipped_at?: string | null
          tracking_reference?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          shipped_at?: string | null
          tracking_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          provider: string
          provider_message_id: string | null
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          provider: string
          provider_message_id?: string | null
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          provider?: string
          provider_message_id?: string | null
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          template?: string
          to_email?: string
        }
        Relationships: []
      }
      ladder_state_photos: {
        Row: {
          caption: string | null
          captured_at: string
          id: string
          kind: Database["public"]["Enums"]["ladder_photo_kind"]
          share_id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          caption?: string | null
          captured_at: string
          id?: string
          kind?: Database["public"]["Enums"]["ladder_photo_kind"]
          share_id: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          caption?: string | null
          captured_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ladder_photo_kind"]
          share_id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_state_photos_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "ladder_state_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_state_shares: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          ladder_id: string
          last_viewed_at: string | null
          note: string | null
          revoked_at: string | null
          token_hash: string
          vessel_id: string | null
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          ladder_id: string
          last_viewed_at?: string | null
          note?: string | null
          revoked_at?: string | null
          token_hash: string
          vessel_id?: string | null
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          ladder_id?: string
          last_viewed_at?: string | null
          note?: string | null
          revoked_at?: string | null
          token_hash?: string
          vessel_id?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ladder_state_shares_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladder_status"
            referencedColumns: ["ladder_id"]
          },
          {
            foreignKeyName: "ladder_state_shares_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_state_shares_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      ladders: {
        Row: {
          created_at: string
          id: string
          installed_at: string | null
          notes: string | null
          produced_at: string | null
          product_id: string
          public_code: string | null
          serial_number: string
          service_interval_months: number
          status: Database["public"]["Enums"]["ladder_lifecycle_status"]
          updated_at: string
          vessel_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          installed_at?: string | null
          notes?: string | null
          produced_at?: string | null
          product_id: string
          public_code?: string | null
          serial_number: string
          service_interval_months?: number
          status?: Database["public"]["Enums"]["ladder_lifecycle_status"]
          updated_at?: string
          vessel_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          installed_at?: string | null
          notes?: string | null
          produced_at?: string | null
          product_id?: string
          public_code?: string | null
          serial_number?: string
          service_interval_months?: number
          status?: Database["public"]["Enums"]["ladder_lifecycle_status"]
          updated_at?: string
          vessel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ladders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladders_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          email_sent: boolean
          id: string
          ladder_length: number | null
          message: string | null
          name: string | null
          phone: string | null
          product_interest: string | null
          source: string
          status: string
          vessel_type: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          email_sent?: boolean
          id?: string
          ladder_length?: number | null
          message?: string | null
          name?: string | null
          phone?: string | null
          product_interest?: string | null
          source?: string
          status?: string
          vessel_type?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          email_sent?: boolean
          id?: string
          ladder_length?: number | null
          message?: string | null
          name?: string | null
          phone?: string | null
          product_interest?: string | null
          source?: string
          status?: string
          vessel_type?: string | null
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          created_at: string
          id: string
          imo_raw: string | null
          ladder_id: string | null
          notes: string | null
          notified_at: string | null
          performed_at: string
          reported_by_user_id: string | null
          reporter_email: string | null
          reporter_name: string | null
          serial_number_raw: string | null
          source: string
          vessel_id: string | null
          vessel_name_raw: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          imo_raw?: string | null
          ladder_id?: string | null
          notes?: string | null
          notified_at?: string | null
          performed_at?: string
          reported_by_user_id?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          serial_number_raw?: string | null
          source?: string
          vessel_id?: string | null
          vessel_name_raw?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          imo_raw?: string | null
          ladder_id?: string | null
          notes?: string | null
          notified_at?: string | null
          performed_at?: string
          reported_by_user_id?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          serial_number_raw?: string | null
          source?: string
          vessel_id?: string | null
          vessel_name_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladder_status"
            referencedColumns: ["ladder_id"]
          },
          {
            foreignKeyName: "maintenance_logs_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_photos: {
        Row: {
          caption: string | null
          captured_at: string | null
          id: string
          maintenance_log_id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          caption?: string | null
          captured_at?: string | null
          id?: string
          maintenance_log_id: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          caption?: string | null
          captured_at?: string | null
          id?: string
          maintenance_log_id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_photos_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      order_lines: {
        Row: {
          cabinet_price_nok: number
          id: string
          line_total_nok: number
          order_id: string
          product_id: string
          qty: number
          unit_price_nok: number
          with_cabinet: boolean
        }
        Insert: {
          cabinet_price_nok?: number
          id?: string
          line_total_nok: number
          order_id: string
          product_id: string
          qty: number
          unit_price_nok: number
          with_cabinet?: boolean
        }
        Update: {
          cabinet_price_nok?: number
          id?: string
          line_total_nok?: number
          order_id?: string
          product_id?: string
          qty?: number
          unit_price_nok?: number
          with_cabinet?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          order_number: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          total_nok: number
          updated_at: string
          vessel_name: string | null
        }
        Insert: {
          company_id?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_nok: number
          updated_at?: string
          vessel_name?: string | null
        }
        Update: {
          company_id?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_nok?: number
          updated_at?: string
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_on_request: boolean | null
          new_price_nok: number | null
          old_on_request: boolean | null
          old_price_nok: number | null
          product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_on_request?: boolean | null
          new_price_nok?: number | null
          old_on_request?: boolean | null
          old_price_nok?: number | null
          product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_on_request?: boolean | null
          new_price_nok?: number | null
          old_on_request?: boolean | null
          old_price_nok?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          cabinet_product_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["product_kind"]
          length_m: number | null
          name: string
          price_nok: number
          price_on_request: boolean
          product_number: string
          steps: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cabinet_product_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["product_kind"]
          length_m?: number | null
          name: string
          price_nok: number
          price_on_request?: boolean
          product_number: string
          steps?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cabinet_product_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["product_kind"]
          length_m?: number | null
          name?: string
          price_nok?: number
          price_on_request?: boolean
          product_number?: string
          steps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_cabinet_product_id_fkey"
            columns: ["cabinet_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_reports: {
        Row: {
          created_at: string
          findings: string | null
          id: string
          ladder_id: string
          next_service_due: string | null
          parts_replaced: Json
          performed_at: string
          performed_by: string
          report_path: string | null
          result: Database["public"]["Enums"]["service_result"]
          technician_user_id: string | null
        }
        Insert: {
          created_at?: string
          findings?: string | null
          id?: string
          ladder_id: string
          next_service_due?: string | null
          parts_replaced?: Json
          performed_at: string
          performed_by: string
          report_path?: string | null
          result: Database["public"]["Enums"]["service_result"]
          technician_user_id?: string | null
        }
        Update: {
          created_at?: string
          findings?: string | null
          id?: string
          ladder_id?: string
          next_service_due?: string | null
          parts_replaced?: Json
          performed_at?: string
          performed_by?: string
          report_path?: string | null
          result?: Database["public"]["Enums"]["service_result"]
          technician_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_reports_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladder_status"
            referencedColumns: ["ladder_id"]
          },
          {
            foreignKeyName: "service_reports_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      vessel_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["vessel_role"]
          user_id: string
          vessel_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["vessel_role"]
          user_id: string
          vessel_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["vessel_role"]
          user_id?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vessel_members_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      vessels: {
        Row: {
          call_sign: string | null
          company_id: string
          created_at: string
          home_port: string | null
          id: string
          imo: string | null
          mmsi: string | null
          name: string
          updated_at: string
          vessel_type: string | null
        }
        Insert: {
          call_sign?: string | null
          company_id: string
          created_at?: string
          home_port?: string | null
          id?: string
          imo?: string | null
          mmsi?: string | null
          name: string
          updated_at?: string
          vessel_type?: string | null
        }
        Update: {
          call_sign?: string | null
          company_id?: string
          created_at?: string
          home_port?: string | null
          id?: string
          imo?: string | null
          mmsi?: string | null
          name?: string
          updated_at?: string
          vessel_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vessels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ladder_status: {
        Row: {
          company_id: string | null
          days_until_service: number | null
          imo: string | null
          installed_at: string | null
          ladder_id: string | null
          last_maintenance_at: string | null
          last_service_at: string | null
          last_service_result:
            | Database["public"]["Enums"]["service_result"]
            | null
          length_m: number | null
          next_service_due: string | null
          produced_at: string | null
          product_name: string | null
          product_number: string | null
          public_code: string | null
          serial_number: string | null
          service_state: string | null
          status: Database["public"]["Enums"]["ladder_lifecycle_status"] | null
          steps: number | null
          vessel_id: string | null
          vessel_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ladders_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vessels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_valid_imo: { Args: { value: string }; Returns: boolean }
      is_valid_org_number: { Args: { value: string }; Returns: boolean }
      next_order_number: { Args: never; Returns: string }
      purge_expired_shares: { Args: { retain_days?: number }; Returns: number }
    }
    Enums: {
      company_role: "owner" | "admin" | "member"
      email_status: "queued" | "sent" | "failed"
      ladder_lifecycle_status:
        | "in_production"
        | "delivered"
        | "installed"
        | "retired"
      ladder_photo_kind: "ladder" | "attachment_point" | "overview" | "other"
      order_status:
        | "new"
        | "quoted"
        | "confirmed"
        | "in_production"
        | "delivered"
        | "cancelled"
      product_kind: "ladder" | "cabinet" | "spare_part"
      service_result: "ok" | "ok_with_remarks" | "failed"
      vessel_role: "master" | "crew" | "viewer"
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
      company_role: ["owner", "admin", "member"],
      email_status: ["queued", "sent", "failed"],
      ladder_lifecycle_status: [
        "in_production",
        "delivered",
        "installed",
        "retired",
      ],
      ladder_photo_kind: ["ladder", "attachment_point", "overview", "other"],
      order_status: [
        "new",
        "quoted",
        "confirmed",
        "in_production",
        "delivered",
        "cancelled",
      ],
      product_kind: ["ladder", "cabinet", "spare_part"],
      service_result: ["ok", "ok_with_remarks", "failed"],
      vessel_role: ["master", "crew", "viewer"],
    },
  },
} as const
