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
      consistency_finding: {
        Row: {
          created_at: string
          dispensado_em: string | null
          hash_dos_dados: string
          id: string
          itens_envolvidos: string[]
          mensagem: string
          regra_id: string
          severidade: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          dispensado_em?: string | null
          hash_dos_dados: string
          id?: string
          itens_envolvidos?: string[]
          mensagem: string
          regra_id: string
          severidade: string
          trip_id: string
        }
        Update: {
          created_at?: string
          dispensado_em?: string | null
          hash_dos_dados?: string
          id?: string
          itens_envolvidos?: string[]
          mensagem?: string
          regra_id?: string
          severidade?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consistency_finding_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      expense: {
        Row: {
          categoria: string
          comprovante_url: string | null
          created_at: string
          criado_por: string
          data: string
          deleted_at: string | null
          descricao: string
          editado_em: string | null
          id: string
          moeda_original: string
          pago_por: string | null
          taxa_cambio: number
          trip_id: string
          valor_moeda_base: number
          valor_original: number
        }
        Insert: {
          categoria: string
          comprovante_url?: string | null
          created_at?: string
          criado_por: string
          data: string
          deleted_at?: string | null
          descricao: string
          editado_em?: string | null
          id?: string
          moeda_original: string
          pago_por?: string | null
          taxa_cambio: number
          trip_id: string
          valor_moeda_base: number
          valor_original: number
        }
        Update: {
          categoria?: string
          comprovante_url?: string | null
          created_at?: string
          criado_por?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          editado_em?: string | null
          id?: string
          moeda_original?: string
          pago_por?: string | null
          taxa_cambio?: number
          trip_id?: string
          valor_moeda_base?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging: {
        Row: {
          anexo_url: string | null
          checkin: string
          checkout: string
          cidade: string | null
          created_at: string
          deleted_at: string | null
          endereco: string | null
          id: string
          lat: number | null
          lng: number | null
          localizador: string | null
          moeda: string | null
          nome: string
          politica_cancelamento: string | null
          trip_id: string
          valor: number | null
        }
        Insert: {
          anexo_url?: string | null
          checkin: string
          checkout: string
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          endereco?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          localizador?: string | null
          moeda?: string | null
          nome: string
          politica_cancelamento?: string | null
          trip_id: string
          valor?: number | null
        }
        Update: {
          anexo_url?: string | null
          checkin?: string
          checkout?: string
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          endereco?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          localizador?: string | null
          moeda?: string | null
          nome?: string
          politica_cancelamento?: string | null
          trip_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lodging_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_account: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          numero: string | null
          owner_id: string
          person_id: string
          programa: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          numero?: string | null
          owner_id: string
          person_id: string
          programa: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          numero?: string | null
          owner_id?: string
          person_id?: string
          programa?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_account_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      person: {
        Row: {
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          id: string
          nacionalidades: string[]
          nome: string
          nome_como_no_documento: string | null
          owner_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          id?: string
          nacionalidades?: string[]
          nome: string
          nome_como_no_documento?: string | null
          owner_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          id?: string
          nacionalidades?: string[]
          nome?: string
          nome_como_no_documento?: string | null
          owner_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ticket: {
        Row: {
          anexo_url: string | null
          assento: string | null
          chegada_tz: string
          chegada_utc: string
          companhia: string | null
          created_at: string
          deleted_at: string | null
          destino_cidade: string | null
          destino_iata: string | null
          id: string
          localizador: string | null
          nome_no_bilhete: string | null
          numero: string | null
          origem_cidade: string | null
          origem_iata: string | null
          partida_tz: string
          partida_utc: string
          tipo: string
          trip_id: string
        }
        Insert: {
          anexo_url?: string | null
          assento?: string | null
          chegada_tz: string
          chegada_utc: string
          companhia?: string | null
          created_at?: string
          deleted_at?: string | null
          destino_cidade?: string | null
          destino_iata?: string | null
          id?: string
          localizador?: string | null
          nome_no_bilhete?: string | null
          numero?: string | null
          origem_cidade?: string | null
          origem_iata?: string | null
          partida_tz: string
          partida_utc: string
          tipo: string
          trip_id: string
        }
        Update: {
          anexo_url?: string | null
          assento?: string | null
          chegada_tz?: string
          chegada_utc?: string
          companhia?: string | null
          created_at?: string
          deleted_at?: string | null
          destino_cidade?: string | null
          destino_iata?: string | null
          id?: string
          localizador?: string | null
          nome_no_bilhete?: string | null
          numero?: string | null
          origem_cidade?: string | null
          origem_iata?: string | null
          partida_tz?: string
          partida_utc?: string
          tipo?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_document: {
        Row: {
          anexo_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          numero: string | null
          owner_id: string
          pais_emissor: string | null
          person_id: string
          tipo: string
          validade: string | null
        }
        Insert: {
          anexo_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          numero?: string | null
          owner_id: string
          pais_emissor?: string | null
          person_id: string
          tipo: string
          validade?: string | null
        }
        Update: {
          anexo_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          numero?: string | null
          owner_id?: string
          pais_emissor?: string | null
          person_id?: string
          tipo?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traveler_document_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      trip: {
        Row: {
          arquivada_em: string | null
          capa_url: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          deleted_at: string | null
          destino: string | null
          id: string
          moeda_base: string
          nome: string
          owner_id: string
          status: string
        }
        Insert: {
          arquivada_em?: string | null
          capa_url?: string | null
          created_at?: string
          data_fim: string
          data_inicio: string
          deleted_at?: string | null
          destino?: string | null
          id?: string
          moeda_base: string
          nome: string
          owner_id: string
          status?: string
        }
        Update: {
          arquivada_em?: string | null
          capa_url?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          deleted_at?: string | null
          destino?: string | null
          id?: string
          moeda_base?: string
          nome?: string
          owner_id?: string
          status?: string
        }
        Relationships: []
      }
      trip_member: {
        Row: {
          created_at: string
          deleted_at: string | null
          entrou_em: string
          id: string
          papel: string
          person_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entrou_em?: string
          id?: string
          papel?: string
          person_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entrou_em?: string
          id?: string
          papel?: string
          person_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_member_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_member_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
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
