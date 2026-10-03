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
      admin_credit_adjustments: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          questions_delta: number
          reason: string
          user_id: string
          videos_delta: number
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          questions_delta?: number
          reason?: string
          user_id: string
          videos_delta?: number
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          questions_delta?: number
          reason?: string
          user_id?: string
          videos_delta?: number
        }
        Relationships: []
      }
      animations: {
        Row: {
          audio_path: string | null
          course_id: string | null
          created_at: string
          document_id: string
          id: string
          page: number
          script: Json
          title: string
          user_id: string
        }
        Insert: {
          audio_path?: string | null
          course_id?: string | null
          created_at?: string
          document_id: string
          id?: string
          page?: number
          script?: Json
          title?: string
          user_id?: string
        }
        Update: {
          audio_path?: string | null
          course_id?: string | null
          created_at?: string
          document_id?: string
          id?: string
          page?: number
          script?: Json
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "animations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          course_id: string | null
          created_at: string
          done: boolean
          id: string
          notes: string
          remind_minutes: number | null
          reminded: boolean
          starts_at: string
          title: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          notes?: string
          remind_minutes?: number | null
          reminded?: boolean
          starts_at: string
          title: string
          user_id?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          notes?: string
          remind_minutes?: number | null
          reminded?: boolean
          starts_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rate_limits: {
        Row: {
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          request_count?: number
          user_id: string
          window_start: string
        }
        Update: {
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          archived: boolean
          created_at: string
          description: string
          id: string
          name: string
          progress: number
          status: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string
          id?: string
          name: string
          progress?: number
          status?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string
          id?: string
          name?: string
          progress?: number
          status?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doc_chats: {
        Row: {
          document_id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          document_id: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          document_id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_chats_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          course_id: string | null
          created_at: string
          folder_id: string | null
          id: string
          kind: string
          mime: string
          name: string
          size: number
          state: Json
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          kind?: string
          mime?: string
          name: string
          size?: number
          state?: Json
          storage_path: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          kind?: string
          mime?: string
          name?: string
          size?: number
          state?: Json
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          name: string
          parent_id: string | null
          tone: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          tone?: string
          user_id?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          tone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      illustration_history: {
        Row: {
          created_at: string
          id: string
          key: string
          status: string
          svg: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          status?: string
          svg: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          status?: string
          svg?: string
        }
        Relationships: []
      }
      illustrations: {
        Row: {
          category: string
          created_at: string
          custom_prompt: string | null
          id: string
          key: string
          label: string
          prompt: string
          status: string
          svg: string | null
          updated_at: string
          visual_description: string | null
        }
        Insert: {
          category: string
          created_at?: string
          custom_prompt?: string | null
          id?: string
          key: string
          label: string
          prompt: string
          status?: string
          svg?: string | null
          updated_at?: string
          visual_description?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          custom_prompt?: string | null
          id?: string
          key?: string
          label?: string
          prompt?: string
          status?: string
          svg?: string | null
          updated_at?: string
          visual_description?: string | null
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: Json
          created_at: string
          id: string
          progress: number
          status: string
          subject: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          progress?: number
          status?: string
          subject?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          progress?: number
          status?: string
          subject?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          created_at: string
          document_id: string
          id: string
          mime: string
          name: string
          page: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          mime: string
          name: string
          page?: number
          storage_path: string
          user_id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          mime?: string
          name?: string
          page?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_id: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          event_id?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      page_quiz_keys: {
        Row: {
          answer_key: Json
          quiz_id: string
        }
        Insert: {
          answer_key: Json
          quiz_id: string
        }
        Update: {
          answer_key?: Json
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_quiz_keys_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: true
            referencedRelation: "page_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      page_quizzes: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          document_id: string
          id: string
          page: number
          questions: Json
          score: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          document_id: string
          id?: string
          page: number
          questions?: Json
          score?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          document_id?: string
          id?: string
          page?: number
          questions?: Json
          score?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_quizzes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      procedural_icon_visibility: {
        Row: {
          hidden: boolean
          key: string
          updated_at: string
        }
        Insert: {
          hidden?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          hidden?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          timezone: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          timezone?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          timezone?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          environment: string
          id: string
          paddle_transaction_id: string
          price_id: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          environment: string
          id?: string
          paddle_transaction_id: string
          price_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          environment?: string
          id?: string
          paddle_transaction_id?: string
          price_id?: string
          user_id?: string
        }
        Relationships: []
      }
      scenario_visibility: {
        Row: {
          hidden: boolean
          key: string
          updated_at: string
        }
        Insert: {
          hidden?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          hidden?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          context: string
          created_at: string
          document_id: string | null
          document_name: string
          handled_at: string | null
          id: string
          question: string
          status: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          context?: string
          created_at?: string
          document_id?: string | null
          document_name?: string
          handled_at?: string | null
          id?: string
          question: string
          status?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Update: {
          context?: string
          created_at?: string
          document_id?: string | null
          document_name?: string
          handled_at?: string | null
          id?: string
          question?: string
          status?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          has_pass: boolean
          next_grant_at: string | null
          questions: number
          questions_used: number
          rto_cents: number
          updated_at: string
          usage_month: string | null
          user_id: string
          videos: number
          videos_used: number
          yearly_grants_left: number
        }
        Insert: {
          has_pass?: boolean
          next_grant_at?: string | null
          questions?: number
          questions_used?: number
          rto_cents?: number
          updated_at?: string
          usage_month?: string | null
          user_id: string
          videos?: number
          videos_used?: number
          yearly_grants_left?: number
        }
        Update: {
          has_pass?: boolean
          next_grant_at?: string | null
          questions?: number
          questions_used?: number
          rto_cents?: number
          updated_at?: string
          usage_month?: string | null
          user_id?: string
          videos?: number
          videos_used?: number
          yearly_grants_left?: number
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
      apply_purchase: {
        Args: {
          _amount: number
          _env: string
          _is_change: boolean
          _price: string
          _txn: string
          _uid: string
        }
        Returns: boolean
      }
      check_chat_rate_limit: { Args: never; Returns: boolean }
      claim_yearly_grants: { Args: { _uid: string }; Returns: undefined }
      consume_credit: { Args: { _kind: string }; Returns: number }
      generate_my_reminders: { Args: never; Returns: number }
      has_active_club: { Args: { _uid: string }; Returns: boolean }
      has_active_club_max: { Args: { _uid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_credits: {
        Args: never
        Returns: {
          club: boolean
          has_pass: boolean
          questions: number
          rto_cents: number
          videos: number
        }[]
      }
      refund_credit: {
        Args: { _kind: string; _uid: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "support"
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
      app_role: ["admin", "user", "support"],
    },
  },
} as const
