export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
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
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_vault_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
