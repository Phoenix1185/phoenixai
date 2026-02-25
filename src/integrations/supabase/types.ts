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
      conversations: {
        Row: {
          created_at: string
          id: string
          is_shared: boolean
          slug: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_shared?: boolean
          slug?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_shared?: boolean
          slug?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          feedback_text: string | null
          feedback_type: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          feedback_type: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          feedback_type?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string | null
          confidence: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          fetch_source: string | null
          id: string
          is_expired: boolean | null
          query_pattern: string
          source_url: string | null
          updated_at: string
          usage_count: number | null
          verified_answer: string
        }
        Insert: {
          category?: string | null
          confidence?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          fetch_source?: string | null
          id?: string
          is_expired?: boolean | null
          query_pattern: string
          source_url?: string | null
          updated_at?: string
          usage_count?: number | null
          verified_answer: string
        }
        Update: {
          category?: string | null
          confidence?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          fetch_source?: string | null
          id?: string
          is_expired?: boolean | null
          query_pattern?: string
          source_url?: string | null
          updated_at?: string
          usage_count?: number | null
          verified_answer?: string
        }
        Relationships: []
      }
      learning_patterns: {
        Row: {
          created_at: string | null
          effectiveness_score: number | null
          id: string
          improvement_applied: string
          pattern_description: string
          pattern_type: string
          trigger_context: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          effectiveness_score?: number | null
          id?: string
          improvement_applied: string
          pattern_description: string
          pattern_type: string
          trigger_context?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          effectiveness_score?: number | null
          id?: string
          improvement_applied?: string
          pattern_description?: string
          pattern_type?: string
          trigger_context?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          rating: number | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          rating?: number | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          rating?: number | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_conversations: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          preferred_language: string | null
          sender_name: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          preferred_language?: string | null
          sender_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          preferred_language?: string | null
          sender_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "telegram_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memories: {
        Row: {
          category: string | null
          created_at: string
          fact: string
          id: string
          platform: string
          platform_user_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          fact: string
          id?: string
          platform?: string
          platform_user_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          fact?: string
          id?: string
          platform?: string
          platform_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          expertise_level: Database["public"]["Enums"]["expertise_level"] | null
          id: string
          interests: string[] | null
          language: string | null
          preferred_style: Database["public"]["Enums"]["preferred_style"] | null
          response_length: Database["public"]["Enums"]["response_length"] | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expertise_level?:
            | Database["public"]["Enums"]["expertise_level"]
            | null
          id?: string
          interests?: string[] | null
          language?: string | null
          preferred_style?:
            | Database["public"]["Enums"]["preferred_style"]
            | null
          response_length?:
            | Database["public"]["Enums"]["response_length"]
            | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expertise_level?:
            | Database["public"]["Enums"]["expertise_level"]
            | null
          id?: string
          interests?: string[] | null
          language?: string | null
          preferred_style?:
            | Database["public"]["Enums"]["preferred_style"]
            | null
          response_length?:
            | Database["public"]["Enums"]["response_length"]
            | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          preferred_language: string | null
          sender_name: string | null
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          preferred_language?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          preferred_language?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          chat_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      expertise_level: "beginner" | "intermediate" | "expert"
      preferred_style: "formal" | "casual" | "witty"
      response_length: "concise" | "balanced" | "detailed"
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
      expertise_level: ["beginner", "intermediate", "expert"],
      preferred_style: ["formal", "casual", "witty"],
      response_length: ["concise", "balanced", "detailed"],
    },
  },
} as const
