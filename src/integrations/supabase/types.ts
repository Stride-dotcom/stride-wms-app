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
      account_additional_charges: {
        Row: {
          account_id: string
          charge_amount: number
          charge_description: string | null
          charge_name: string
          charge_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          charge_amount: number
          charge_description?: string | null
          charge_name: string
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          charge_amount?: number
          charge_description?: string | null
          charge_name?: string
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_additional_charges_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_additional_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      account_item_type_overrides: {
        Row: {
          account_id: string
          created_at: string | null
          created_by: string | null
          custom_packaging_rate: number | null
          id: string
          item_type_id: string
          minor_touchup_rate: number | null
          packing_rate: number | null
          pallet_sale_rate: number | null
          picking_rate: number | null
          receiving_rate: number | null
          shipping_rate: number | null
          storage_billing_frequency: string | null
          storage_rate: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          created_by?: string | null
          custom_packaging_rate?: number | null
          id?: string
          item_type_id: string
          minor_touchup_rate?: number | null
          packing_rate?: number | null
          pallet_sale_rate?: number | null
          picking_rate?: number | null
          receiving_rate?: number | null
          shipping_rate?: number | null
          storage_billing_frequency?: string | null
          storage_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          created_by?: string | null
          custom_packaging_rate?: number | null
          id?: string
          item_type_id?: string
          minor_touchup_rate?: number | null
          packing_rate?: number | null
          pallet_sale_rate?: number | null
          picking_rate?: number | null
          receiving_rate?: number | null
          shipping_rate?: number | null
          storage_billing_frequency?: string | null
          storage_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_item_type_overrides_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_item_type_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_item_type_overrides_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
        ]
      }
      account_rate_overrides: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          custom_packaging_rate: number | null
          deleted_at: string | null
          id: string
          item_type_id: string
          minor_touchup_rate: number | null
          packing_rate: number | null
          pallet_sale_rate: number | null
          picking_rate: number | null
          receiving_rate: number | null
          shipping_rate: number | null
          storage_billing_frequency: string | null
          storage_rate: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          custom_packaging_rate?: number | null
          deleted_at?: string | null
          id?: string
          item_type_id: string
          minor_touchup_rate?: number | null
          packing_rate?: number | null
          pallet_sale_rate?: number | null
          picking_rate?: number | null
          receiving_rate?: number | null
          shipping_rate?: number | null
          storage_billing_frequency?: string | null
          storage_rate?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          custom_packaging_rate?: number | null
          deleted_at?: string | null
          id?: string
          item_type_id?: string
          minor_touchup_rate?: number | null
          packing_rate?: number | null
          pallet_sale_rate?: number | null
          picking_rate?: number | null
          receiving_rate?: number | null
          shipping_rate?: number | null
          storage_billing_frequency?: string | null
          storage_rate?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_rate_overrides_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_rate_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_rate_overrides_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_rate_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      account_room_suggestions: {
        Row: {
          account_id: string
          created_at: string
          id: string
          last_used_at: string
          room: string
          usage_count: number
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          last_used_at?: string
          room: string
          usage_count?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          last_used_at?: string
          room?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_room_suggestions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_sidemarks: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          sidemark: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          sidemark: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sidemark?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_sidemarks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_task_permissions: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          is_allowed: boolean | null
          task_type_id: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          is_allowed?: boolean | null
          task_type_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          is_allowed?: boolean | null
          task_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_task_permissions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_task_permissions_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          access_level: string | null
          account_alert_recipients: string | null
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
          billing_schedule: string | null
          billing_state: string | null
          billing_type: string | null
          can_delete_accounts: boolean | null
          can_modify_pricing: boolean | null
          communication_settings: Json | null
          copy_from_account_id: string | null
          created_at: string
          credit_hold: boolean | null
          credit_limit: number | null
          credit_limit_amount: number | null
          currency: string | null
          default_receiving_location_id: string | null
          default_receiving_notes: string | null
          default_receiving_status: string | null
          deleted_at: string | null
          disable_email_communications: boolean | null
          email_html_body_override: string | null
          email_recipients_override: string | null
          email_subject_override: string | null
          email_variables: Json | null
          hide_internal_fields_from_clients: boolean | null
          id: string
          is_master_account: boolean | null
          metadata: Json | null
          net_terms: number | null
          notes: string | null
          parent_account_id: string | null
          payment_terms: string | null
          prepay_required: boolean | null
          pricing_level: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          rate_card_id: string | null
          read_only_access: boolean | null
          require_inspection_photos: boolean | null
          require_sidemark: boolean | null
          restrict_visible_columns: Json | null
          status: string
          tenant_id: string
          updated_at: string
          use_tenant_communication_defaults: boolean | null
          use_tenant_email_defaults: boolean | null
        }
        Insert: {
          access_level?: string | null
          account_alert_recipients?: string | null
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
          billing_schedule?: string | null
          billing_state?: string | null
          billing_type?: string | null
          can_delete_accounts?: boolean | null
          can_modify_pricing?: boolean | null
          communication_settings?: Json | null
          copy_from_account_id?: string | null
          created_at?: string
          credit_hold?: boolean | null
          credit_limit?: number | null
          credit_limit_amount?: number | null
          currency?: string | null
          default_receiving_location_id?: string | null
          default_receiving_notes?: string | null
          default_receiving_status?: string | null
          deleted_at?: string | null
          disable_email_communications?: boolean | null
          email_html_body_override?: string | null
          email_recipients_override?: string | null
          email_subject_override?: string | null
          email_variables?: Json | null
          hide_internal_fields_from_clients?: boolean | null
          id?: string
          is_master_account?: boolean | null
          metadata?: Json | null
          net_terms?: number | null
          notes?: string | null
          parent_account_id?: string | null
          payment_terms?: string | null
          prepay_required?: boolean | null
          pricing_level?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          rate_card_id?: string | null
          read_only_access?: boolean | null
          require_inspection_photos?: boolean | null
          require_sidemark?: boolean | null
          restrict_visible_columns?: Json | null
          status?: string
          tenant_id: string
          updated_at?: string
          use_tenant_communication_defaults?: boolean | null
          use_tenant_email_defaults?: boolean | null
        }
        Update: {
          access_level?: string | null
          account_alert_recipients?: string | null
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
          billing_schedule?: string | null
          billing_state?: string | null
          billing_type?: string | null
          can_delete_accounts?: boolean | null
          can_modify_pricing?: boolean | null
          communication_settings?: Json | null
          copy_from_account_id?: string | null
          created_at?: string
          credit_hold?: boolean | null
          credit_limit?: number | null
          credit_limit_amount?: number | null
          currency?: string | null
          default_receiving_location_id?: string | null
          default_receiving_notes?: string | null
          default_receiving_status?: string | null
          deleted_at?: string | null
          disable_email_communications?: boolean | null
          email_html_body_override?: string | null
          email_recipients_override?: string | null
          email_subject_override?: string | null
          email_variables?: Json | null
          hide_internal_fields_from_clients?: boolean | null
          id?: string
          is_master_account?: boolean | null
          metadata?: Json | null
          net_terms?: number | null
          notes?: string | null
          parent_account_id?: string | null
          payment_terms?: string | null
          prepay_required?: boolean | null
          pricing_level?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          rate_card_id?: string | null
          read_only_access?: boolean | null
          require_inspection_photos?: boolean | null
          require_sidemark?: boolean | null
          restrict_visible_columns?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string
          use_tenant_communication_defaults?: boolean | null
          use_tenant_email_defaults?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_copy_from_account_id_fkey"
            columns: ["copy_from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          changes_json: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id: string
          changes_json?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          changes_json?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      alert_queue: {
        Row: {
          alert_type: string
          body_html: string | null
          body_text: string | null
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          recipient_emails: string[] | null
          sent_at: string | null
          status: string | null
          subject: string
          tenant_id: string
        }
        Insert: {
          alert_type: string
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          recipient_emails?: string[] | null
          sent_at?: string | null
          status?: string | null
          subject: string
          tenant_id: string
        }
        Update: {
          alert_type?: string
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          recipient_emails?: string[] | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          tenant_id?: string
        }
        Relationships: []
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
      billing_charge_templates: {
        Row: {
          amount: number
          charge_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_charge_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charge_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          account_id: string | null
          charge_type: string
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          item_id: string | null
          needs_review: boolean | null
          quantity: number | null
          rate_source: string | null
          service_category: string | null
          task_id: string | null
          tenant_id: string
          total_amount: number
          unit_rate: number
        }
        Insert: {
          account_id?: string | null
          charge_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          item_id?: string | null
          needs_review?: boolean | null
          quantity?: number | null
          rate_source?: string | null
          service_category?: string | null
          task_id?: string | null
          tenant_id: string
          total_amount: number
          unit_rate: number
        }
        Update: {
          account_id?: string | null
          charge_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          item_id?: string | null
          needs_review?: boolean | null
          quantity?: number | null
          rate_source?: string | null
          service_category?: string | null
          task_id?: string | null
          tenant_id?: string
          total_amount?: number
          unit_rate?: number
        }
        Relationships: []
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
      communication_alerts: {
        Row: {
          channels: Json
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          key: string
          name: string
          tenant_id: string
          timing_rule: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          channels?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          key: string
          name: string
          tenant_id: string
          timing_rule?: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          channels?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          key?: string
          name?: string
          tenant_id?: string
          timing_rule?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_brand_settings: {
        Row: {
          brand_logo_url: string | null
          brand_primary_color: string
          brand_support_email: string | null
          created_at: string
          custom_email_domain: string | null
          dkim_verified: boolean | null
          email_domain_verified: boolean | null
          email_verification_token: string | null
          email_verification_type: string | null
          email_verified_at: string | null
          from_email: string | null
          from_name: string | null
          id: string
          portal_base_url: string | null
          resend_dns_records: Json | null
          resend_domain_id: string | null
          sms_sender_id: string | null
          spf_verified: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand_logo_url?: string | null
          brand_primary_color?: string
          brand_support_email?: string | null
          created_at?: string
          custom_email_domain?: string | null
          dkim_verified?: boolean | null
          email_domain_verified?: boolean | null
          email_verification_token?: string | null
          email_verification_type?: string | null
          email_verified_at?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          portal_base_url?: string | null
          resend_dns_records?: Json | null
          resend_domain_id?: string | null
          sms_sender_id?: string | null
          spf_verified?: boolean | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand_logo_url?: string | null
          brand_primary_color?: string
          brand_support_email?: string | null
          created_at?: string
          custom_email_domain?: string | null
          dkim_verified?: boolean | null
          email_domain_verified?: boolean | null
          email_verification_token?: string | null
          email_verification_type?: string | null
          email_verified_at?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          portal_base_url?: string | null
          resend_dns_records?: Json | null
          resend_domain_id?: string | null
          sms_sender_id?: string | null
          spf_verified?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_brand_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_design_elements: {
        Row: {
          category: string
          created_at: string
          html_snippet: string
          id: string
          is_system: boolean
          name: string
          tenant_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          html_snippet: string
          id?: string
          is_system?: boolean
          name: string
          tenant_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          html_snippet?: string
          id?: string
          is_system?: boolean
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_design_elements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_template_versions: {
        Row: {
          body_template: string
          created_at: string
          created_by: string | null
          id: string
          subject_template: string | null
          template_id: string
          version_number: number
        }
        Insert: {
          body_template: string
          created_at?: string
          created_by?: string | null
          id?: string
          subject_template?: string | null
          template_id: string
          version_number: number
        }
        Update: {
          body_template?: string
          created_at?: string
          created_by?: string | null
          id?: string
          subject_template?: string | null
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "communication_template_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          alert_id: string
          body_format: string
          body_template: string
          channel: string
          created_at: string
          from_email: string | null
          from_name: string | null
          id: string
          sms_sender_id: string | null
          subject_template: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alert_id: string
          body_format?: string
          body_template: string
          channel: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          sms_sender_id?: string | null
          subject_template?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alert_id?: string
          body_format?: string
          body_template?: string
          channel?: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          sms_sender_id?: string | null
          subject_template?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "communication_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_templates_tenant_id_fkey"
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
      custom_billing_charges: {
        Row: {
          account_id: string | null
          amount: number
          charge_date: string
          charge_name: string
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          item_id: string | null
          task_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          charge_date?: string
          charge_name: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          item_id?: string | null
          task_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          charge_date?: string
          charge_name?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          item_id?: string | null
          task_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_billing_charges_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_billing_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_billing_charges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_billing_charges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_billing_charges_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_billing_charges_tenant_id_fkey"
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
      disposal_order_items: {
        Row: {
          created_at: string
          disposal_order_id: string
          id: string
          item_id: string
        }
        Insert: {
          created_at?: string
          disposal_order_id: string
          id?: string
          item_id: string
        }
        Update: {
          created_at?: string
          disposal_order_id?: string
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disposal_order_items_disposal_order_id_fkey"
            columns: ["disposal_order_id"]
            isOneToOne: false
            referencedRelation: "disposal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposal_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposal_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
        ]
      }
      disposal_orders: {
        Row: {
          account_id: string | null
          bill_to: string | null
          bill_to_customer_name: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          deleted_at: string | null
          disposal_method: string | null
          disposal_reason: string | null
          id: string
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          bill_to?: string | null
          bill_to_customer_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          disposal_method?: string | null
          disposal_reason?: string | null
          id?: string
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          bill_to?: string | null
          bill_to_customer_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          disposal_method?: string | null
          disposal_reason?: string | null
          id?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disposal_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposal_orders_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposal_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      due_date_rules: {
        Row: {
          account_id: string | null
          created_at: string | null
          days_from_creation: number
          id: string
          is_active: boolean | null
          task_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          days_from_creation?: number
          id?: string
          is_active?: boolean | null
          task_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          days_from_creation?: number
          id?: string
          is_active?: boolean | null
          task_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "due_date_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_date_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_pay: {
        Row: {
          cost_center: string | null
          created_at: string
          id: string
          overtime_eligible: boolean
          pay_rate: number
          pay_type: string
          primary_warehouse_id: string | null
          salary_hourly_equivalent: number | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_center?: string | null
          created_at?: string
          id?: string
          overtime_eligible?: boolean
          pay_rate?: number
          pay_type?: string
          primary_warehouse_id?: string | null
          salary_hourly_equivalent?: number | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_center?: string | null
          created_at?: string
          id?: string
          overtime_eligible?: boolean
          pay_rate?: number
          pay_type?: string
          primary_warehouse_id?: string | null
          salary_hourly_equivalent?: number | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_pay_primary_warehouse_id_fkey"
            columns: ["primary_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pay_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pay_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      field_suggestions: {
        Row: {
          created_at: string | null
          field_name: string
          id: string
          last_used_at: string | null
          tenant_id: string
          usage_count: number | null
          value: string
        }
        Insert: {
          created_at?: string | null
          field_name: string
          id?: string
          last_used_at?: string | null
          tenant_id: string
          usage_count?: number | null
          value: string
        }
        Update: {
          created_at?: string | null
          field_name?: string
          id?: string
          last_used_at?: string | null
          tenant_id?: string
          usage_count?: number | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_suggestions_tenant_id_fkey"
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
      inventory_column_configs: {
        Row: {
          account_id: string | null
          column_key: string
          column_width: number | null
          created_at: string | null
          data_type: string | null
          display_label: string
          id: string
          is_required: boolean | null
          is_visible: boolean | null
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          column_key: string
          column_width?: number | null
          created_at?: string | null
          data_type?: string | null
          display_label: string
          id?: string
          is_required?: boolean | null
          is_visible?: boolean | null
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          column_key?: string
          column_width?: number | null
          created_at?: string | null
          data_type?: string | null
          display_label?: string
          id?: string
          is_required?: boolean | null
          is_visible?: boolean | null
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_column_configs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_column_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          account_code: string | null
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          item_code: string | null
          item_id: string | null
          line_item_type: string
          line_total: number
          quantity: number | null
          service_date: string | null
          service_type: string | null
          sort_order: number | null
          task_id: string | null
          task_item_id: string | null
          unit_price: number
        }
        Insert: {
          account_code?: string | null
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          item_code?: string | null
          item_id?: string | null
          line_item_type: string
          line_total: number
          quantity?: number | null
          service_date?: string | null
          service_type?: string | null
          sort_order?: number | null
          task_id?: string | null
          task_item_id?: string | null
          unit_price: number
        }
        Update: {
          account_code?: string | null
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          item_code?: string | null
          item_id?: string | null
          line_item_type?: string
          line_total?: number
          quantity?: number | null
          service_date?: string | null
          service_type?: string | null
          sort_order?: number | null
          task_id?: string | null
          task_item_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_task_item_id_fkey"
            columns: ["task_item_id"]
            isOneToOne: false
            referencedRelation: "task_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          due_date: string | null
          group_by: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_amount: number | null
          paid_date: string | null
          period_end: string | null
          period_start: string | null
          sort_by: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          tenant_id: string
          terms: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          due_date?: string | null
          group_by?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          period_end?: string | null
          period_start?: string | null
          sort_by?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id: string
          terms?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          due_date?: string | null
          group_by?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          period_end?: string | null
          period_start?: string | null
          sort_by?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id?: string
          terms?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_additional_charges: {
        Row: {
          charge_amount: number
          charge_description: string | null
          charge_name: string
          charge_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          item_id: string
          updated_at: string | null
        }
        Insert: {
          charge_amount: number
          charge_description?: string | null
          charge_name: string
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          item_id: string
          updated_at?: string | null
        }
        Update: {
          charge_amount?: number
          charge_description?: string | null
          charge_name?: string
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          item_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_additional_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_additional_charges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_additional_charges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
        ]
      }
      item_custom_charges: {
        Row: {
          charge_amount: number
          charge_description: string | null
          charge_name: string
          created_at: string | null
          created_by: string | null
          id: string
          item_id: string
          tenant_id: string
        }
        Insert: {
          charge_amount: number
          charge_description?: string | null
          charge_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_id: string
          tenant_id: string
        }
        Update: {
          charge_amount?: number
          charge_description?: string | null
          charge_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_custom_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_custom_charges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_custom_charges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_custom_charges_tenant_id_fkey"
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
          custom_field_id: string | null
          deleted_at: string | null
          field_key: string
          id: string
          item_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          custom_field_id?: string | null
          deleted_at?: string | null
          field_key: string
          id?: string
          item_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          custom_field_id?: string | null
          deleted_at?: string | null
          field_key?: string
          id?: string
          item_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_custom_field_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "tenant_custom_fields"
            referencedColumns: ["id"]
          },
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
          is_current: boolean | null
          item_id: string
          note: string
          note_type: string | null
          parent_note_id: string | null
          tenant_id: string | null
          updated_at: string
          version: number | null
          visibility: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          is_current?: boolean | null
          item_id: string
          note: string
          note_type?: string | null
          parent_note_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          version?: number | null
          visibility?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          is_current?: boolean | null
          item_id?: string
          note?: string
          note_type?: string | null
          parent_note_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          version?: number | null
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
          {
            foreignKeyName: "item_notes_parent_note_id_fkey"
            columns: ["parent_note_id"]
            isOneToOne: false
            referencedRelation: "item_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_photos: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          is_primary: boolean | null
          item_id: string
          mime_type: string | null
          needs_attention: boolean | null
          photo_type: string | null
          storage_key: string
          storage_url: string | null
          tenant_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          is_primary?: boolean | null
          item_id: string
          mime_type?: string | null
          needs_attention?: boolean | null
          photo_type?: string | null
          storage_key: string
          storage_url?: string | null
          tenant_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          is_primary?: boolean | null
          item_id?: string
          mime_type?: string | null
          needs_attention?: boolean | null
          photo_type?: string | null
          storage_key?: string
          storage_url?: string | null
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_photos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_photos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
        ]
      }
      item_types: {
        Row: {
          allow_on_order_entry: boolean | null
          allow_on_reservation: boolean | null
          assemblies_in_base_rate: number | null
          assembly_rate: number | null
          auto_add_assembly_fee: boolean | null
          billing_pieces: number | null
          crated_rate: number | null
          created_at: string | null
          created_by: string | null
          cubic_feet: number | null
          custom_packaging_rate: number | null
          default_item_notes: string | null
          delivery_pieces: number | null
          dimension_unit: string | null
          disposal_rate: number | null
          extra_fee: number | null
          felt_pad_price: number | null
          height: number | null
          id: string
          inspection_fee: number | null
          is_active: boolean | null
          length: number | null
          minor_touchup_rate: number | null
          minutes_per_felt_pad: number | null
          minutes_to_assemble: number | null
          minutes_to_deliver: number | null
          minutes_to_inspect: number | null
          minutes_to_load: number | null
          minutes_to_move: number | null
          minutes_to_put_in_warehouse: number | null
          model_number: string | null
          move_rate: number | null
          name: string
          notify_dispatch: boolean | null
          oversize_rate: number | null
          overweight_rate: number | null
          packing_rate: number | null
          pallet_sale_rate: number | null
          people_to_deliver: number | null
          picking_rate: number | null
          pull_for_delivery_rate: number | null
          received_without_id_rate: number | null
          receiving_rate: number | null
          removal_rate: number | null
          same_day_assembly_rate: number | null
          shipping_rate: number | null
          sort_order: number | null
          storage_billing_frequency: string | null
          storage_rate: number | null
          storage_rate_per_day: number | null
          tenant_id: string
          unstackable_extra_fee: number | null
          updated_at: string | null
          weight: number | null
          weight_unit: string | null
          width: number | null
          will_call_rate: number | null
        }
        Insert: {
          allow_on_order_entry?: boolean | null
          allow_on_reservation?: boolean | null
          assemblies_in_base_rate?: number | null
          assembly_rate?: number | null
          auto_add_assembly_fee?: boolean | null
          billing_pieces?: number | null
          crated_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          cubic_feet?: number | null
          custom_packaging_rate?: number | null
          default_item_notes?: string | null
          delivery_pieces?: number | null
          dimension_unit?: string | null
          disposal_rate?: number | null
          extra_fee?: number | null
          felt_pad_price?: number | null
          height?: number | null
          id?: string
          inspection_fee?: number | null
          is_active?: boolean | null
          length?: number | null
          minor_touchup_rate?: number | null
          minutes_per_felt_pad?: number | null
          minutes_to_assemble?: number | null
          minutes_to_deliver?: number | null
          minutes_to_inspect?: number | null
          minutes_to_load?: number | null
          minutes_to_move?: number | null
          minutes_to_put_in_warehouse?: number | null
          model_number?: string | null
          move_rate?: number | null
          name: string
          notify_dispatch?: boolean | null
          oversize_rate?: number | null
          overweight_rate?: number | null
          packing_rate?: number | null
          pallet_sale_rate?: number | null
          people_to_deliver?: number | null
          picking_rate?: number | null
          pull_for_delivery_rate?: number | null
          received_without_id_rate?: number | null
          receiving_rate?: number | null
          removal_rate?: number | null
          same_day_assembly_rate?: number | null
          shipping_rate?: number | null
          sort_order?: number | null
          storage_billing_frequency?: string | null
          storage_rate?: number | null
          storage_rate_per_day?: number | null
          tenant_id: string
          unstackable_extra_fee?: number | null
          updated_at?: string | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
          will_call_rate?: number | null
        }
        Update: {
          allow_on_order_entry?: boolean | null
          allow_on_reservation?: boolean | null
          assemblies_in_base_rate?: number | null
          assembly_rate?: number | null
          auto_add_assembly_fee?: boolean | null
          billing_pieces?: number | null
          crated_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          cubic_feet?: number | null
          custom_packaging_rate?: number | null
          default_item_notes?: string | null
          delivery_pieces?: number | null
          dimension_unit?: string | null
          disposal_rate?: number | null
          extra_fee?: number | null
          felt_pad_price?: number | null
          height?: number | null
          id?: string
          inspection_fee?: number | null
          is_active?: boolean | null
          length?: number | null
          minor_touchup_rate?: number | null
          minutes_per_felt_pad?: number | null
          minutes_to_assemble?: number | null
          minutes_to_deliver?: number | null
          minutes_to_inspect?: number | null
          minutes_to_load?: number | null
          minutes_to_move?: number | null
          minutes_to_put_in_warehouse?: number | null
          model_number?: string | null
          move_rate?: number | null
          name?: string
          notify_dispatch?: boolean | null
          oversize_rate?: number | null
          overweight_rate?: number | null
          packing_rate?: number | null
          pallet_sale_rate?: number | null
          people_to_deliver?: number | null
          picking_rate?: number | null
          pull_for_delivery_rate?: number | null
          received_without_id_rate?: number | null
          receiving_rate?: number | null
          removal_rate?: number | null
          same_day_assembly_rate?: number | null
          shipping_rate?: number | null
          sort_order?: number | null
          storage_billing_frequency?: string | null
          storage_rate?: number | null
          storage_rate_per_day?: number | null
          tenant_id?: string
          unstackable_extra_fee?: number | null
          updated_at?: string | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
          will_call_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          has_damage: boolean | null
          id: string
          inspection_photos: Json | null
          inspection_status: string | null
          is_crated: boolean | null
          is_oversize: boolean | null
          is_overweight: boolean | null
          is_unstackable: boolean | null
          item_code: string
          item_type_id: string | null
          link: string | null
          metadata: Json | null
          minor_touchup_status: string | null
          needs_inspection: boolean | null
          needs_minor_touchup: boolean | null
          needs_repair: boolean | null
          needs_warehouse_assembly: boolean | null
          notify_dispatch: boolean | null
          photo_urls: Json | null
          primary_photo_url: string | null
          quantity: number
          received_at: string | null
          received_without_id: boolean | null
          released_at: string | null
          repair_photos: Json | null
          repair_status: string | null
          room: string | null
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
          has_damage?: boolean | null
          id?: string
          inspection_photos?: Json | null
          inspection_status?: string | null
          is_crated?: boolean | null
          is_oversize?: boolean | null
          is_overweight?: boolean | null
          is_unstackable?: boolean | null
          item_code: string
          item_type_id?: string | null
          link?: string | null
          metadata?: Json | null
          minor_touchup_status?: string | null
          needs_inspection?: boolean | null
          needs_minor_touchup?: boolean | null
          needs_repair?: boolean | null
          needs_warehouse_assembly?: boolean | null
          notify_dispatch?: boolean | null
          photo_urls?: Json | null
          primary_photo_url?: string | null
          quantity?: number
          received_at?: string | null
          received_without_id?: boolean | null
          released_at?: string | null
          repair_photos?: Json | null
          repair_status?: string | null
          room?: string | null
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
          has_damage?: boolean | null
          id?: string
          inspection_photos?: Json | null
          inspection_status?: string | null
          is_crated?: boolean | null
          is_oversize?: boolean | null
          is_overweight?: boolean | null
          is_unstackable?: boolean | null
          item_code?: string
          item_type_id?: string | null
          link?: string | null
          metadata?: Json | null
          minor_touchup_status?: string | null
          needs_inspection?: boolean | null
          needs_minor_touchup?: boolean | null
          needs_repair?: boolean | null
          needs_warehouse_assembly?: boolean | null
          notify_dispatch?: boolean | null
          photo_urls?: Json | null
          primary_photo_url?: string | null
          quantity?: number
          received_at?: string | null
          received_without_id?: boolean | null
          released_at?: string | null
          repair_photos?: Json | null
          repair_status?: string | null
          room?: string | null
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
            foreignKeyName: "items_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
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
      labor_settings: {
        Row: {
          created_at: string
          currency_code: string
          id: string
          overtime_multiplier: number
          rounding_rule_minutes: number
          standard_workweek_hours: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          id?: string
          overtime_multiplier?: number
          rounding_rule_minutes?: number
          standard_workweek_hours?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          id?: string
          overtime_multiplier?: number
          rounding_rule_minutes?: number
          standard_workweek_hours?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
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
          is_active: boolean | null
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
          is_active?: boolean | null
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
          is_active?: boolean | null
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
          category: string | null
          charge_unit: string
          created_at: string
          deleted_at: string | null
          id: string
          is_taxable: boolean | null
          item_type_id: string | null
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
          category?: string | null
          charge_unit: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type_id?: string | null
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
          category?: string | null
          charge_unit?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type_id?: string | null
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
            foreignKeyName: "rate_card_details_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
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
          receiving_documents: Json | null
          receiving_photos: Json | null
          status: string
          tenant_id: string
          updated_at: string | null
          vendor: string | null
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
          receiving_documents?: Json | null
          receiving_photos?: Json | null
          status?: string
          tenant_id: string
          updated_at?: string | null
          vendor?: string | null
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
          receiving_documents?: Json | null
          receiving_photos?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
          vendor?: string | null
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
      receiving_sessions: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          notes: string | null
          shipment_id: string
          started_at: string
          started_by: string
          status: string
          tenant_id: string
          updated_at: string
          verification_data: Json | null
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          shipment_id: string
          started_at?: string
          started_by: string
          status?: string
          tenant_id: string
          updated_at?: string
          verification_data?: Json | null
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          shipment_id?: string
          started_at?: string
          started_by?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          verification_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "receiving_sessions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_quotes: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          flat_rate: number | null
          id: string
          item_id: string
          notes: string | null
          technician_name: string | null
          technician_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          flat_rate?: number | null
          id?: string
          item_id: string
          notes?: string | null
          technician_name?: string | null
          technician_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          flat_rate?: number | null
          id?: string
          item_id?: string
          notes?: string | null
          technician_name?: string | null
          technician_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_quotes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_quotes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_tech_tokens: {
        Row: {
          accessed_at: string | null
          created_at: string
          expires_at: string
          id: string
          task_id: string
          technician_email: string | null
          technician_name: string | null
          tenant_id: string
          token: string
        }
        Insert: {
          accessed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          task_id: string
          technician_email?: string | null
          technician_name?: string | null
          tenant_id: string
          token: string
        }
        Update: {
          accessed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          task_id?: string
          technician_email?: string | null
          technician_name?: string | null
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_tech_tokens_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      shipment_items: {
        Row: {
          actual_quantity: number | null
          created_at: string
          expected_description: string | null
          expected_item_type_id: string | null
          expected_quantity: number
          expected_sidemark: string | null
          expected_vendor: string | null
          id: string
          item_id: string | null
          notes: string | null
          received_at: string | null
          released_at: string | null
          shipment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_quantity?: number | null
          created_at?: string
          expected_description?: string | null
          expected_item_type_id?: string | null
          expected_quantity?: number
          expected_sidemark?: string | null
          expected_vendor?: string | null
          id?: string
          item_id?: string | null
          notes?: string | null
          received_at?: string | null
          released_at?: string | null
          shipment_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_quantity?: number | null
          created_at?: string
          expected_description?: string | null
          expected_item_type_id?: string | null
          expected_quantity?: number
          expected_sidemark?: string | null
          expected_vendor?: string | null
          id?: string
          item_id?: string | null
          notes?: string | null
          received_at?: string | null
          released_at?: string | null
          shipment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_expected_item_type_id_fkey"
            columns: ["expected_item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          account_id: string | null
          bill_to: string | null
          carrier: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expected_arrival_date: string | null
          id: string
          metadata: Json | null
          notes: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          po_number: string | null
          received_at: string | null
          receiving_documents: Json | null
          receiving_notes: string | null
          receiving_photos: Json | null
          release_to_email: string | null
          release_to_name: string | null
          release_to_phone: string | null
          release_type: string | null
          return_type: string | null
          shipment_number: string
          shipment_type: string
          signature_data: string | null
          signature_name: string | null
          signature_timestamp: string | null
          status: string
          tenant_id: string
          tracking_number: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          account_id?: string | null
          bill_to?: string | null
          carrier?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expected_arrival_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          po_number?: string | null
          received_at?: string | null
          receiving_documents?: Json | null
          receiving_notes?: string | null
          receiving_photos?: Json | null
          release_to_email?: string | null
          release_to_name?: string | null
          release_to_phone?: string | null
          release_type?: string | null
          return_type?: string | null
          shipment_number: string
          shipment_type?: string
          signature_data?: string | null
          signature_name?: string | null
          signature_timestamp?: string | null
          status?: string
          tenant_id: string
          tracking_number?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          account_id?: string | null
          bill_to?: string | null
          carrier?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expected_arrival_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          po_number?: string | null
          received_at?: string | null
          receiving_documents?: Json | null
          receiving_notes?: string | null
          receiving_photos?: Json | null
          release_to_email?: string | null
          release_to_name?: string | null
          release_to_phone?: string | null
          release_type?: string | null
          return_type?: string | null
          shipment_number?: string
          shipment_type?: string
          signature_data?: string | null
          signature_name?: string | null
          signature_timestamp?: string | null
          status?: string
          tenant_id?: string
          tracking_number?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          id: string
          is_completed: boolean | null
          sort_order: number | null
          task_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          sort_order?: number | null
          task_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          sort_order?: number | null
          task_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_additional_charges: {
        Row: {
          charge_amount: number
          charge_description: string | null
          charge_name: string
          charge_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_applied: boolean | null
          task_id: string
          updated_at: string | null
        }
        Insert: {
          charge_amount: number
          charge_description?: string | null
          charge_name: string
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_applied?: boolean | null
          task_id: string
          updated_at?: string | null
        }
        Update: {
          charge_amount?: number
          charge_description?: string | null
          charge_name?: string
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_applied?: boolean | null
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_additional_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_additional_charges_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_custom_charges: {
        Row: {
          charge_amount: number
          charge_description: string | null
          charge_name: string
          charge_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          task_id: string
          template_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          charge_amount: number
          charge_description?: string | null
          charge_name: string
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          task_id: string
          template_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          charge_amount?: number
          charge_description?: string | null
          charge_name?: string
          charge_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          task_id?: string
          template_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_custom_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_custom_charges_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_custom_charges_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "billing_charge_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_custom_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      task_items: {
        Row: {
          apply_custom_packaging: boolean | null
          apply_minor_touchup: boolean | null
          apply_pallet_sale: boolean | null
          base_service_charge: number | null
          created_at: string | null
          custom_packaging_charge: number | null
          id: string
          item_id: string
          item_type_id: string | null
          minor_touchup_charge: number | null
          pallet_sale_charge: number | null
          quantity: number | null
          task_id: string
          total_charge: number | null
          updated_at: string | null
        }
        Insert: {
          apply_custom_packaging?: boolean | null
          apply_minor_touchup?: boolean | null
          apply_pallet_sale?: boolean | null
          base_service_charge?: number | null
          created_at?: string | null
          custom_packaging_charge?: number | null
          id?: string
          item_id: string
          item_type_id?: string | null
          minor_touchup_charge?: number | null
          pallet_sale_charge?: number | null
          quantity?: number | null
          task_id: string
          total_charge?: number | null
          updated_at?: string | null
        }
        Update: {
          apply_custom_packaging?: boolean | null
          apply_minor_touchup?: boolean | null
          apply_pallet_sale?: boolean | null
          base_service_charge?: number | null
          created_at?: string | null
          custom_packaging_charge?: number | null
          id?: string
          item_id?: string
          item_type_id?: string | null
          minor_touchup_charge?: number | null
          pallet_sale_charge?: number | null
          quantity?: number | null
          task_id?: string
          total_charge?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_items_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_items_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_required: boolean | null
          note: string
          note_type: string | null
          parent_note_id: string | null
          task_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_required?: boolean | null
          note: string
          note_type?: string | null
          parent_note_id?: string | null
          task_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_required?: boolean | null
          note?: string
          note_type?: string | null
          parent_note_id?: string | null
          task_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_types: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          account_id: string | null
          assigned_department: string | null
          assigned_to: string | null
          bill_to: string | null
          bill_to_customer_email: string | null
          bill_to_customer_name: string | null
          billing_charge_date: string | null
          billing_date: string | null
          billing_status: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          custom_packaging_applied: boolean | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          duration_minutes: number | null
          ended_at: string | null
          ended_by: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          minor_touchup_applied: boolean | null
          overdue_alert_sent_at: string | null
          pallet_sale_applied: boolean | null
          parent_task_id: string | null
          priority: string | null
          related_item_id: string | null
          service_date: string | null
          started_at: string | null
          started_by: string | null
          status: string
          task_type: string
          task_type_id: string | null
          tenant_id: string
          title: string
          unable_to_complete: boolean | null
          unable_to_complete_at: string | null
          unable_to_complete_by: string | null
          unable_to_complete_note: string | null
          unable_to_complete_reason: string | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          account_id?: string | null
          assigned_department?: string | null
          assigned_to?: string | null
          bill_to?: string | null
          bill_to_customer_email?: string | null
          bill_to_customer_name?: string | null
          billing_charge_date?: string | null
          billing_date?: string | null
          billing_status?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          custom_packaging_applied?: boolean | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          minor_touchup_applied?: boolean | null
          overdue_alert_sent_at?: string | null
          pallet_sale_applied?: boolean | null
          parent_task_id?: string | null
          priority?: string | null
          related_item_id?: string | null
          service_date?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          task_type: string
          task_type_id?: string | null
          tenant_id: string
          title: string
          unable_to_complete?: boolean | null
          unable_to_complete_at?: string | null
          unable_to_complete_by?: string | null
          unable_to_complete_note?: string | null
          unable_to_complete_reason?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          account_id?: string | null
          assigned_department?: string | null
          assigned_to?: string | null
          bill_to?: string | null
          bill_to_customer_email?: string | null
          bill_to_customer_name?: string | null
          billing_charge_date?: string | null
          billing_date?: string | null
          billing_status?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          custom_packaging_applied?: boolean | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          minor_touchup_applied?: boolean | null
          overdue_alert_sent_at?: string | null
          pallet_sale_applied?: boolean | null
          parent_task_id?: string | null
          priority?: string | null
          related_item_id?: string | null
          service_date?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          task_type?: string
          task_type_id?: string | null
          tenant_id?: string
          title?: string
          unable_to_complete?: boolean | null
          unable_to_complete_at?: string | null
          unable_to_complete_by?: string | null
          unable_to_complete_note?: string | null
          unable_to_complete_reason?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "tasks_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
            foreignKeyName: "tasks_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
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
      tenant_company_settings: {
        Row: {
          app_base_url: string | null
          app_subdomain: string | null
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_website: string | null
          created_at: string
          created_by: string | null
          email_signature_custom_text: string | null
          email_signature_enabled: boolean
          id: string
          logo_storage_path: string | null
          logo_url: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_base_url?: string | null
          app_subdomain?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          created_by?: string | null
          email_signature_custom_text?: string | null
          email_signature_enabled?: boolean
          id?: string
          logo_storage_path?: string | null
          logo_url?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_base_url?: string | null
          app_subdomain?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          created_by?: string | null
          email_signature_custom_text?: string | null
          email_signature_enabled?: boolean
          id?: string
          logo_storage_path?: string | null
          logo_url?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_company_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_company_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_company_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_custom_fields: {
        Row: {
          created_at: string
          deleted_at: string | null
          field_name: string
          field_order: number
          field_type: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          field_name: string
          field_order?: number
          field_type?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          field_name?: string
          field_order?: number
          field_type?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_custom_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      tenant_legal_pages: {
        Row: {
          content: string
          content_format: string
          created_at: string
          created_by: string | null
          effective_date: string | null
          id: string
          is_active: boolean
          page_type: string
          tenant_id: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content: string
          content_format?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          is_active?: boolean
          page_type: string
          tenant_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          content_format?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          is_active?: boolean
          page_type?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_legal_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_preferences: {
        Row: {
          additional_piece_rate: number | null
          allow_billing_to_account: boolean | null
          allow_billing_to_consumer: boolean | null
          allow_felt_pads: boolean | null
          allow_typed_name_as_signature: boolean | null
          auto_assembly_on_receiving: boolean | null
          auto_repair_on_damage: boolean | null
          base_order_minutes: number | null
          base_rate_includes_pieces: number | null
          break_every_hours: number | null
          break_minutes: number | null
          created_at: string
          custom_field_1_label: string | null
          custom_field_1_required: boolean | null
          daily_storage_rate_per_cuft: number
          default_order_bill_to: string | null
          default_shipment_notes: string | null
          exchange_order_addition: number | null
          extra_furniture_moving_minimum: number | null
          extra_stop_rate: number | null
          free_storage_days: number
          high_rise_additional_piece_fee: number | null
          hourly_rate: number | null
          id: string
          items_to_switch_to_hourly: number | null
          late_cancellation_fee: number | null
          max_assemblies_in_base_rate: number | null
          minutes_before_arrival_notification: number | null
          morning_starts_at: string | null
          num_reservation_date_choices: number | null
          order_field_label: string | null
          order_field_required: boolean | null
          privacy_policy_url: string | null
          receiving_charge_minimum: number | null
          removal_extra_piece_default: number | null
          removal_first_2_pieces: number | null
          require_signature_to_finish: boolean | null
          reservation_cut_off_time: string | null
          reservation_prep_days_required: number | null
          sales_tax_rate: number | null
          shipment_minimum: number | null
          should_create_inspections: boolean
          tenant_id: string
          terms_of_service_url: string | null
          updated_at: string
          will_call_minimum: number
          window_length_hours: number | null
        }
        Insert: {
          additional_piece_rate?: number | null
          allow_billing_to_account?: boolean | null
          allow_billing_to_consumer?: boolean | null
          allow_felt_pads?: boolean | null
          allow_typed_name_as_signature?: boolean | null
          auto_assembly_on_receiving?: boolean | null
          auto_repair_on_damage?: boolean | null
          base_order_minutes?: number | null
          base_rate_includes_pieces?: number | null
          break_every_hours?: number | null
          break_minutes?: number | null
          created_at?: string
          custom_field_1_label?: string | null
          custom_field_1_required?: boolean | null
          daily_storage_rate_per_cuft?: number
          default_order_bill_to?: string | null
          default_shipment_notes?: string | null
          exchange_order_addition?: number | null
          extra_furniture_moving_minimum?: number | null
          extra_stop_rate?: number | null
          free_storage_days?: number
          high_rise_additional_piece_fee?: number | null
          hourly_rate?: number | null
          id?: string
          items_to_switch_to_hourly?: number | null
          late_cancellation_fee?: number | null
          max_assemblies_in_base_rate?: number | null
          minutes_before_arrival_notification?: number | null
          morning_starts_at?: string | null
          num_reservation_date_choices?: number | null
          order_field_label?: string | null
          order_field_required?: boolean | null
          privacy_policy_url?: string | null
          receiving_charge_minimum?: number | null
          removal_extra_piece_default?: number | null
          removal_first_2_pieces?: number | null
          require_signature_to_finish?: boolean | null
          reservation_cut_off_time?: string | null
          reservation_prep_days_required?: number | null
          sales_tax_rate?: number | null
          shipment_minimum?: number | null
          should_create_inspections?: boolean
          tenant_id: string
          terms_of_service_url?: string | null
          updated_at?: string
          will_call_minimum?: number
          window_length_hours?: number | null
        }
        Update: {
          additional_piece_rate?: number | null
          allow_billing_to_account?: boolean | null
          allow_billing_to_consumer?: boolean | null
          allow_felt_pads?: boolean | null
          allow_typed_name_as_signature?: boolean | null
          auto_assembly_on_receiving?: boolean | null
          auto_repair_on_damage?: boolean | null
          base_order_minutes?: number | null
          base_rate_includes_pieces?: number | null
          break_every_hours?: number | null
          break_minutes?: number | null
          created_at?: string
          custom_field_1_label?: string | null
          custom_field_1_required?: boolean | null
          daily_storage_rate_per_cuft?: number
          default_order_bill_to?: string | null
          default_shipment_notes?: string | null
          exchange_order_addition?: number | null
          extra_furniture_moving_minimum?: number | null
          extra_stop_rate?: number | null
          free_storage_days?: number
          high_rise_additional_piece_fee?: number | null
          hourly_rate?: number | null
          id?: string
          items_to_switch_to_hourly?: number | null
          late_cancellation_fee?: number | null
          max_assemblies_in_base_rate?: number | null
          minutes_before_arrival_notification?: number | null
          morning_starts_at?: string | null
          num_reservation_date_choices?: number | null
          order_field_label?: string | null
          order_field_required?: boolean | null
          privacy_policy_url?: string | null
          receiving_charge_minimum?: number | null
          removal_extra_piece_default?: number | null
          removal_first_2_pieces?: number | null
          require_signature_to_finish?: boolean | null
          reservation_cut_off_time?: string | null
          reservation_prep_days_required?: number | null
          sales_tax_rate?: number | null
          shipment_minimum?: number | null
          should_create_inspections?: boolean
          tenant_id?: string
          terms_of_service_url?: string | null
          updated_at?: string
          will_call_minimum?: number
          window_length_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
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
      user_accounts: {
        Row: {
          access_level: string | null
          account_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_level?: string | null
          account_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_level?: string | null
          account_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_preferences: {
        Row: {
          card_order: Json | null
          created_at: string
          hidden_cards: Json | null
          id: string
          test_email: string | null
          test_phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_order?: Json | null
          created_at?: string
          hidden_cards?: Json | null
          id?: string
          test_email?: string | null
          test_phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_order?: Json | null
          created_at?: string
          hidden_cards?: Json | null
          id?: string
          test_email?: string | null
          test_phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboard_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          preference_key: string
          preference_value?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          cost_center: string | null
          created_at: string
          deleted_at: string | null
          email: string
          enrolled: boolean | null
          enrolled_at: string | null
          first_name: string | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string | null
          labor_rate: number | null
          last_login_at: string | null
          last_name: string | null
          overtime_eligible: boolean | null
          password_hash: string
          pay_rate: number | null
          pay_type: string | null
          phone: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cost_center?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          enrolled?: boolean | null
          enrolled_at?: string | null
          first_name?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string | null
          labor_rate?: number | null
          last_login_at?: string | null
          last_name?: string | null
          overtime_eligible?: boolean | null
          password_hash: string
          pay_rate?: number | null
          pay_type?: string | null
          phone?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cost_center?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          enrolled?: boolean | null
          enrolled_at?: string | null
          first_name?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string | null
          labor_rate?: number | null
          last_login_at?: string | null
          last_name?: string | null
          overtime_eligible?: boolean | null
          password_hash?: string
          pay_rate?: number | null
          pay_type?: string | null
          phone?: string | null
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
          bill_to: string | null
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
          picked_up_at: string | null
          picked_up_by: string | null
          scheduled_pickup_at: string | null
          signature_data: string | null
          signature_name: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          bill_to?: string | null
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
          picked_up_at?: string | null
          picked_up_by?: string | null
          scheduled_pickup_at?: string | null
          signature_data?: string | null
          signature_name?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          bill_to?: string | null
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
          picked_up_at?: string | null
          picked_up_by?: string | null
          scheduled_pickup_at?: string | null
          signature_data?: string | null
          signature_name?: string | null
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
          primary_photo_url: string | null
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
      generate_invoice_number: { Args: never; Returns: string }
      generate_shipment_number: { Args: never; Returns: string }
      get_current_user_tenant_id: { Args: never; Returns: string }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_communication_admin: { Args: never; Returns: boolean }
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
      seed_standard_roles: { Args: { p_tenant_id: string }; Returns: undefined }
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
      app_role: "admin" | "manager" | "warehouse" | "client_user"
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
      app_role: ["admin", "manager", "warehouse", "client_user"],
      discount_type: ["percentage", "flat_rate"],
      expiration_type: ["none", "date"],
      service_scope_type: ["all", "selected"],
      usage_limit_type: ["unlimited", "limited"],
    },
  },
} as const
