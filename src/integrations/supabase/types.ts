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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          daily_request_limit: number | null
          daily_requests_used: number | null
          daily_reset_at: string | null
          daily_token_limit: number | null
          daily_tokens_used: number | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_name: string
          last_used_at: string | null
          monthly_request_limit: number | null
          monthly_requests_used: number | null
          monthly_reset_at: string | null
          monthly_token_limit: number | null
          monthly_tokens_used: number | null
          provider: string
          rotation_priority: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_request_limit?: number | null
          daily_requests_used?: number | null
          daily_reset_at?: string | null
          daily_token_limit?: number | null
          daily_tokens_used?: number | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_name: string
          last_used_at?: string | null
          monthly_request_limit?: number | null
          monthly_requests_used?: number | null
          monthly_reset_at?: string | null
          monthly_token_limit?: number | null
          monthly_tokens_used?: number | null
          provider: string
          rotation_priority?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_request_limit?: number | null
          daily_requests_used?: number | null
          daily_reset_at?: string | null
          daily_token_limit?: number | null
          daily_tokens_used?: number | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_name?: string
          last_used_at?: string | null
          monthly_request_limit?: number | null
          monthly_requests_used?: number | null
          monthly_reset_at?: string | null
          monthly_token_limit?: number | null
          monthly_tokens_used?: number | null
          provider?: string
          rotation_priority?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          api_key_id: string
          completion_tokens: number | null
          endpoint: string | null
          error_message: string | null
          estimated_cost_usd: number | null
          id: string
          metadata: Json | null
          method: string | null
          model_used: string | null
          prompt_tokens: number | null
          provider: string
          request_timestamp: string | null
          response_time_ms: number | null
          status_code: number | null
          success: boolean | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          api_key_id: string
          completion_tokens?: number | null
          endpoint?: string | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          metadata?: Json | null
          method?: string | null
          model_used?: string | null
          prompt_tokens?: number | null
          provider: string
          request_timestamp?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          success?: boolean | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          api_key_id?: string
          completion_tokens?: number | null
          endpoint?: string | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          metadata?: Json | null
          method?: string | null
          model_used?: string | null
          prompt_tokens?: number | null
          provider?: string
          request_timestamp?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          success?: boolean | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          one_time_view: boolean | null
          password_proof: string | null
          password_salt: string | null
          updated_at: string
          view_count: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id: string
          one_time_view?: boolean | null
          password_proof?: string | null
          password_salt?: string | null
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          one_time_view?: boolean | null
          password_proof?: string | null
          password_salt?: string | null
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      dashboard_layouts: {
        Row: {
          id: string
          layout_tree: Json
          updated_at: string
          user_id: string
          widget_state: Json
        }
        Insert: {
          id?: string
          layout_tree: Json
          updated_at?: string
          user_id: string
          widget_state?: Json
        }
        Update: {
          id?: string
          layout_tree?: Json
          updated_at?: string
          user_id?: string
          widget_state?: Json
        }
        Relationships: []
      }
      docker_compose_configs: {
        Row: {
          compose_content: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          compose_content: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          compose_content?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          expiry_date: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          purchase_date: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          purchase_date?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          purchase_date?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      encrypted_vault_items: {
        Row: {
          auth_tag: string
          created_at: string
          encrypted_data: string
          id: string
          item_type: string
          iv: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_tag: string
          created_at?: string
          encrypted_data: string
          id?: string
          item_type: string
          iv: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_tag?: string
          created_at?: string
          encrypted_data?: string
          id?: string
          item_type?: string
          iv?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          default_payment_method: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_business_category: boolean | null
          is_tax_deductible: boolean | null
          monthly_budget_limit: number | null
          name: string
          parent_category_id: string | null
          sort_order: number | null
          updated_at: string
          user_id: string
          yearly_budget_limit: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_payment_method?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_business_category?: boolean | null
          is_tax_deductible?: boolean | null
          monthly_budget_limit?: number | null
          name: string
          parent_category_id?: string | null
          sort_order?: number | null
          updated_at?: string
          user_id: string
          yearly_budget_limit?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          default_payment_method?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_business_category?: boolean | null
          is_tax_deductible?: boolean | null
          monthly_budget_limit?: number | null
          name?: string
          parent_category_id?: string | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string
          yearly_budget_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          accent_every: number
          bpm: number
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_break: boolean
          mode: string
          notes: string | null
          profile: string | null
          started_at: string
          subdivisions: number
          task_id: string | null
          user_id: string
        }
        Insert: {
          accent_every?: number
          bpm?: number
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_break?: boolean
          mode: string
          notes?: string | null
          profile?: string | null
          started_at?: string
          subdivisions?: number
          task_id?: string | null
          user_id: string
        }
        Update: {
          accent_every?: number
          bpm?: number
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_break?: boolean
          mode?: string
          notes?: string | null
          profile?: string | null
          started_at?: string
          subdivisions?: number
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_secrets: {
        Row: {
          auth_tag: string
          created_at: string
          encrypted_value: string
          id: string
          iv: string
          key: string
          salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_tag: string
          created_at?: string
          encrypted_value: string
          id?: string
          iv: string
          key: string
          salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_tag?: string
          created_at?: string
          encrypted_value?: string
          id?: string
          iv?: string
          key?: string
          salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          has_qr_code: boolean
          id: string
          image_url: string | null
          is_lent: boolean
          lent_date: string | null
          lent_to: string | null
          location_id: string | null
          name: string
          purchase_date: string | null
          qr_code_data: string | null
          updated_at: string
          user_id: string
          value: number | null
          warranty_expires: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          has_qr_code?: boolean
          id?: string
          image_url?: string | null
          is_lent?: boolean
          lent_date?: string | null
          lent_to?: string | null
          location_id?: string | null
          name: string
          purchase_date?: string | null
          qr_code_data?: string | null
          updated_at?: string
          user_id: string
          value?: number | null
          warranty_expires?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          has_qr_code?: boolean
          id?: string
          image_url?: string | null
          is_lent?: boolean
          lent_date?: string | null
          lent_to?: string | null
          location_id?: string | null
          name?: string
          purchase_date?: string | null
          qr_code_data?: string | null
          updated_at?: string
          user_id?: string
          value?: number | null
          warranty_expires?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      live_share_events: {
        Row: {
          created_at: string
          encryption_enabled: boolean | null
          event: string
          id: string
          peer_id: string | null
          room_id: string
        }
        Insert: {
          created_at?: string
          encryption_enabled?: boolean | null
          event: string
          id?: string
          peer_id?: string | null
          room_id: string
        }
        Update: {
          created_at?: string
          encryption_enabled?: boolean | null
          event?: string
          id?: string
          peer_id?: string | null
          room_id?: string
        }
        Relationships: []
      }
      live_share_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          max_uses: number
          room_id: string
          use_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          max_uses?: number
          room_id: string
          use_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          max_uses?: number
          room_id?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_share_invites_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_share_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_share_invites_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_share_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_share_participants: {
        Row: {
          approved_at: string | null
          display_name: string
          id: string
          joined_at: string
          role: string
          room_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          display_name: string
          id?: string
          joined_at?: string
          role: string
          room_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          display_name?: string
          id?: string
          joined_at?: string
          role?: string
          room_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_share_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_share_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_share_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_share_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_share_permissions: {
        Row: {
          actions: string[]
          created_at: string
          expires_at: string | null
          granted_to: string
          id: string
          resource_id: string
          resource_type: string
          room_id: string
        }
        Insert: {
          actions: string[]
          created_at?: string
          expires_at?: string | null
          granted_to?: string
          id?: string
          resource_id: string
          resource_type: string
          room_id: string
        }
        Update: {
          actions?: string[]
          created_at?: string
          expires_at?: string | null
          granted_to?: string
          id?: string
          resource_id?: string
          resource_type?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_share_permissions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_share_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_share_permissions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_share_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_share_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          locked: boolean
          max_peers: number
          password_proof: string | null
          password_salt: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id: string
          locked?: boolean
          max_peers: number
          password_proof?: string | null
          password_salt?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          locked?: boolean
          max_peers?: number
          password_proof?: string | null
          password_salt?: string | null
        }
        Relationships: []
      }
      llm_models_cache: {
        Row: {
          company: string | null
          data: Json
          id: string
          is_available: boolean
          last_updated: string
          provider: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          data: Json
          id: string
          is_available?: boolean
          last_updated?: string
          provider: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          data?: Json
          id?: string
          is_available?: boolean
          last_updated?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      mal_accounts: {
        Row: {
          avatar_url: string | null
          days_watched: number | null
          display_name: string | null
          id: string
          linked_at: string
          mal_user_id: number
          mal_username: string
          mean_score: number | null
          synced_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          days_watched?: number | null
          display_name?: string | null
          id?: string
          linked_at?: string
          mal_user_id: number
          mal_username: string
          mean_score?: number | null
          synced_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          days_watched?: number | null
          display_name?: string | null
          id?: string
          linked_at?: string
          mal_user_id?: number
          mal_username?: string
          mean_score?: number | null
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mal_anime: {
        Row: {
          end_date: string | null
          genres: Json | null
          main_picture: Json | null
          mal_id: number
          mean: number | null
          media_type: string | null
          popularity: number | null
          rank: number | null
          season_name: string | null
          season_year: number | null
          start_date: string | null
          status: string | null
          title: string
          title_english: string | null
          updated_at: string
        }
        Insert: {
          end_date?: string | null
          genres?: Json | null
          main_picture?: Json | null
          mal_id: number
          mean?: number | null
          media_type?: string | null
          popularity?: number | null
          rank?: number | null
          season_name?: string | null
          season_year?: number | null
          start_date?: string | null
          status?: string | null
          title: string
          title_english?: string | null
          updated_at?: string
        }
        Update: {
          end_date?: string | null
          genres?: Json | null
          main_picture?: Json | null
          mal_id?: number
          mean?: number | null
          media_type?: string | null
          popularity?: number | null
          rank?: number | null
          season_name?: string | null
          season_year?: number | null
          start_date?: string | null
          status?: string | null
          title?: string
          title_english?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mal_recommendations: {
        Row: {
          created_at: string
          mal_id: number
          reason: string | null
          score: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mal_id: number
          reason?: string | null
          score: number
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          mal_id?: number
          reason?: string | null
          score?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mal_recommendations_mal_id_fkey"
            columns: ["mal_id"]
            isOneToOne: false
            referencedRelation: "mal_anime"
            referencedColumns: ["mal_id"]
          },
        ]
      }
      mal_tokens: {
        Row: {
          access_encrypted: string
          auth_tag: string
          created_at: string
          iv: string
          refresh_encrypted: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_encrypted: string
          auth_tag: string
          created_at?: string
          iv: string
          refresh_encrypted?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_encrypted?: string
          auth_tag?: string
          created_at?: string
          iv?: string
          refresh_encrypted?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mal_user_list_entries: {
        Row: {
          comments: string | null
          mal_id: number
          num_episodes_watched: number | null
          priority: number | null
          score: number | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comments?: string | null
          mal_id: number
          num_episodes_watched?: number | null
          priority?: number | null
          score?: number | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comments?: string | null
          mal_id?: number
          num_episodes_watched?: number | null
          priority?: number | null
          score?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mal_user_list_entries_mal_id_fkey"
            columns: ["mal_id"]
            isOneToOne: false
            referencedRelation: "mal_anime"
            referencedColumns: ["mal_id"]
          },
        ]
      }
      mal_watch_history: {
        Row: {
          episode: number
          mal_id: number
          user_id: string
          watched_at: string
        }
        Insert: {
          episode: number
          mal_id: number
          user_id: string
          watched_at: string
        }
        Update: {
          episode?: number
          mal_id?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          address: string | null
          business_type: string | null
          category: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          business_type?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          business_type?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      monthly_status_sheets: {
        Row: {
          created_at: string
          custom_data: Json
          day_number: number
          id: string
          month_year: string
          notes: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_data?: Json
          day_number: number
          id?: string
          month_year: string
          notes?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_data?: Json
          day_number?: number
          id?: string
          month_year?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_favorite: boolean
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_rate_limit_presets: {
        Row: {
          concurrent_requests: number | null
          created_at: string | null
          id: string
          model_pattern: string | null
          provider: string
          requests_per_day: number | null
          requests_per_hour: number | null
          requests_per_minute: number | null
          tier_name: string
          tokens_per_day: number | null
          tokens_per_hour: number | null
          tokens_per_minute: number | null
        }
        Insert: {
          concurrent_requests?: number | null
          created_at?: string | null
          id?: string
          model_pattern?: string | null
          provider: string
          requests_per_day?: number | null
          requests_per_hour?: number | null
          requests_per_minute?: number | null
          tier_name: string
          tokens_per_day?: number | null
          tokens_per_hour?: number | null
          tokens_per_minute?: number | null
        }
        Update: {
          concurrent_requests?: number | null
          created_at?: string | null
          id?: string
          model_pattern?: string | null
          provider?: string
          requests_per_day?: number | null
          requests_per_hour?: number | null
          requests_per_minute?: number | null
          tier_name?: string
          tokens_per_day?: number | null
          tokens_per_hour?: number | null
          tokens_per_minute?: number | null
        }
        Relationships: []
      }
      rate_limit_configs: {
        Row: {
          burst_allowance: number | null
          created_at: string | null
          id: string
          provider: string
          requests_per_day: number | null
          requests_per_hour: number | null
          requests_per_minute: number | null
          throttle_delay_ms: number | null
          throttle_enabled: boolean | null
          tokens_per_day: number | null
          tokens_per_hour: number | null
          tokens_per_minute: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          burst_allowance?: number | null
          created_at?: string | null
          id?: string
          provider: string
          requests_per_day?: number | null
          requests_per_hour?: number | null
          requests_per_minute?: number | null
          throttle_delay_ms?: number | null
          throttle_enabled?: boolean | null
          tokens_per_day?: number | null
          tokens_per_hour?: number | null
          tokens_per_minute?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          burst_allowance?: number | null
          created_at?: string | null
          id?: string
          provider?: string
          requests_per_day?: number | null
          requests_per_hour?: number | null
          requests_per_minute?: number | null
          throttle_delay_ms?: number | null
          throttle_enabled?: boolean | null
          tokens_per_day?: number | null
          tokens_per_hour?: number | null
          tokens_per_minute?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receipt_analysis_jobs: {
        Row: {
          ai_model_used: string | null
          analysis_result: Json | null
          completed_at: string | null
          confidence_scores: Json | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string | null
          ocr_result: Json | null
          processing_duration_ms: number | null
          receipt_id: string
          retry_count: number | null
          started_at: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model_used?: string | null
          analysis_result?: Json | null
          completed_at?: string | null
          confidence_scores?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string | null
          ocr_result?: Json | null
          processing_duration_ms?: number | null
          receipt_id: string
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model_used?: string | null
          analysis_result?: Json | null
          completed_at?: string | null
          confidence_scores?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string | null
          ocr_result?: Json | null
          processing_duration_ms?: number | null
          receipt_id?: string
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_analysis_jobs_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_documents: {
        Row: {
          ai_analysis_data: Json | null
          ai_confidence_score: number | null
          analysis_duration_ms: number | null
          analysis_error_message: string | null
          analysis_model_used: string | null
          analysis_status: string | null
          created_at: string
          description: string | null
          document_number: string | null
          document_type: string | null
          expiry_date: string | null
          file_path: string
          file_size: number | null
          id: string
          is_primary: boolean | null
          issue_date: string | null
          issuer: string | null
          mime_type: string | null
          name: string
          notes: string | null
          original_filename: string | null
          receipt_id: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis_data?: Json | null
          ai_confidence_score?: number | null
          analysis_duration_ms?: number | null
          analysis_error_message?: string | null
          analysis_model_used?: string | null
          analysis_status?: string | null
          created_at?: string
          description?: string | null
          document_number?: string | null
          document_type?: string | null
          expiry_date?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_primary?: boolean | null
          issue_date?: string | null
          issuer?: string | null
          mime_type?: string | null
          name: string
          notes?: string | null
          original_filename?: string | null
          receipt_id: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis_data?: Json | null
          ai_confidence_score?: number | null
          analysis_duration_ms?: number | null
          analysis_error_message?: string | null
          analysis_model_used?: string | null
          analysis_status?: string | null
          created_at?: string
          description?: string | null
          document_number?: string | null
          document_type?: string | null
          expiry_date?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_primary?: boolean | null
          issue_date?: string | null
          issuer?: string | null
          mime_type?: string | null
          name?: string
          notes?: string | null
          original_filename?: string | null
          receipt_id?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_documents_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_items: {
        Row: {
          barcode: string | null
          created_at: string
          description: string | null
          id: string
          is_taxable: boolean | null
          line_number: number | null
          name: string
          product_category: string | null
          quantity: number | null
          receipt_id: string
          sku: string | null
          tax_amount: number | null
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_taxable?: boolean | null
          line_number?: number | null
          name: string
          product_category?: string | null
          quantity?: number | null
          receipt_id: string
          sku?: string | null
          tax_amount?: number | null
          total_price: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_taxable?: boolean | null
          line_number?: number | null
          name?: string
          product_category?: string | null
          quantity?: number | null
          receipt_id?: string
          sku?: string | null
          tax_amount?: number | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          ai_analysis_data: Json | null
          ai_confidence_score: number | null
          analysis_status: string | null
          category: string
          created_at: string
          currency: string
          description: string | null
          file_size: number | null
          id: string
          image_path: string | null
          image_url: string | null
          is_business_expense: boolean | null
          is_reimbursable: boolean | null
          is_tax_deductible: boolean | null
          merchant_address: string | null
          merchant_name: string | null
          merchant_phone: string | null
          merchant_tax_id: string | null
          mime_type: string | null
          name: string
          notes: string | null
          ocr_raw_text: string | null
          payment_method: string | null
          pre_tax_amount: number | null
          receipt_date: string
          reimbursement_status: string | null
          subcategory: string | null
          tags: string[] | null
          tax_amount: number | null
          tax_rate: number | null
          tip_amount: number | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis_data?: Json | null
          ai_confidence_score?: number | null
          analysis_status?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          file_size?: number | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_business_expense?: boolean | null
          is_reimbursable?: boolean | null
          is_tax_deductible?: boolean | null
          merchant_address?: string | null
          merchant_name?: string | null
          merchant_phone?: string | null
          merchant_tax_id?: string | null
          mime_type?: string | null
          name: string
          notes?: string | null
          ocr_raw_text?: string | null
          payment_method?: string | null
          pre_tax_amount?: number | null
          receipt_date: string
          reimbursement_status?: string | null
          subcategory?: string | null
          tags?: string[] | null
          tax_amount?: number | null
          tax_rate?: number | null
          tip_amount?: number | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis_data?: Json | null
          ai_confidence_score?: number | null
          analysis_status?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          file_size?: number | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_business_expense?: boolean | null
          is_reimbursable?: boolean | null
          is_tax_deductible?: boolean | null
          merchant_address?: string | null
          merchant_name?: string | null
          merchant_phone?: string | null
          merchant_tax_id?: string | null
          mime_type?: string | null
          name?: string
          notes?: string | null
          ocr_raw_text?: string | null
          payment_method?: string | null
          pre_tax_amount?: number | null
          receipt_date?: string
          reimbursement_status?: string | null
          subcategory?: string | null
          tags?: string[] | null
          tax_amount?: number | null
          tax_rate?: number | null
          tip_amount?: number | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      steam_accounts: {
        Row: {
          avatar_url: string | null
          country: string | null
          id: string
          linked_at: string
          persona_name: string | null
          profile_visibility: string | null
          steam_level: number | null
          steamid64: string
          synced_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          id?: string
          linked_at?: string
          persona_name?: string | null
          profile_visibility?: string | null
          steam_level?: number | null
          steamid64: string
          synced_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          id?: string
          linked_at?: string
          persona_name?: string | null
          profile_visibility?: string | null
          steam_level?: number | null
          steamid64?: string
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      steam_achievements: {
        Row: {
          achieved: boolean
          apiname: string
          appid: number
          unlocktime: string | null
          user_id: string
        }
        Insert: {
          achieved: boolean
          apiname: string
          appid: number
          unlocktime?: string | null
          user_id: string
        }
        Update: {
          achieved?: boolean
          apiname?: string
          appid?: number
          unlocktime?: string | null
          user_id?: string
        }
        Relationships: []
      }
      steam_game_stats: {
        Row: {
          appid: number
          stat_name: string
          stat_value: number
          user_id: string
        }
        Insert: {
          appid: number
          stat_name: string
          stat_value: number
          user_id: string
        }
        Update: {
          appid?: number
          stat_name?: string
          stat_value?: number
          user_id?: string
        }
        Relationships: []
      }
      steam_games: {
        Row: {
          appid: number
          genres: Json | null
          header_image: string | null
          is_free: boolean | null
          metascore: number | null
          name: string | null
          updated_at: string
        }
        Insert: {
          appid: number
          genres?: Json | null
          header_image?: string | null
          is_free?: boolean | null
          metascore?: number | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          appid?: number
          genres?: Json | null
          header_image?: string | null
          is_free?: boolean | null
          metascore?: number | null
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      steam_ownership: {
        Row: {
          appid: number
          last_played_at: string | null
          playtime_2weeks_minutes: number
          playtime_forever_minutes: number
          user_id: string
        }
        Insert: {
          appid: number
          last_played_at?: string | null
          playtime_2weeks_minutes?: number
          playtime_forever_minutes?: number
          user_id: string
        }
        Update: {
          appid?: number
          last_played_at?: string | null
          playtime_2weeks_minutes?: number
          playtime_forever_minutes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "steam_ownership_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "steam_games"
            referencedColumns: ["appid"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          feature_category: string
          id: string
          is_encrypted: boolean | null
          setting_key: string
          setting_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_category: string
          id?: string
          is_encrypted?: boolean | null
          setting_key: string
          setting_value: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_category?: string
          id?: string
          is_encrypted?: boolean | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_configs: {
        Row: {
          created_at: string
          id: string
          key: string
          namespace: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          namespace: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          namespace?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      vault_config: {
        Row: {
          created_at: string
          id: string
          salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          server_secret: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          server_secret: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          server_secret?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      live_share_rooms_public: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string | null
          locked: boolean | null
          max_peers: number | null
          password_salt: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string | null
          locked?: boolean | null
          max_peers?: number | null
          password_salt?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string | null
          locked?: boolean | null
          max_peers?: number | null
          password_salt?: string | null
        }
        Relationships: []
      }
      receipt_document_ai_analytics: {
        Row: {
          analysis_model_used: string | null
          analysis_status: string | null
          avg_analysis_duration_ms: number | null
          avg_confidence_score: number | null
          document_count: number | null
          document_type: string | null
          first_analysis_date: string | null
          latest_analysis_date: string | null
        }
        Relationships: []
      }
      system_settings_by_feature: {
        Row: {
          feature_category: string | null
          settings: Json | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_vault_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_llm_cache: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      delete_docker_compose_config: {
        Args: { _name: string }
        Returns: boolean
      }
      delete_infrastructure_secret: {
        Args: { _key: string }
        Returns: boolean
      }
      end_live_share: {
        Args: { _id: string }
        Returns: undefined
      }
      get_clip: {
        Args: { _id: string; _proof?: string }
        Returns: {
          content: string
          expires_at: string
          has_password: boolean
          id: string
          updated_at: string
        }[]
      }
      get_clip_meta: {
        Args: { _id: string }
        Returns: {
          clip_exists: boolean
          expires_at: string
          has_password: boolean
          password_salt: string
          updated_at: string
        }[]
      }
      get_clip_one_time: {
        Args: { _id: string; _proof?: string }
        Returns: {
          content: string
          expires_at: string
          has_password: boolean
          id: string
          one_time_view: boolean
          updated_at: string
          view_count: number
        }[]
      }
      get_docker_compose_config: {
        Args: { _name: string }
        Returns: {
          compose_content: string
          created_at: string
          description: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      get_infrastructure_secret: {
        Args: { _key: string }
        Returns: {
          auth_tag: string
          created_at: string
          encrypted_value: string
          id: string
          iv: string
          key: string
          salt: string
          updated_at: string
        }[]
      }
      get_live_share_participant_status: {
        Args: { _id: string }
        Returns: string
      }
      list_docker_compose_configs: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          description: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      list_infrastructure_secret_keys: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          id: string
          key: string
          updated_at: string
        }[]
      }
      purge_expired_live_shares: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      redeem_live_share_invite: {
        Args: { _code: string; _display_name: string }
        Returns: {
          participant_id: string
          room_id: string
        }[]
      }
      reset_daily_usage_counters: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_monthly_usage_counters: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      set_live_share_participant_status: {
        Args: { _participant_id: string; _status: string }
        Returns: undefined
      }
      store_docker_compose_config: {
        Args: {
          _compose_content: string
          _description: string
          _metadata?: Json
          _name: string
        }
        Returns: string
      }
      store_infrastructure_secret: {
        Args: {
          _auth_tag: string
          _encrypted_value: string
          _iv: string
          _key: string
          _salt: string
        }
        Returns: string
      }
      upsert_clip: {
        Args:
          | {
              _content: string
              _expires_at?: string
              _id: string
              _one_time_view?: boolean
              _proof?: string
              _set_password_proof?: string
              _set_password_salt?: string
            }
          | {
              _content: string
              _expires_at?: string
              _id: string
              _proof?: string
              _set_password_proof?: string
              _set_password_salt?: string
            }
        Returns: boolean
      }
      verify_live_share_access: {
        Args: { _id: string; _proof: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
