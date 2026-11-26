/**
 * GENERERT – ikke rediger for hånd.
 *
 * Regenerer etter hver skjemaendring (migrasjon):
 *   npm run db:types
 * Typene leses fra en midlertidig database bygget fra supabase/migrations,
 * så de følger migrasjonene nøyaktig. Se supabase/verify/gen-types.mjs.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Lar createClient velge riktig PostgREST-versjon for typeinferensen.
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      access_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          invited_by_name: string | null
          ladder_id: string | null
          message: string | null
          revoked_at: string | null
          role: string
          scope: string
          vessel_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          invited_by_name?: string | null
          ladder_id?: string | null
          message?: string | null
          revoked_at?: string | null
          role: string
          scope: string
          vessel_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          invited_by_name?: string | null
          ladder_id?: string | null
          message?: string | null
          revoked_at?: string | null
          role?: string
          scope?: string
          vessel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_invitations_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_invitations_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinets: {
        Row: {
          company_id: string | null
          created_at: string
          demo: boolean
          id: string
          installed_at: string | null
          job_id: string | null
          ladder_id: string | null
          location_note: string | null
          notes: string | null
          product_id: string
          project_id: string | null
          serial_number: string | null
          status: string
          updated_at: string
          vessel_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          demo?: boolean
          id?: string
          installed_at?: string | null
          job_id?: string | null
          ladder_id?: string | null
          location_note?: string | null
          notes?: string | null
          product_id: string
          project_id?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          vessel_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          demo?: boolean
          id?: string
          installed_at?: string | null
          job_id?: string | null
          ladder_id?: string | null
          location_note?: string | null
          notes?: string | null
          product_id?: string
          project_id?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          vessel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabinets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinets_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinets_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string
          created_at: string
          demo: boolean
          id: string
          name: string
          org_number: string | null
          postal_code: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          demo?: boolean
          id?: string
          name: string
          org_number?: string | null
          postal_code?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          demo?: boolean
          id?: string
          name?: string
          org_number?: string | null
          postal_code?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
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
          demo: boolean
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
          demo?: boolean
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
          demo?: boolean
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
          demo: boolean
          id: string
          job_id: string | null
          notes: string | null
          order_id: string
          shipped_at: string | null
          tracking_reference: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          demo?: boolean
          id?: string
          job_id?: string | null
          notes?: string | null
          order_id: string
          shipped_at?: string | null
          tracking_reference?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          demo?: boolean
          id?: string
          job_id?: string | null
          notes?: string | null
          order_id?: string
          shipped_at?: string | null
          tracking_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
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
      faq_items: {
        Row: {
          answer_en: string | null
          answer_no: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          question_en: string | null
          question_no: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_en?: string | null
          answer_no: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          question_en?: string | null
          question_no: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_en?: string | null
          answer_no?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          question_en?: string | null
          question_no?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          alt_en: string | null
          alt_no: string
          caption_en: string | null
          caption_no: string | null
          contain: boolean
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          published: boolean
          sort_order: number
          storage_path: string | null
          tag: string
          updated_at: string
        }
        Insert: {
          alt_en?: string | null
          alt_no: string
          caption_en?: string | null
          caption_no?: string | null
          contain?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          image_url: string
          published?: boolean
          sort_order?: number
          storage_path?: string | null
          tag?: string
          updated_at?: string
        }
        Update: {
          alt_en?: string | null
          alt_no?: string
          caption_en?: string | null
          caption_no?: string | null
          contain?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          published?: boolean
          sort_order?: number
          storage_path?: string | null
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      ladder_access_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          granted_role: string | null
          id: string
          ladder_id: string
          message: string | null
          requester_email: string | null
          requester_id: string
          requester_name: string | null
          serial_number: string | null
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          granted_role?: string | null
          id?: string
          ladder_id: string
          message?: string | null
          requester_email?: string | null
          requester_id: string
          requester_name?: string | null
          serial_number?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          granted_role?: string | null
          id?: string
          ladder_id?: string
          message?: string | null
          requester_email?: string | null
          requester_id?: string
          requester_name?: string | null
          serial_number?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_access_requests_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_certificates: {
        Row: {
          certificate_number: string
          company_name: string | null
          created_at: string
          id: string
          issued_by: string | null
          issued_by_name: string
          issued_on: string
          ladder_id: string
          length_m: number | null
          product_name: string
          project_name: string | null
          remarks: string | null
          replaced_by: string | null
          result: Database["public"]["Enums"]["service_result"] | null
          revoked_at: string | null
          revoked_reason: string | null
          serial_number: string
          service_report_id: string | null
          valid_until: string
          verify_token: string
          vessel_name: string | null
        }
        Insert: {
          certificate_number: string
          company_name?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          issued_by_name: string
          issued_on?: string
          ladder_id: string
          length_m?: number | null
          product_name: string
          project_name?: string | null
          remarks?: string | null
          replaced_by?: string | null
          result?: Database["public"]["Enums"]["service_result"] | null
          revoked_at?: string | null
          revoked_reason?: string | null
          serial_number: string
          service_report_id?: string | null
          valid_until: string
          verify_token?: string
          vessel_name?: string | null
        }
        Update: {
          certificate_number?: string
          company_name?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          issued_by_name?: string
          issued_on?: string
          ladder_id?: string
          length_m?: number | null
          product_name?: string
          project_name?: string | null
          remarks?: string | null
          replaced_by?: string | null
          result?: Database["public"]["Enums"]["service_result"] | null
          revoked_at?: string | null
          revoked_reason?: string | null
          serial_number?: string
          service_report_id?: string | null
          valid_until?: string
          verify_token?: string
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ladder_certificates_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_certificates_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "ladder_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_certificates_service_report_id_fkey"
            columns: ["service_report_id"]
            isOneToOne: false
            referencedRelation: "service_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_members: {
        Row: {
          created_at: string
          granted_by: string | null
          ladder_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          ladder_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          ladder_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_members_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
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
          checklist: Json
          created_at: string
          created_by: string | null
          created_by_name: string | null
          expires_at: string
          id: string
          ladder_id: string
          last_viewed_at: string | null
          note: string | null
          recipient: string | null
          revoked_at: string | null
          title: string | null
          token_hash: string
          vessel_id: string | null
          view_count: number
        }
        Insert: {
          checklist?: Json
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          expires_at?: string
          id?: string
          ladder_id: string
          last_viewed_at?: string | null
          note?: string | null
          recipient?: string | null
          revoked_at?: string | null
          title?: string | null
          token_hash: string
          vessel_id?: string | null
          view_count?: number
        }
        Update: {
          checklist?: Json
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          expires_at?: string
          id?: string
          ladder_id?: string
          last_viewed_at?: string | null
          note?: string | null
          recipient?: string | null
          revoked_at?: string | null
          title?: string | null
          token_hash?: string
          vessel_id?: string | null
          view_count?: number
        }
        Relationships: [
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
      ladder_tasks: {
        Row: {
          auto: string | null
          completed_at: string | null
          completed_by: string | null
          completed_log_id: string | null
          created_at: string
          created_by: string | null
          demo: boolean
          description: string | null
          due_date: string
          id: string
          kind: Database["public"]["Enums"]["log_kind"]
          ladder_id: string
          recurrence_months: number | null
          status: string
          title: string
        }
        Insert: {
          auto?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_log_id?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          description?: string | null
          due_date: string
          id?: string
          kind?: Database["public"]["Enums"]["log_kind"]
          ladder_id: string
          recurrence_months?: number | null
          status?: string
          title: string
        }
        Update: {
          auto?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_log_id?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          description?: string | null
          due_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["log_kind"]
          ladder_id?: string
          recurrence_months?: number | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_tasks_completed_log_id_fkey"
            columns: ["completed_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_tasks_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      ladders: {
        Row: {
          company_id: string | null
          created_at: string
          custom_length_m: number | null
          demo: boolean
          id: string
          installed_at: string | null
          notes: string | null
          produced_at: string | null
          product_id: string
          project_id: string | null
          public_code: string | null
          serial_number: string
          service_interval_months: number
          status: Database["public"]["Enums"]["ladder_lifecycle_status"]
          updated_at: string
          vessel_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          custom_length_m?: number | null
          demo?: boolean
          id?: string
          installed_at?: string | null
          notes?: string | null
          produced_at?: string | null
          product_id: string
          project_id?: string | null
          public_code?: string | null
          serial_number: string
          service_interval_months?: number
          status?: Database["public"]["Enums"]["ladder_lifecycle_status"]
          updated_at?: string
          vessel_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          custom_length_m?: number | null
          demo?: boolean
          id?: string
          installed_at?: string | null
          notes?: string | null
          produced_at?: string | null
          product_id?: string
          project_id?: string | null
          public_code?: string | null
          serial_number?: string
          service_interval_months?: number
          status?: Database["public"]["Enums"]["ladder_lifecycle_status"]
          updated_at?: string
          vessel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ladders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      maintenance_links: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          expires_at: string
          id: string
          ladder_id: string
          last_used_at: string | null
          recipient: string | null
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          expires_at: string
          id?: string
          ladder_id: string
          last_used_at?: string | null
          recipient?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          expires_at?: string
          id?: string
          ladder_id?: string
          last_used_at?: string | null
          recipient?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_links_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          checklist: Database["public"]["Enums"]["maintenance_checklist"] | null
          checklist_items: Json
          created_at: string
          demo: boolean
          id: string
          imo_raw: string | null
          incomplete: boolean
          kind: Database["public"]["Enums"]["log_kind"]
          ladder_id: string | null
          link_id: string | null
          notes: string | null
          notified_at: string | null
          paper_form: boolean
          performed_at: string
          reported_by_user_id: string | null
          reporter_email: string | null
          reporter_name: string | null
          serial_number_raw: string | null
          source: string
          title: string | null
          verified_at: string | null
          verified_by: string | null
          vessel_id: string | null
          vessel_name_raw: string | null
        }
        Insert: {
          checklist?: Database["public"]["Enums"]["maintenance_checklist"] | null
          checklist_items?: Json
          created_at?: string
          demo?: boolean
          id?: string
          imo_raw?: string | null
          incomplete?: boolean
          kind?: Database["public"]["Enums"]["log_kind"]
          ladder_id?: string | null
          link_id?: string | null
          notes?: string | null
          notified_at?: string | null
          paper_form?: boolean
          performed_at?: string
          reported_by_user_id?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          serial_number_raw?: string | null
          source?: string
          title?: string | null
          verified_at?: string | null
          verified_by?: string | null
          vessel_id?: string | null
          vessel_name_raw?: string | null
        }
        Update: {
          checklist?: Database["public"]["Enums"]["maintenance_checklist"] | null
          checklist_items?: Json
          created_at?: string
          demo?: boolean
          id?: string
          imo_raw?: string | null
          incomplete?: boolean
          kind?: Database["public"]["Enums"]["log_kind"]
          ladder_id?: string | null
          link_id?: string | null
          notes?: string | null
          notified_at?: string | null
          paper_form?: boolean
          performed_at?: string
          reported_by_user_id?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          serial_number_raw?: string | null
          source?: string
          title?: string | null
          verified_at?: string | null
          verified_by?: string | null
          vessel_id?: string | null
          vessel_name_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "maintenance_links"
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
      media_library: {
        Row: {
          alt_en: string | null
          alt_no: string | null
          bytes: number | null
          created_at: string
          created_by: string | null
          file_name: string | null
          height: number | null
          id: string
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_en?: string | null
          alt_no?: string | null
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          height?: number | null
          id?: string
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_en?: string | null
          alt_no?: string | null
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          height?: number | null
          id?: string
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirm_sent_at: string | null
          confirm_token_hash: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          source: string
          unsubscribe_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          confirm_sent_at?: string | null
          confirm_token_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          source?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          confirm_sent_at?: string | null
          confirm_token_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          source?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          demo: boolean
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          demo?: boolean
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          demo?: boolean
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_lines: {
        Row: {
          cabinet_price_nok: number
          cabinet_product_id: string | null
          custom_length_m: number | null
          demo: boolean
          id: string
          line_total_nok: number
          on_request: boolean
          order_id: string
          product_id: string
          qty: number
          unit_price_nok: number
          with_cabinet: boolean
        }
        Insert: {
          cabinet_price_nok?: number
          cabinet_product_id?: string | null
          custom_length_m?: number | null
          demo?: boolean
          id?: string
          line_total_nok: number
          on_request?: boolean
          order_id: string
          product_id: string
          qty: number
          unit_price_nok: number
          with_cabinet?: boolean
        }
        Update: {
          cabinet_price_nok?: number
          cabinet_product_id?: string | null
          custom_length_m?: number | null
          demo?: boolean
          id?: string
          line_total_nok?: number
          on_request?: boolean
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
          confirmed_at: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          created_by: string | null
          delivery_address: string | null
          demo: boolean
          expected_delivery: string | null
          id: string
          imo: string | null
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
          confirmed_at?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          demo?: boolean
          expected_delivery?: string | null
          id?: string
          imo?: string | null
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
          confirmed_at?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          demo?: boolean
          expected_delivery?: string | null
          id?: string
          imo?: string | null
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
      post_autosaves: {
        Row: {
          data: Json
          post_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          post_key: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          data?: Json
          post_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_revisions: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          data: Json
          id: string
          post_id: string
          restored_from: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          data: Json
          id?: string
          post_id: string
          restored_from?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          data?: Json
          id?: string
          post_id?: string
          restored_from?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          body_en: string | null
          body_no: string
          cover_image_url: string | null
          created_at: string
          excerpt_en: string | null
          excerpt_no: string | null
          id: string
          published_at: string | null
          slug: string
          status: string
          tag_en: string
          tag_no: string
          title_en: string | null
          title_no: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body_en?: string | null
          body_no?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt_en?: string | null
          excerpt_no?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          tag_en?: string
          tag_no?: string
          title_en?: string | null
          title_no: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body_en?: string | null
          body_no?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt_en?: string | null
          excerpt_no?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          tag_en?: string
          tag_no?: string
          title_en?: string | null
          title_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_components: {
        Row: {
          created_at: string
          id: string
          item_id: string
          note: string | null
          product_id: string
          qty: number
          qty_per_metre: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          note?: string | null
          product_id: string
          qty?: number
          qty_per_metre?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          note?: string | null
          product_id?: string
          qty?: number
          qty_per_metre?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_components_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      production_job_steps: {
        Row: {
          demo: boolean
          description: string | null
          done_at: string | null
          done_by: string | null
          done_by_name: string | null
          id: string
          job_id: string
          note: string | null
          position: number
          title: string
        }
        Insert: {
          demo?: boolean
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          done_by_name?: string | null
          id?: string
          job_id: string
          note?: string | null
          position: number
          title: string
        }
        Update: {
          demo?: boolean
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          done_by_name?: string | null
          id?: string
          job_id?: string
          note?: string | null
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      production_jobs: {
        Row: {
          cabinet_name: string | null
          cabinet_product_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_label: string | null
          delivered_at: string | null
          demo: boolean
          due_date: string | null
          id: string
          job_number: string
          kind: Database["public"]["Enums"]["product_kind"]
          ladder_id: string | null
          length_m: number | null
          order_id: string | null
          order_line_id: string | null
          order_number: string | null
          product_id: string
          product_name: string
          product_number: string
          serial_number: string | null
          shipped_at: string | null
          spec_notes: string | null
          started_at: string | null
          status: string
          steps: number | null
          stock_posted_at: string | null
          stock_sold_at: string | null
          updated_at: string
          vessel_name: string | null
          with_cabinet: boolean
        }
        Insert: {
          cabinet_name?: string | null
          cabinet_product_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_label?: string | null
          delivered_at?: string | null
          demo?: boolean
          due_date?: string | null
          id?: string
          job_number?: string
          kind?: Database["public"]["Enums"]["product_kind"]
          ladder_id?: string | null
          length_m?: number | null
          order_id?: string | null
          order_line_id?: string | null
          order_number?: string | null
          product_id: string
          product_name: string
          product_number: string
          serial_number?: string | null
          shipped_at?: string | null
          spec_notes?: string | null
          started_at?: string | null
          status?: string
          steps?: number | null
          stock_posted_at?: string | null
          stock_sold_at?: string | null
          updated_at?: string
          vessel_name?: string | null
          with_cabinet?: boolean
        }
        Update: {
          cabinet_name?: string | null
          cabinet_product_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_label?: string | null
          delivered_at?: string | null
          demo?: boolean
          due_date?: string | null
          id?: string
          job_number?: string
          kind?: Database["public"]["Enums"]["product_kind"]
          ladder_id?: string | null
          length_m?: number | null
          order_id?: string | null
          order_line_id?: string | null
          order_number?: string | null
          product_id?: string
          product_name?: string
          product_number?: string
          serial_number?: string | null
          shipped_at?: string | null
          spec_notes?: string | null
          started_at?: string | null
          status?: string
          steps?: number | null
          stock_posted_at?: string | null
          stock_sold_at?: string | null
          updated_at?: string
          vessel_name?: string | null
          with_cabinet?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "production_jobs_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_step_templates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          for_cabinet: boolean
          id: string
          position: number
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          for_cabinet?: boolean
          id?: string
          position: number
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          for_cabinet?: boolean
          id?: string
          position?: number
          title?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          cabinet_product_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["product_kind"]
          length_m: number | null
          name: string
          price_nok: number
          price_on_request: boolean
          product_number: string
          sort_order: number
          sourcing: string
          steps: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cabinet_product_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["product_kind"]
          length_m?: number | null
          name: string
          price_nok: number
          price_on_request?: boolean
          product_number: string
          sort_order?: number
          sourcing?: string
          steps?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cabinet_product_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["product_kind"]
          length_m?: number | null
          name?: string
          price_nok?: number
          price_on_request?: boolean
          product_number?: string
          sort_order?: number
          sourcing?: string
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
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          last_seen_at: string | null
          notify_email: boolean
          phone: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          last_seen_at?: string | null
          notify_email?: boolean
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          last_seen_at?: string | null
          notify_email?: boolean
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          demo: boolean
          description: string | null
          id: string
          kind: string
          location: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          demo?: boolean
          description?: string | null
          id?: string
          kind?: string
          location?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          demo?: boolean
          description?: string | null
          id?: string
          kind?: string
          location?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          id: string
          item_id: string
          note: string | null
          purchase_order_id: string
          qty_ordered: number
          qty_received: number
        }
        Insert: {
          id?: string
          item_id: string
          note?: string | null
          purchase_order_id: string
          qty_ordered: number
          qty_received?: number
        }
        Update: {
          id?: string
          item_id?: string
          note?: string | null
          purchase_order_id?: string
          qty_ordered?: number
          qty_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_on: string | null
          id: string
          kind: string
          notes: string | null
          ordered_on: string
          po_number: string
          reference: string | null
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_on?: string | null
          id?: string
          kind?: string
          notes?: string | null
          ordered_on?: string
          po_number?: string
          reference?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_on?: string | null
          id?: string
          kind?: string
          notes?: string | null
          ordered_on?: string
          po_number?: string
          reference?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agreements: {
        Row: {
          company_id: string
          covers: string | null
          created_at: string
          created_by: string | null
          demo: boolean
          ends_on: string | null
          id: string
          interval_months: number
          notes: string | null
          price_nok: number | null
          starts_on: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          covers?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          ends_on?: string | null
          id?: string
          interval_months?: number
          notes?: string | null
          price_nok?: number | null
          starts_on: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          covers?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          ends_on?: string | null
          id?: string
          interval_months?: number
          notes?: string | null
          price_nok?: number | null
          starts_on?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      service_bookings: {
        Row: {
          created_at: string
          demo: boolean
          id: string
          ladder_id: string
          location: string | null
          notes: string | null
          preferred_date: string | null
          requested_by: string | null
          requester_name: string | null
          scheduled_date: string | null
          service_report_id: string | null
          staff_note: string | null
          status: string
          technician: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          demo?: boolean
          id?: string
          ladder_id: string
          location?: string | null
          notes?: string | null
          preferred_date?: string | null
          requested_by?: string | null
          requester_name?: string | null
          scheduled_date?: string | null
          service_report_id?: string | null
          staff_note?: string | null
          status?: string
          technician?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          demo?: boolean
          id?: string
          ladder_id?: string
          location?: string | null
          notes?: string | null
          preferred_date?: string | null
          requested_by?: string | null
          requester_name?: string | null
          scheduled_date?: string | null
          service_report_id?: string | null
          staff_note?: string | null
          status?: string
          technician?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bookings_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bookings_service_report_id_fkey"
            columns: ["service_report_id"]
            isOneToOne: false
            referencedRelation: "service_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      service_report_photos: {
        Row: {
          caption: string | null
          id: string
          service_report_id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          caption?: string | null
          id?: string
          service_report_id: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          caption?: string | null
          id?: string
          service_report_id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_report_photos_service_report_id_fkey"
            columns: ["service_report_id"]
            isOneToOne: false
            referencedRelation: "service_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      service_reports: {
        Row: {
          created_at: string
          demo: boolean
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
          demo?: boolean
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
          demo?: boolean
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
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          full_name: string | null
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          item_number: string
          location: string | null
          name: string
          notes: string | null
          on_hand: number
          product_id: string | null
          reorder_point: number
          supplier_id: string | null
          supply: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          item_number: string
          location?: string | null
          name: string
          notes?: string | null
          on_hand?: number
          product_id?: string | null
          reorder_point?: number
          supplier_id?: string | null
          supply?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          item_number?: string
          location?: string | null
          name?: string
          notes?: string | null
          on_hand?: number
          product_id?: string | null
          reorder_point?: number
          supplier_id?: string | null
          supply?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          item_id: string
          job_id: string | null
          kind: string
          note: string | null
          occurred_on: string
          order_id: string | null
          purchase_line_id: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          item_id: string
          job_id?: string | null
          kind: string
          note?: string | null
          occurred_on?: string
          order_id?: string | null
          purchase_line_id?: string | null
          quantity: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          item_id?: string
          job_id?: string | null
          kind?: string
          note?: string | null
          occurred_on?: string
          order_id?: string | null
          purchase_line_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_purchase_line_id_fkey"
            columns: ["purchase_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          closed_at: string | null
          company_id: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          demo: boolean
          id: string
          ladder_id: string | null
          last_message_at: string
          priority: string
          status: string
          subject: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          category?: string
          closed_at?: string | null
          company_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          id?: string
          ladder_id?: string | null
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          category?: string
          closed_at?: string | null
          company_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          id?: string
          ladder_id?: string | null
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          demo: boolean
          from_staff: boolean
          id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          demo?: boolean
          from_staff?: boolean
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          demo?: boolean
          from_staff?: boolean
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
          beam_m: number | null
          build_year: number | null
          call_sign: string | null
          company_id: string
          created_at: string
          demo: boolean
          home_port: string | null
          id: string
          imo: string | null
          length_m: number | null
          mmsi: string | null
          name: string
          registration_mark: string | null
          registry_id: string | null
          updated_at: string
          vessel_type: string | null
        }
        Insert: {
          beam_m?: number | null
          build_year?: number | null
          call_sign?: string | null
          company_id: string
          created_at?: string
          demo?: boolean
          home_port?: string | null
          id?: string
          imo?: string | null
          length_m?: number | null
          mmsi?: string | null
          name: string
          registration_mark?: string | null
          registry_id?: string | null
          updated_at?: string
          vessel_type?: string | null
        }
        Update: {
          beam_m?: number | null
          build_year?: number | null
          call_sign?: string | null
          company_id?: string
          created_at?: string
          demo?: boolean
          home_port?: string | null
          id?: string
          imo?: string | null
          length_m?: number | null
          mmsi?: string | null
          name?: string
          registration_mark?: string | null
          registry_id?: string | null
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
          booked_service_date: string | null
          certificate_number: string | null
          certificate_valid_until: string | null
          company_id: string | null
          company_name: string | null
          days_until_service: number | null
          imo: string | null
          installed_at: string | null
          ladder_id: string | null
          last_maintenance_at: string | null
          last_service_at: string | null
          last_service_result: Database["public"]["Enums"]["service_result"] | null
          length_m: number | null
          next_service_due: string | null
          next_task_due: string | null
          open_tasks: number | null
          produced_at: string | null
          product_name: string | null
          product_number: string | null
          project_id: string | null
          project_name: string | null
          public_code: string | null
          serial_number: string | null
          service_interval_months: number | null
          service_state: string | null
          status: Database["public"]["Enums"]["ladder_lifecycle_status"] | null
          steps: number | null
          vessel_id: string | null
          vessel_name: string | null
        }
        Relationships: []
      }
      stock_overview: {
        Row: {
          active: boolean | null
          available: number | null
          below_minimum: boolean | null
          category: string | null
          created_at: string | null
          id: string | null
          item_number: string | null
          location: string | null
          name: string | null
          notes: string | null
          on_hand: number | null
          on_order: number | null
          product_id: string | null
          reorder_point: number | null
          reserved: number | null
          supplier_id: string | null
          supply: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: { Args: { p_invitation: string }; Returns: string }
      advance_job: { Args: { p_job: string; p_status: string; p_carrier?: string; p_tracking?: string }; Returns: undefined }
      assign_job_serial: { Args: { p_job: string; p_serial: string }; Returns: string }
      cancel_service_booking: { Args: { p_booking: string }; Returns: undefined }
      complete_ladder_task: { Args: { p_task: string; p_notes?: string; p_performed_at?: string }; Returns: string }
      confirm_newsletter: { Args: { p_token: string }; Returns: boolean }
      confirm_order: { Args: { p_order: string; p_due_date?: string }; Returns: number }
      create_my_company: { Args: { p_name: string; p_org_number?: string; p_address?: string; p_postal_code?: string; p_city?: string; p_contact_phone?: string }; Returns: string }
      create_ticket: { Args: { p_subject: string; p_body: string; p_category?: string; p_ladder?: string; p_company?: string }; Returns: string }
      decide_ladder_access: { Args: { p_request: string; p_approve: boolean; p_role?: string; p_note?: string }; Returns: undefined }
      decline_invitation: { Args: { p_invitation: string }; Returns: undefined }
      finish_maintenance_report: { Args: { p_log: string; p_paths?: string[] }; Returns: Json }
      fulfil_job_from_stock: { Args: { p_job: string; p_stock_job: string }; Returns: string }
      get_certificate: { Args: { p_token: string }; Returns: Json }
      get_ladder_share: { Args: { p_token: string }; Returns: Json }
      get_maintenance_link: { Args: { p_token: string }; Returns: Json }
      install_ladder: { Args: { p_ladder: string; p_vessel: string; p_installed_at?: string; p_project?: string }; Returns: undefined }
      is_valid_imo: { Args: { value: string }; Returns: boolean }
      is_valid_org_number: { Args: { value: string }; Returns: boolean }
      issue_ladder_certificate: { Args: { p_ladder: string; p_service_report?: string; p_valid_until?: string; p_remarks?: string }; Returns: string }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      next_order_number: { Args: never; Returns: string }
      orphan_maintenance_photos: { Args: never; Returns: unknown[] }
      place_cabinet: { Args: { p_cabinet: string; p_vessel: string; p_project: string; p_installed_at?: string; p_location?: string }; Returns: undefined }
      place_order: { Args: { payload: Json }; Returns: Json }
      portal_bootstrap: { Args: never; Returns: Json }
      purge_expired_shares: { Args: { retain_days?: number }; Returns: number }
      receive_purchase_line: { Args: { p_line: string; p_qty: number; p_received_on?: string; p_note?: string }; Returns: undefined }
      reply_ticket: { Args: { p_ticket: string; p_body: string }; Returns: undefined }
      request_ladder_access: { Args: { p_serial: string; p_message?: string }; Returns: Json }
      request_service: { Args: { p_ladder: string; p_preferred_date?: string; p_location?: string; p_notes?: string }; Returns: string }
      restore_post_revision: { Args: { p_revision: string }; Returns: string }
      revoke_maintenance_link: { Args: { p_link: string }; Returns: undefined }
      set_production_step: { Args: { p_step: string; p_done: boolean; p_note?: string }; Returns: Json }
      set_ticket_status: { Args: { p_ticket: string; p_status: string }; Returns: undefined }
      stock_usage: { Args: { p_from?: string; p_to?: string }; Returns: unknown[] }
      submit_contact_request: { Args: { payload: Json }; Returns: string }
      submit_maintenance_report: { Args: { payload: Json }; Returns: Json }
      submit_maintenance_via_link: { Args: { p_token: string; payload: Json }; Returns: Json }
      subscribe_newsletter: { Args: { p_email: string }; Returns: Json }
      unsubscribe_newsletter: { Args: { p_token: string }; Returns: boolean }
    }
    Enums: {
      company_role: "owner" | "admin" | "member"
      email_status: "queued" | "sent" | "failed"
      ladder_lifecycle_status: "in_production" | "delivered" | "installed" | "retired" | "in_stock"
      ladder_photo_kind: "ladder" | "attachment_point" | "overview" | "other"
      log_kind: "maintenance" | "inspection" | "test" | "usage" | "repair" | "note"
      maintenance_checklist: "before_use" | "after_use" | "quarterly"
      order_status: "new" | "quoted" | "confirmed" | "in_production" | "delivered" | "cancelled"
      product_kind: "ladder" | "cabinet" | "spare_part"
      service_result: "ok" | "ok_with_remarks" | "failed"
      staff_role: "admin" | "production" | "media"
      vessel_role: "master" | "crew" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

/** Radtypen til en tabell eller et view: Tables<'ladders'>. */
export type Tables<
  T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"]),
> = (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
