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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string | null
          alerts_contact_email: string | null
          alerts_contact_name: string | null
          auto_assembly_on_receiving: boolean | null
          auto_inspection_on_receiving: boolean | null
          auto_quarantine_damaged_items: boolean | null
          auto_repair_on_damage: boolean | null
          billing_address: string | null
          billing_city: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          billing_contact_phone: string | null
          billing_country: string | null
          billing_frequency: string | null
          billing_method: string | null
          billing_net_terms: number | null
          billing_postal_code: string | null
          billing_state: string | null
          communication_settings: Json | null
          created_at: string
          credit_hold: boolean | null
          credit_limit: number | null
          currency: string | null
          default_receiving_location_id: string | null
          default_receiving_status: string | null
          deleted_at: string | null
          hide_internal_fields: boolean | null
          id: string
          metadata: Json | null
          notes: string | null
          parent_account_id: string | null
          payment_terms: string | null
          prepay_required: boolean | null
          pricing_level: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          rate_card_id: string | null
          require_inspection_photos: boolean | null
          require_sidemark: boolean | null
          restrict_visible_columns: Json | null
          status: string
          tenant_id: string
          updated_at: string
          use_tenant_communication_defaults: boolean | null
        }
        Insert: {
          account_code: string
          account_name: string
          account_type?: string | null
          alerts_contact_email?: string | null
          alerts_contact_name?: string | null
          auto_assembly_on_receiving?: boolean | null
          auto_inspection_on_receiving?: boolean | null
          auto_quarantine_damaged_items?: boolean | null
          auto_repair_on_damage?: boolean | null
          billing_address?: string | null
          billing_city?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          billing_country?: string | null
          billing_frequency?: string | null
          billing_method?: string | null
          billing_net_terms?: number | null
          billing_postal_code?: string | null
          billing_state?: string | null
          communication_settings?: Json | null
          created_at?: string
          credit_hold?: boolean | null
          credit_limit?: number | null
          currency?: string | null
          default_receiving_location_id?: string | null
          default_receiving_status?: string | null
          deleted_at?: string | null
          hide_internal_fields?: boolean | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          parent_account_id?: string | null
          payment_terms?: string | null
          prepay_required?: boolean | null
          pricing_level?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          rate_card_id?: string | null
          require_inspection_photos?: boolean | null
          require_sidemark?: boolean | null
          restrict_visible_columns?: Json | null
          status?: string
          tenant_id: string
          updated_at?: string
          use_tenant_communication_defaults?: boolean | null
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string | null
          alerts_contact_email?: string | null
          alerts_contact_name?: string | null
          auto_assembly_on_receiving?: boolean | null
          auto_inspection_on_receiving?: boolean | null
          auto_quarantine_damaged_items?: boolean | null
          auto_repair_on_damage?: boolean | null
          billing_address?: string | null
          billing_city?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          billing_country?: string | null
          billing_frequency?: string | null
          billing_method?: string | null
          billing_net_terms?: number | null
          billing_postal_code?: string | null
          billing_state?: string | null
          communication_settings?: Json | null
          created_at?: string
          credit_hold?: boolean | null
          credit_limit?: number | null
          currency?: string | null
          default_receiving_location_id?: string | null
          default_receiving_status?: string | null
          deleted_at?: string | null
          hide_internal_fields?: boolean | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          parent_account_id?: string | null
          payment_terms?: string | null
          prepay_required?: boolean | null
          pricing_level?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          rate_card_id?: string | null
          require_inspection_photos?: boolean | null
          require_sidemark?: boolean | null
          restrict_visible_columns?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string
          use_tenant_communication_defaults?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_default_receiving_location_id_fkey"
            columns: ["default_receiving_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_accounts_rate_card"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_default_templates: {
        Row: {
          alert_type_id: string
          body_template_html: string
          body_template_text: string
          channel: string
          created_at: string
          default_enabled: boolean
          id: string
          subject_template: string
        }
        Insert: {
          alert_type_id: string
          body_template_html: string
          body_template_text: string
          channel?: string
          created_at?: string
          default_enabled?: boolean
          id?: string
          subject_template: string
        }
        Update: {
          alert_type_id?: string
          body_template_html?: string
          body_template_text?: string
          channel?: string
          created_at?: string
          default_enabled?: boolean
          id?: string
          subject_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_default_templates_alert_type_id_fkey"
            columns: ["alert_type_id"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_recipients: {
        Row: {
          alert_type_id: string
          client_contact_id: string | null
          created_at: string
          email: string | null
          id: string
          recipient_type: string
          role_key: string | null
          tenant_id: string
        }
        Insert: {
          alert_type_id: string
          client_contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          recipient_type: string
          role_key?: string | null
          tenant_id: string
        }
        Update: {
          alert_type_id?: string
          client_contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          recipient_type?: string
          role_key?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_recipients_alert_type_id_fkey"
            columns: ["alert_type_id"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_recipients_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_recipients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_templates: {
        Row: {
          bcc_addresses: Json | null
          body_template_html: string
          body_template_text: string
          branding_settings: Json | null
          cc_addresses: Json | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          subject_template: string
          template_description: string | null
          template_name: string
          tenant_id: string
          to_addresses: Json | null
          trigger_events: string[] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bcc_addresses?: Json | null
          body_template_html: string
          body_template_text: string
          branding_settings?: Json | null
          cc_addresses?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          subject_template: string
          template_description?: string | null
          template_name: string
          tenant_id: string
          to_addresses?: Json | null
          trigger_events?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bcc_addresses?: Json | null
          body_template_html?: string
          body_template_text?: string
          branding_settings?: Json | null
          cc_addresses?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          subject_template?: string
          template_description?: string | null
          template_name?: string
          tenant_id?: string
          to_addresses?: Json | null
          trigger_events?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_types: {
        Row: {
          created_at: string
          description: string | null
          entity_type: string
          id: string
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_type: string
          id?: string
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_type?: string
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after_json: Json | null
          before_json: Json | null
          changes_json: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          after_json?: Json | null
          before_json?: Json | null
          changes_json?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after_json?: Json | null
          before_json?: Json | null
          changes_json?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          account_name: string | null
          client_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          client_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          client_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          error_summary: Json | null
          failed_rows: number | null
          id: string
          original_file_key: string
          original_file_name: string
          processed_rows: number | null
          results_file_key: string | null
          started_at: string | null
          status: string
          successful_rows: number | null
          tenant_id: string
          total_rows: number | null
          type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          error_summary?: Json | null
          failed_rows?: number | null
          id?: string
          original_file_key: string
          original_file_name: string
          processed_rows?: number | null
          results_file_key?: string | null
          started_at?: string | null
          status?: string
          successful_rows?: number | null
          tenant_id: string
          total_rows?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          error_summary?: Json | null
          failed_rows?: number | null
          id?: string
          original_file_key?: string
          original_file_name?: string
          processed_rows?: number | null
          results_file_key?: string | null
          started_at?: string | null
          status?: string
          successful_rows?: number | null
          tenant_id?: string
          total_rows?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "csv_import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csv_import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields_definitions: {
        Row: {
          created_at: string
          default_value: string | null
          deleted_at: string | null
          display_order: number | null
          dropdown_options: Json | null
          entity_type: string
          field_key: string
          field_type: string
          id: string
          is_required: boolean
          label: string
          tenant_id: string
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          deleted_at?: string | null
          display_order?: number | null
          dropdown_options?: Json | null
          entity_type: string
          field_key: string
          field_type: string
          id?: string
          is_required?: boolean
          label: string
          tenant_id: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          default_value?: string | null
          deleted_at?: string | null
          display_order?: number | null
          dropdown_options?: Json | null
          entity_type?: string
          field_key?: string
          field_type?: string
          id?: string
          is_required?: boolean
          label?: string
          tenant_id?: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      file_attachments: {
        Row: {
          created_at: string
          created_by: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_key: string
          storage_url: string | null
          superseded_by_attachment_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_key: string
          storage_url?: string | null
          superseded_by_attachment_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_key?: string
          storage_url?: string | null
          superseded_by_attachment_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_attachments_superseded_by_attachment_id_fkey"
            columns: ["superseded_by_attachment_id"]
            isOneToOne: false
            referencedRelation: "file_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_custom_field_values: {
        Row: {
          created_at: string
          deleted_at: string | null
          field_key: string
          id: string
          item_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          field_key: string
          id?: string
          item_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          field_key?: string
          id?: string
          item_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_custom_field_values_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_custom_field_values_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
        ]
      }
      item_notes: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          item_id: string
          note: string
          note_type: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          item_id: string
          note: string
          note_type?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          item_id?: string
          note?: string
          note_type?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          assembly_status: string | null
          client_account: string | null
          created_at: string
          current_location_id: string | null
          deleted_at: string | null
          description: string | null
          id: string
          inspection_status: string | null
          item_code: string
          metadata: Json | null
          quantity: number
          received_at: string | null
          repair_status: string | null
          sidemark: string | null
          size: number | null
          size_unit: string | null
          status: string
          tenant_id: string
          updated_at: string
          vendor: string | null
          warehouse_id: string
        }
        Insert: {
          assembly_status?: string | null
          client_account?: string | null
          created_at?: string
          current_location_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          inspection_status?: string | null
          item_code: string
          metadata?: Json | null
          quantity?: number
          received_at?: string | null
          repair_status?: string | null
          sidemark?: string | null
          size?: number | null
          size_unit?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          vendor?: string | null
          warehouse_id: string
        }
        Update: {
          assembly_status?: string | null
          client_account?: string | null
          created_at?: string
          current_location_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          inspection_status?: string | null
          item_code?: string
          metadata?: Json | null
          quantity?: number
          received_at?: string | null
          repair_status?: string | null
          sidemark?: string | null
          size?: number | null
          size_unit?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          vendor?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          capacity: number | null
          code: string
          created_at: string
          current_utilization: number | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          name: string | null
          parent_location_id: string | null
          status: string
          type: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          capacity?: number | null
          code: string
          created_at?: string
          current_utilization?: number | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          parent_location_id?: string | null
          status?: string
          type: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          capacity?: number | null
          code?: string
          created_at?: string
          current_utilization?: number | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          parent_location_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_type: string
          batch_id: string | null
          created_at: string
          from_location_id: string | null
          id: string
          item_id: string
          metadata: Json | null
          moved_at: string
          note: string | null
          quantity: number | null
          to_location_id: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_type: string
          batch_id?: string | null
          created_at?: string
          from_location_id?: string | null
          id?: string
          item_id: string
          metadata?: Json | null
          moved_at?: string
          note?: string | null
          quantity?: number | null
          to_location_id?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_type?: string
          batch_id?: string | null
          created_at?: string
          from_location_id?: string | null
          id?: string
          item_id?: string
          metadata?: Json | null
          moved_at?: string
          note?: string | null
          quantity?: number | null
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          alert_type_id: string
          body_rendered_html: string
          body_rendered_text: string
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          last_retry_at: string | null
          next_retry_at: string | null
          provider: string
          provider_message_id: string | null
          provider_response: Json | null
          retry_count: number | null
          sent_at: string | null
          status: string
          subject_rendered: string
          tenant_id: string
          to_email: string
        }
        Insert: {
          alert_type_id: string
          body_rendered_html: string
          body_rendered_text: string
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          next_retry_at?: string | null
          provider: string
          provider_message_id?: string | null
          provider_response?: Json | null
          retry_count?: number | null
          sent_at?: string | null
          status: string
          subject_rendered: string
          tenant_id: string
          to_email: string
        }
        Update: {
          alert_type_id?: string
          body_rendered_html?: string
          body_rendered_text?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          next_retry_at?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject_rendered?: string
          tenant_id?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_alert_type_id_fkey"
            columns: ["alert_type_id"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          alert_type_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_payload: Json
          id: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          alert_type_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_payload: Json
          id?: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          alert_type_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_payload?: Json
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_alert_type_id_fkey"
            columns: ["alert_type_id"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expiration_date: string | null
          expiration_type: Database["public"]["Enums"]["expiration_type"]
          id: string
          is_active: boolean
          selected_services: Json | null
          service_scope: Database["public"]["Enums"]["service_scope_type"]
          tenant_id: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
          usage_limit_type: Database["public"]["Enums"]["usage_limit_type"]
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expiration_date?: string | null
          expiration_type: Database["public"]["Enums"]["expiration_type"]
          id?: string
          is_active?: boolean
          selected_services?: Json | null
          service_scope: Database["public"]["Enums"]["service_scope_type"]
          tenant_id: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          usage_limit_type: Database["public"]["Enums"]["usage_limit_type"]
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expiration_date?: string | null
          expiration_type?: Database["public"]["Enums"]["expiration_type"]
          id?: string
          is_active?: boolean
          selected_services?: Json | null
          service_scope?: Database["public"]["Enums"]["service_scope_type"]
          tenant_id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          usage_limit_type?: Database["public"]["Enums"]["usage_limit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_details: {
        Row: {
          charge_unit: string
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json | null
          minimum_charge: number | null
          rate: number
          rate_card_id: string
          service_description: string | null
          service_type: string
          size_threshold: number | null
          updated_at: string
        }
        Insert: {
          charge_unit: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          minimum_charge?: number | null
          rate: number
          rate_card_id: string
          service_description?: string | null
          service_type: string
          size_threshold?: number | null
          updated_at?: string
        }
        Update: {
          charge_unit?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          minimum_charge?: number | null
          rate?: number
          rate_card_id?: string
          service_description?: string | null
          service_type?: string
          size_threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_details_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_cards: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          effective_date: string
          expiration_date: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          metadata: Json | null
          rate_card_code: string
          rate_card_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          effective_date?: string
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          metadata?: Json | null
          rate_card_code: string
          rate_card_name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          effective_date?: string
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          metadata?: Json | null
          rate_card_code?: string
          rate_card_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_cards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_batches: {
        Row: {
          batch_number: string
          completed_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          received_by: string | null
          status: string
          tenant_id: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          batch_number: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          received_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          batch_number?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          received_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receiving_batches_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          permissions: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          permissions?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          permissions?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          priority: string | null
          related_item_id: string | null
          status: string
          task_type: string
          tenant_id: string
          title: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          related_item_id?: string | null
          status?: string
          task_type: string
          tenant_id: string
          title: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          related_item_id?: string | null
          status?: string
          task_type?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_item_id_fkey"
            columns: ["related_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_item_id_fkey"
            columns: ["related_item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_alert_settings: {
        Row: {
          alert_type_id: string
          body_override_html: string | null
          body_override_text: string | null
          created_at: string
          enabled: boolean
          id: string
          subject_override: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_type_id: string
          body_override_html?: string | null
          body_override_text?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          subject_override?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_type_id?: string
          body_override_html?: string | null
          body_override_text?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          subject_override?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_alert_settings_alert_type_id_fkey"
            columns: ["alert_type_id"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_alert_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_alert_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_email_layouts: {
        Row: {
          background_color: string | null
          body_font_size: string | null
          content_padding: number | null
          created_at: string | null
          custom_css: string | null
          font_family: string | null
          footer_background_color: string | null
          footer_links: Json | null
          footer_text: string | null
          header_background_color: string | null
          header_font_size: string | null
          id: string
          is_active: boolean | null
          layout_width: number | null
          logo_height: number | null
          logo_url: string | null
          logo_width: number | null
          primary_color: string | null
          secondary_color: string | null
          social_links: Json | null
          tenant_id: string
          text_color: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          background_color?: string | null
          body_font_size?: string | null
          content_padding?: number | null
          created_at?: string | null
          custom_css?: string | null
          font_family?: string | null
          footer_background_color?: string | null
          footer_links?: Json | null
          footer_text?: string | null
          header_background_color?: string | null
          header_font_size?: string | null
          id?: string
          is_active?: boolean | null
          layout_width?: number | null
          logo_height?: number | null
          logo_url?: string | null
          logo_width?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          social_links?: Json | null
          tenant_id: string
          text_color?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          background_color?: string | null
          body_font_size?: string | null
          content_padding?: number | null
          created_at?: string | null
          custom_css?: string | null
          font_family?: string | null
          footer_background_color?: string | null
          footer_links?: Json | null
          footer_text?: string | null
          header_background_color?: string | null
          header_font_size?: string | null
          id?: string
          is_active?: boolean | null
          layout_width?: number | null
          logo_height?: number | null
          logo_url?: string | null
          logo_width?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          social_links?: Json | null
          tenant_id?: string
          text_color?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_email_layouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_email_layouts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          password_hash: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          password_hash: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          password_hash?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_permissions: {
        Row: {
          created_at: string
          deleted_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_permissions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          postal_code: string | null
          settings: Json | null
          state: string | null
          status: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          postal_code?: string | null
          settings?: Json | null
          state?: string | null
          status?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          settings?: Json | null
          state?: string | null
          status?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      will_call_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          item_code: string
          item_id: string | null
          quantity: number | null
          will_call_order_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_code: string
          item_id?: string | null
          quantity?: number | null
          will_call_order_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_code?: string
          item_id?: string | null
          quantity?: number | null
          will_call_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "will_call_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "will_call_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "will_call_items_will_call_order_id_fkey"
            columns: ["will_call_order_id"]
            isOneToOne: false
            referencedRelation: "will_call_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      will_call_orders: {
        Row: {
          client_account: string | null
          client_name: string
          completed_at: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_number: string
          scheduled_pickup_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          client_account?: string | null
          client_name: string
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_number: string
          scheduled_pickup_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          client_account?: string | null
          client_name?: string
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_number?: string
          scheduled_pickup_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "will_call_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_items_with_location: {
        Row: {
          assembly_status: string | null
          client_account: string | null
          created_at: string | null
          current_location_id: string | null
          deleted_at: string | null
          description: string | null
          id: string | null
          inspection_status: string | null
          item_code: string | null
          location_code: string | null
          location_name: string | null
          location_type: string | null
          metadata: Json | null
          quantity: number | null
          received_at: string | null
          repair_status: string | null
          sidemark: string | null
          size: number | null
          size_unit: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          vendor: string | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_movement_history: {
        Row: {
          action_type: string | null
          actor_email: string | null
          actor_first_name: string | null
          actor_id: string | null
          actor_last_name: string | null
          actor_type: string | null
          batch_id: string | null
          created_at: string | null
          from_location_code: string | null
          from_location_id: string | null
          id: string | null
          item_code: string | null
          item_description: string | null
          item_id: string | null
          metadata: Json | null
          moved_at: string | null
          note: string | null
          quantity: number | null
          to_location_code: string | null
          to_location_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_past_due_tasks: { Args: never; Returns: undefined }
      current_user_id: { Args: never; Returns: string }
      get_current_user_tenant_id: { Args: never; Returns: string }
      is_tenant_admin:
        | { Args: never; Returns: boolean }
        | {
            Args: { tenant_id_param: string; user_id: string }
            Returns: boolean
          }
      is_warehouse_staff: {
        Args: { tenant_id_param: string; user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { p_permission: string; p_user_id: string }
        Returns: boolean
      }
      user_has_role: {
        Args: { p_role_name: string; p_user_id: string }
        Returns: boolean
      }
      user_has_warehouse_access: {
        Args: { p_user_id: string; p_warehouse_id: string }
        Returns: boolean
      }
      user_tenant_id: { Args: never; Returns: string }
    }
    Enums: {
      discount_type: "percentage" | "flat_rate"
      expiration_type: "none" | "date"
      service_scope_type: "all" | "selected"
      usage_limit_type: "unlimited" | "limited"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      discount_type: ["percentage", "flat_rate"],
      expiration_type: ["none", "date"],
      service_scope_type: ["all", "selected"],
      usage_limit_type: ["unlimited", "limited"],
    },
  },
} as const
