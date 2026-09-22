/**
 * Databasetyper.
 *
 * Regenerer med:
 *   npm run db:types
 * (krever Supabase CLI og SUPABASE_PROJECT_ID i miljøet)
 *
 * Denne filen dekker tabellene fase 0 faktisk bruker. Når dashboardet i fase 2
 * begynner å lese fartøy, leidere og service, bytt den ut med full generert
 * output i stedet for å utvide den for hånd.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CompanyRole = 'owner' | 'admin' | 'member';
export type EmailStatus = 'queued' | 'sent' | 'failed';
export type LadderLifecycleStatus =
  | 'in_production'
  | 'delivered'
  | 'installed'
  | 'retired';
export type LadderPhotoKind = 'ladder' | 'attachment_point' | 'overview' | 'other';
export type OrderStatus =
  | 'new'
  | 'quoted'
  | 'confirmed'
  | 'in_production'
  | 'delivered'
  | 'cancelled';
export type ProductKind = 'ladder' | 'cabinet' | 'spare_part';
export type ServiceResult = 'ok' | 'ok_with_remarks' | 'failed';
export type VesselRole = 'master' | 'crew' | 'viewer';
/** Beregnet i viewet ladder_status, ikke en enum i databasen. */
export type ServiceState = 'ok' | 'due_soon' | 'overdue' | 'unknown';

type Timestamps = { created_at: string };

export type Database = {
  // Leses av supabase-js for å velge riktig PostgREST-oppførsel.
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          org_number: string | null;
          address: string | null;
          postal_code: string | null;
          city: string | null;
          country: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vessels: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          imo: string | null;
          call_sign: string | null;
          mmsi: string | null;
          vessel_type: string | null;
          home_port: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ladders: {
        Row: {
          id: string;
          serial_number: string;
          public_code: string | null;
          product_id: string;
          produced_at: string | null;
          vessel_id: string | null;
          installed_at: string | null;
          status: LadderLifecycleStatus;
          service_interval_months: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          product_number: string;
          name: string;
          kind: ProductKind;
          length_m: number | null;
          steps: number | null;
          price_nok: number;
          cabinet_product_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          company_id: string | null;
          contact_name: string;
          contact_email: string;
          contact_phone: string | null;
          vessel_name: string | null;
          notes: string | null;
          total_nok: number;
          status: OrderStatus;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          company_id?: string | null;
          contact_name: string;
          contact_email: string;
          contact_phone?: string | null;
          vessel_name?: string | null;
          notes?: string | null;
          total_nok: number;
          status?: OrderStatus;
          source?: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
        Relationships: [];
      };
      order_lines: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          qty: number;
          with_cabinet: boolean;
          unit_price_nok: number;
          cabinet_price_nok: number;
          line_total_nok: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          qty: number;
          with_cabinet?: boolean;
          unit_price_nok: number;
          cabinet_price_nok?: number;
          line_total_nok: number;
        };
        Update: Partial<Database['public']['Tables']['order_lines']['Insert']>;
        Relationships: [];
      };
      contact_requests: {
        Row: Timestamps & {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          company_name: string | null;
          product: string | null;
          message: string | null;
          source: string;
          handled_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          company_name?: string | null;
          product?: string | null;
          message?: string | null;
          source?: string;
        };
        Update: Partial<Database['public']['Tables']['contact_requests']['Insert']>;
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: Timestamps & {
          id: string;
          email: string;
          source: string;
          unsubscribed_at: string | null;
        };
        Insert: { id?: string; email: string; source?: string };
        Update: Partial<Database['public']['Tables']['newsletter_subscribers']['Insert']>;
        Relationships: [];
      };
      maintenance_logs: {
        Row: Timestamps & {
          id: string;
          ladder_id: string | null;
          vessel_id: string | null;
          serial_number_raw: string | null;
          vessel_name_raw: string | null;
          imo_raw: string | null;
          reported_by_user_id: string | null;
          reporter_name: string | null;
          reporter_email: string | null;
          performed_at: string;
          notes: string | null;
          source: string;
        };
        Insert: {
          id?: string;
          ladder_id?: string | null;
          vessel_id?: string | null;
          serial_number_raw?: string | null;
          vessel_name_raw?: string | null;
          imo_raw?: string | null;
          reported_by_user_id?: string | null;
          reporter_name?: string | null;
          reporter_email?: string | null;
          performed_at?: string;
          notes?: string | null;
          source?: string;
        };
        Update: Partial<Database['public']['Tables']['maintenance_logs']['Insert']>;
        Relationships: [];
      };
      maintenance_photos: {
        Row: {
          id: string;
          maintenance_log_id: string;
          storage_path: string;
          captured_at: string | null;
          uploaded_at: string;
          caption: string | null;
        };
        Insert: {
          id?: string;
          maintenance_log_id: string;
          storage_path: string;
          captured_at?: string | null;
          caption?: string | null;
        };
        Update: Partial<Database['public']['Tables']['maintenance_photos']['Insert']>;
        Relationships: [];
      };
      email_log: {
        Row: Timestamps & {
          id: string;
          to_email: string;
          template: string;
          provider: string;
          provider_message_id: string | null;
          status: EmailStatus;
          error: string | null;
          attempts: number;
          related_type: string | null;
          related_id: string | null;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          to_email: string;
          template: string;
          provider: string;
          provider_message_id?: string | null;
          status?: EmailStatus;
          error?: string | null;
          attempts?: number;
          related_type?: string | null;
          related_id?: string | null;
          sent_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['email_log']['Insert']>;
        Relationships: [];
      };
    };
    Views: {
      ladder_status: {
        Row: {
          ladder_id: string | null;
          serial_number: string | null;
          public_code: string | null;
          status: LadderLifecycleStatus | null;
          produced_at: string | null;
          installed_at: string | null;
          vessel_id: string | null;
          company_id: string | null;
          vessel_name: string | null;
          imo: string | null;
          product_number: string | null;
          product_name: string | null;
          length_m: number | null;
          steps: number | null;
          last_service_at: string | null;
          last_service_result: ServiceResult | null;
          next_service_due: string | null;
          last_maintenance_at: string | null;
          days_until_service: number | null;
          service_state: ServiceState | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
