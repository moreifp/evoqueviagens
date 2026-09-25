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
      agent_inbox: {
        Row: {
          account_id: string
          achados_json: Json
          criado_em: string
          id: string
          idempotency_key: string
          item_id: string | null
          lote_id: string | null
          origem_cliente: string | null
          payload_json: Json
          resolvido_em: string | null
          status: string
          tipo_alvo: string
          trip_id: string | null
        }
        Insert: {
          account_id?: string
          achados_json?: Json
          criado_em?: string
          id?: string
          idempotency_key: string
          item_id?: string | null
          lote_id?: string | null
          origem_cliente?: string | null
          payload_json: Json
          resolvido_em?: string | null
          status?: string
          tipo_alvo: string
          trip_id?: string | null
        }
        Update: {
          account_id?: string
          achados_json?: Json
          criado_em?: string
          id?: string
          idempotency_key?: string
          item_id?: string | null
          lote_id?: string | null
          origem_cliente?: string | null
          payload_json?: Json
          resolvido_em?: string | null
          status?: string
          tipo_alvo?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_inbox_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      api_alerta: {
        Row: {
          created_at: string
          id: string
          mensagem: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_alerta_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          aviso_em: string | null
          mes: string
          unidades: number
        }
        Insert: {
          aviso_em?: string | null
          mes: string
          unidades?: number
        }
        Update: {
          aviso_em?: string | null
          mes?: string
          unidades?: number
        }
        Relationships: []
      }
      app_admin: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          telefone: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          telefone?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          telefone?: string | null
        }
        Relationships: []
      }
      cadastro_link: {
        Row: {
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          expira_em: string
          id: string
          person_id: string
          revogado_em: string | null
          token_cifrado: string | null
          token_hash: string
          ultimo_acesso_em: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          expira_em?: string
          id?: string
          person_id: string
          revogado_em?: string | null
          token_cifrado?: string | null
          token_hash: string
          ultimo_acesso_em?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          expira_em?: string
          id?: string
          person_id?: string
          revogado_em?: string | null
          token_cifrado?: string | null
          token_hash?: string
          ultimo_acesso_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadastro_link_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
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
      document_attachment: {
        Row: {
          content_type: string
          created_at: string
          deleted_at: string | null
          document_id: string
          file_name: string
          id: string
          is_primary: boolean
          person_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          content_type: string
          created_at?: string
          deleted_at?: string | null
          document_id: string
          file_name: string
          id?: string
          is_primary?: boolean
          person_id: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          document_id?: string
          file_name?: string
          id?: string
          is_primary?: boolean
          person_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_attachment_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "traveler_document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachment_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_rule: {
        Row: {
          created_at: string
          detalhe: string | null
          estadia_max_dias: number | null
          exigencia: string
          fonte_url: string
          id: string
          lead_time_dias: number | null
          nacionalidade: string
          pais_destino: string
          validade_passaporte_min_meses: number | null
          verificado_em: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          estadia_max_dias?: number | null
          exigencia: string
          fonte_url: string
          id?: string
          lead_time_dias?: number | null
          nacionalidade: string
          pais_destino: string
          validade_passaporte_min_meses?: number | null
          verificado_em: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          estadia_max_dias?: number | null
          exigencia?: string
          fonte_url?: string
          id?: string
          lead_time_dias?: number | null
          nacionalidade?: string
          pais_destino?: string
          validade_passaporte_min_meses?: number | null
          verificado_em?: string
        }
        Relationships: []
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
      flight_status: {
        Row: {
          atraso_chegada_min: number | null
          atraso_partida_min: number | null
          chegada_prevista_utc: string | null
          chegada_real_utc: string | null
          chegada_revista_utc: string | null
          consultado_em: string
          esteira: string | null
          id: string
          origem: string
          partida_prevista_utc: string | null
          partida_real_utc: string | null
          partida_revista_utc: string | null
          payload_json: Json | null
          portao_chegada: string | null
          portao_partida: string | null
          status: string | null
          terminal_chegada: string | null
          terminal_partida: string | null
          ticket_id: string
        }
        Insert: {
          atraso_chegada_min?: number | null
          atraso_partida_min?: number | null
          chegada_prevista_utc?: string | null
          chegada_real_utc?: string | null
          chegada_revista_utc?: string | null
          consultado_em?: string
          esteira?: string | null
          id?: string
          origem?: string
          partida_prevista_utc?: string | null
          partida_real_utc?: string | null
          partida_revista_utc?: string | null
          payload_json?: Json | null
          portao_chegada?: string | null
          portao_partida?: string | null
          status?: string | null
          terminal_chegada?: string | null
          terminal_partida?: string | null
          ticket_id: string
        }
        Update: {
          atraso_chegada_min?: number | null
          atraso_partida_min?: number | null
          chegada_prevista_utc?: string | null
          chegada_real_utc?: string | null
          chegada_revista_utc?: string | null
          consultado_em?: string
          esteira?: string | null
          id?: string
          origem?: string
          partida_prevista_utc?: string | null
          partida_real_utc?: string | null
          partida_revista_utc?: string | null
          payload_json?: Json | null
          portao_chegada?: string | null
          portao_partida?: string | null
          status?: string | null
          terminal_chegada?: string | null
          terminal_partida?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_status_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket"
            referencedColumns: ["id"]
          },
        ]
      }
      item_attachment: {
        Row: {
          content_type: string
          created_at: string
          deleted_at: string | null
          id: string
          item_id: string
          item_tipo: string
          nome: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          content_type: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id: string
          item_tipo: string
          nome: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id?: string
          item_tipo?: string
          nome?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: []
      }
      lodging: {
        Row: {
          anexo_url: string | null
          cancelamento_gratis_ate: string | null
          checkin: string
          checkout: string
          cidade: string | null
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          endereco: string | null
          expense_id: string | null
          id: string
          lat: number | null
          lng: number | null
          localizador: string | null
          moeda: string | null
          nome: string
          origem: string
          place_id: string | null
          politica_cancelamento: string | null
          site: string | null
          traveler_person_id: string | null
          trip_id: string
          tz: string | null
          valor: number | null
        }
        Insert: {
          anexo_url?: string | null
          cancelamento_gratis_ate?: string | null
          checkin: string
          checkout: string
          cidade?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          endereco?: string | null
          expense_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          localizador?: string | null
          moeda?: string | null
          nome: string
          origem?: string
          place_id?: string | null
          politica_cancelamento?: string | null
          site?: string | null
          traveler_person_id?: string | null
          trip_id: string
          tz?: string | null
          valor?: number | null
        }
        Update: {
          anexo_url?: string | null
          cancelamento_gratis_ate?: string | null
          checkin?: string
          checkout?: string
          cidade?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          endereco?: string | null
          expense_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          localizador?: string | null
          moeda?: string | null
          nome?: string
          origem?: string
          place_id?: string | null
          politica_cancelamento?: string | null
          site?: string | null
          traveler_person_id?: string | null
          trip_id?: string
          tz?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lodging_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_traveler_person_id_fkey"
            columns: ["traveler_person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_guest: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          person_id: string
          room_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          person_id: string
          room_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          person_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodging_guest_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_guest_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "lodging_room"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_room: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          lodging_id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          lodging_id: string
          nome?: string
          tipo?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          lodging_id?: string
          nome?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lodging_room_lodging_id_fkey"
            columns: ["lodging_id"]
            isOneToOne: false
            referencedRelation: "lodging"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_account: {
        Row: {
          cartao_path: string | null
          categoria: string | null
          created_at: string
          deleted_at: string | null
          id: string
          numero: string | null
          owner_id: string | null
          person_id: string
          programa: string
          site_url: string | null
          tipo: string
          titular: string | null
        }
        Insert: {
          cartao_path?: string | null
          categoria?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          numero?: string | null
          owner_id?: string | null
          person_id: string
          programa: string
          site_url?: string | null
          tipo?: string
          titular?: string | null
        }
        Update: {
          cartao_path?: string | null
          categoria?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          numero?: string | null
          owner_id?: string | null
          person_id?: string
          programa?: string
          site_url?: string | null
          tipo?: string
          titular?: string | null
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
          account_id: string | null
          apelido: string | null
          atualizado_em: string
          consentimento_em: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          emergencia_nome: string | null
          emergencia_parentesco: string | null
          emergencia_telefone: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          idioma: string
          kind: string
          modo: string | null
          nacionalidades: string[]
          nome: string
          nome_como_no_documento: string | null
          owner_id: string | null
          passo_atual: number
          sexo: string | null
          status: string
          telefone: string | null
          user_id: string | null
          visto_negado: boolean | null
          visto_negado_detalhe: string | null
        }
        Insert: {
          account_id?: string | null
          apelido?: string | null
          atualizado_em?: string
          consentimento_em?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          emergencia_nome?: string | null
          emergencia_parentesco?: string | null
          emergencia_telefone?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          idioma?: string
          kind?: string
          modo?: string | null
          nacionalidades?: string[]
          nome: string
          nome_como_no_documento?: string | null
          owner_id?: string | null
          passo_atual?: number
          sexo?: string | null
          status?: string
          telefone?: string | null
          user_id?: string | null
          visto_negado?: boolean | null
          visto_negado_detalhe?: string | null
        }
        Update: {
          account_id?: string | null
          apelido?: string | null
          atualizado_em?: string
          consentimento_em?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          emergencia_nome?: string | null
          emergencia_parentesco?: string | null
          emergencia_telefone?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          idioma?: string
          kind?: string
          modo?: string | null
          nacionalidades?: string[]
          nome?: string
          nome_como_no_documento?: string | null
          owner_id?: string | null
          passo_atual?: number
          sexo?: string | null
          status?: string
          telefone?: string | null
          user_id?: string | null
          visto_negado?: boolean | null
          visto_negado_detalhe?: string | null
        }
        Relationships: []
      }
      person_change: {
        Row: {
          arquivo_antigo: string | null
          arquivo_novo: string | null
          campo: string
          criado_em: string
          deleted_at: string | null
          id: string
          person_id: string
          secao: string
          status: string
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          arquivo_antigo?: string | null
          arquivo_novo?: string | null
          campo: string
          criado_em?: string
          deleted_at?: string | null
          id?: string
          person_id: string
          secao: string
          status?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          arquivo_antigo?: string | null
          arquivo_novo?: string | null
          campo?: string
          criado_em?: string
          deleted_at?: string | null
          id?: string
          person_id?: string
          secao?: string
          status?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_change_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      person_preferences: {
        Row: {
          assento: string | null
          bebe_alcool: boolean | null
          created_at: string
          deleted_at: string | null
          id: string
          person_id: string
          quarto: string | null
          refeicao_voo: string | null
          restricoes: string[]
        }
        Insert: {
          assento?: string | null
          bebe_alcool?: boolean | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          person_id: string
          quarto?: string | null
          refeicao_voo?: string | null
          restricoes?: string[]
        }
        Update: {
          assento?: string | null
          bebe_alcool?: boolean | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          person_id?: string
          quarto?: string | null
          refeicao_voo?: string | null
          restricoes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "person_preferences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      person_section_review: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          person_id: string
          recado: string | null
          revisado_em: string | null
          revisado_por: string | null
          secao: string
          status: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          person_id: string
          recado?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          secao: string
          status?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          person_id?: string
          recado?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          secao?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_section_review_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      push_device: {
        Row: {
          account_id: string
          ativo: boolean
          criado_em: string
          id: string
          plataforma: string
          token: string
          user_agent: string | null
          visto_em: string
        }
        Insert: {
          account_id: string
          ativo?: boolean
          criado_em?: string
          id?: string
          plataforma?: string
          token: string
          user_agent?: string | null
          visto_em?: string
        }
        Update: {
          account_id?: string
          ativo?: boolean
          criado_em?: string
          id?: string
          plataforma?: string
          token?: string
          user_agent?: string | null
          visto_em?: string
        }
        Relationships: []
      }
      push_log: {
        Row: {
          account_id: string
          corpo: string
          enviado_em: string
          erro: string | null
          id: string
          ref_id: string | null
          status: string
          tipo: string
          titulo: string
          url: string | null
        }
        Insert: {
          account_id: string
          corpo: string
          enviado_em?: string
          erro?: string | null
          id?: string
          ref_id?: string | null
          status: string
          tipo: string
          titulo: string
          url?: string | null
        }
        Update: {
          account_id?: string
          corpo?: string
          enviado_em?: string
          erro?: string | null
          id?: string
          ref_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          url?: string | null
        }
        Relationships: []
      }
      push_pref: {
        Row: {
          account_id: string
          atualizado_em: string
          aviso: boolean
          checkin: boolean
          claude: boolean
          convite: boolean
          criado_em: string
          documento: boolean
          silencio_fim: string
          silencio_inicio: string
          voo: boolean
        }
        Insert: {
          account_id: string
          atualizado_em?: string
          aviso?: boolean
          checkin?: boolean
          claude?: boolean
          convite?: boolean
          criado_em?: string
          documento?: boolean
          silencio_fim?: string
          silencio_inicio?: string
          voo?: boolean
        }
        Update: {
          account_id?: string
          atualizado_em?: string
          aviso?: boolean
          checkin?: boolean
          claude?: boolean
          convite?: boolean
          criado_em?: string
          documento?: boolean
          silencio_fim?: string
          silencio_inicio?: string
          voo?: boolean
        }
        Relationships: []
      }
      reservation: {
        Row: {
          cidade: string | null
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          expense_id: string | null
          fim_tz: string | null
          fim_utc: string | null
          id: string
          inicio_tz: string
          inicio_utc: string
          lat: number | null
          lng: number | null
          local: string | null
          localizador: string | null
          moeda: string | null
          origem: string
          place_id: string | null
          site: string | null
          tipo: string
          titulo: string
          trip_id: string
          valor: number | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          expense_id?: string | null
          fim_tz?: string | null
          fim_utc?: string | null
          id?: string
          inicio_tz: string
          inicio_utc: string
          lat?: number | null
          lng?: number | null
          local?: string | null
          localizador?: string | null
          moeda?: string | null
          origem?: string
          place_id?: string | null
          site?: string | null
          tipo: string
          titulo: string
          trip_id: string
          valor?: number | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          expense_id?: string | null
          fim_tz?: string | null
          fim_utc?: string | null
          id?: string
          inicio_tz?: string
          inicio_utc?: string
          lat?: number | null
          lng?: number | null
          local?: string | null
          localizador?: string | null
          moeda?: string | null
          origem?: string
          place_id?: string | null
          site?: string | null
          tipo?: string
          titulo?: string
          trip_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_person: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          papel: string | null
          person_id: string
          reservation_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          papel?: string | null
          person_id: string
          reservation_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          papel?: string | null
          person_id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_person_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_person_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservation"
            referencedColumns: ["id"]
          },
        ]
      }
      share_grant: {
        Row: {
          blocos: string[]
          created_at: string
          expira_em: string | null
          grantee_id: string
          grantee_nome: string | null
          id: string
          owner_id: string
          owner_nome: string | null
          revogado_em: string | null
          status: string
          trip_id: string | null
          trip_ids: string[] | null
        }
        Insert: {
          blocos?: string[]
          created_at?: string
          expira_em?: string | null
          grantee_id: string
          grantee_nome?: string | null
          id?: string
          owner_id: string
          owner_nome?: string | null
          revogado_em?: string | null
          status?: string
          trip_id?: string | null
          trip_ids?: string[] | null
        }
        Update: {
          blocos?: string[]
          created_at?: string
          expira_em?: string | null
          grantee_id?: string
          grantee_nome?: string | null
          id?: string
          owner_id?: string
          owner_nome?: string | null
          revogado_em?: string | null
          status?: string
          trip_id?: string | null
          trip_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "share_grant_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      share_invite: {
        Row: {
          blocos: string[]
          created_at: string
          direcao: string
          expira_em: string
          from_id: string
          from_nome: string | null
          grant_expira_em: string | null
          id: string
          para_account: string | null
          person_id: string | null
          recusado_em: string | null
          token_cifrado: string | null
          token_hash: string
          trip_id: string | null
          trip_ids: string[] | null
          usado_em: string | null
          usado_por: string | null
        }
        Insert: {
          blocos?: string[]
          created_at?: string
          direcao?: string
          expira_em?: string
          from_id?: string
          from_nome?: string | null
          grant_expira_em?: string | null
          id?: string
          para_account?: string | null
          person_id?: string | null
          recusado_em?: string | null
          token_cifrado?: string | null
          token_hash: string
          trip_id?: string | null
          trip_ids?: string[] | null
          usado_em?: string | null
          usado_por?: string | null
        }
        Update: {
          blocos?: string[]
          created_at?: string
          direcao?: string
          expira_em?: string
          from_id?: string
          from_nome?: string | null
          grant_expira_em?: string | null
          id?: string
          para_account?: string | null
          person_id?: string | null
          recusado_em?: string | null
          token_cifrado?: string | null
          token_hash?: string
          trip_id?: string | null
          trip_ids?: string[] | null
          usado_em?: string | null
          usado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_invite_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_invite_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket: {
        Row: {
          anexo_url: string | null
          assento: string | null
          chegada_tz: string
          chegada_utc: string
          companhia: string | null
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          destino_cidade: string | null
          destino_iata: string | null
          expense_id: string | null
          grupo_reserva: string | null
          id: string
          localizador: string | null
          nome_no_bilhete: string | null
          numero: string | null
          origem: string
          origem_cidade: string | null
          origem_iata: string | null
          partida_tz: string
          partida_utc: string
          tipo: string
          traveler_person_id: string | null
          trip_id: string
        }
        Insert: {
          anexo_url?: string | null
          assento?: string | null
          chegada_tz: string
          chegada_utc: string
          companhia?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          destino_cidade?: string | null
          destino_iata?: string | null
          expense_id?: string | null
          grupo_reserva?: string | null
          id?: string
          localizador?: string | null
          nome_no_bilhete?: string | null
          numero?: string | null
          origem?: string
          origem_cidade?: string | null
          origem_iata?: string | null
          partida_tz: string
          partida_utc: string
          tipo: string
          traveler_person_id?: string | null
          trip_id: string
        }
        Update: {
          anexo_url?: string | null
          assento?: string | null
          chegada_tz?: string
          chegada_utc?: string
          companhia?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          destino_cidade?: string | null
          destino_iata?: string | null
          expense_id?: string | null
          grupo_reserva?: string | null
          id?: string
          localizador?: string | null
          nome_no_bilhete?: string | null
          numero?: string | null
          origem?: string
          origem_cidade?: string | null
          origem_iata?: string | null
          partida_tz?: string
          partida_utc?: string
          tipo?: string
          traveler_person_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_traveler_person_id_fkey"
            columns: ["traveler_person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_passenger: {
        Row: {
          assento: string | null
          created_at: string
          deleted_at: string | null
          eticket: string | null
          id: string
          loyalty_account_id: string | null
          nome_no_bilhete: string | null
          person_id: string
          ticket_id: string
        }
        Insert: {
          assento?: string | null
          created_at?: string
          deleted_at?: string | null
          eticket?: string | null
          id?: string
          loyalty_account_id?: string | null
          nome_no_bilhete?: string | null
          person_id: string
          ticket_id: string
        }
        Update: {
          assento?: string | null
          created_at?: string
          deleted_at?: string | null
          eticket?: string | null
          id?: string
          loyalty_account_id?: string | null
          nome_no_bilhete?: string | null
          person_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_passenger_loyalty_account_id_fkey"
            columns: ["loyalty_account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_passenger_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_passenger_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_document: {
        Row: {
          aguardando_em: string | null
          anexo_url: string | null
          arquivo_path: string | null
          created_at: string
          deleted_at: string | null
          detalhe: string | null
          emissao: string | null
          id: string
          nome_no_documento: string | null
          numero: string | null
          owner_id: string | null
          pais_emissor: string | null
          person_id: string
          sexo: string | null
          tipo: string
          validade: string | null
        }
        Insert: {
          aguardando_em?: string | null
          anexo_url?: string | null
          arquivo_path?: string | null
          created_at?: string
          deleted_at?: string | null
          detalhe?: string | null
          emissao?: string | null
          id?: string
          nome_no_documento?: string | null
          numero?: string | null
          owner_id?: string | null
          pais_emissor?: string | null
          person_id: string
          sexo?: string | null
          tipo: string
          validade?: string | null
        }
        Update: {
          aguardando_em?: string | null
          anexo_url?: string | null
          arquivo_path?: string | null
          created_at?: string
          deleted_at?: string | null
          detalhe?: string | null
          emissao?: string | null
          id?: string
          nome_no_documento?: string | null
          numero?: string | null
          owner_id?: string | null
          pais_emissor?: string | null
          person_id?: string
          sexo?: string | null
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
          cidades: string[]
          created_at: string
          data_fim: string
          data_inicio: string
          deleted_at: string | null
          destino: string | null
          id: string
          moeda_base: string
          nome: string
          owner_id: string
          regra_passaporte: Json | null
          status: string
        }
        Insert: {
          arquivada_em?: string | null
          capa_url?: string | null
          cidades?: string[]
          created_at?: string
          data_fim: string
          data_inicio: string
          deleted_at?: string | null
          destino?: string | null
          id?: string
          moeda_base: string
          nome: string
          owner_id: string
          regra_passaporte?: Json | null
          status?: string
        }
        Update: {
          arquivada_em?: string | null
          capa_url?: string | null
          cidades?: string[]
          created_at?: string
          data_fim?: string
          data_inicio?: string
          deleted_at?: string | null
          destino?: string | null
          id?: string
          moeda_base?: string
          nome?: string
          owner_id?: string
          regra_passaporte?: Json | null
          status?: string
        }
        Relationships: []
      }
      trip_member: {
        Row: {
          convidado_por: string | null
          convite_email: string | null
          convite_idioma: string
          convite_telefone: string | null
          created_at: string
          deleted_at: string | null
          entrou_em: string
          id: string
          lembrado_em: string | null
          papel: string
          person_id: string
          respondido_em: string | null
          status: string
          trip_id: string
        }
        Insert: {
          convidado_por?: string | null
          convite_email?: string | null
          convite_idioma?: string
          convite_telefone?: string | null
          created_at?: string
          deleted_at?: string | null
          entrou_em?: string
          id?: string
          lembrado_em?: string | null
          papel?: string
          person_id: string
          respondido_em?: string | null
          status?: string
          trip_id: string
        }
        Update: {
          convidado_por?: string | null
          convite_email?: string | null
          convite_idioma?: string
          convite_telefone?: string | null
          created_at?: string
          deleted_at?: string | null
          entrou_em?: string
          id?: string
          lembrado_em?: string | null
          papel?: string
          person_id?: string
          respondido_em?: string | null
          status?: string
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
      trip_notice: {
        Row: {
          campo: string | null
          canal: string | null
          enviado_em: string
          enviado_por: string | null
          id: string
          lido_em: string | null
          mensagem: string
          person_id: string | null
          regra_id: string | null
          resolvido_em: string | null
          tipo: string
          trip_id: string
        }
        Insert: {
          campo?: string | null
          canal?: string | null
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          lido_em?: string | null
          mensagem: string
          person_id?: string | null
          regra_id?: string | null
          resolvido_em?: string | null
          tipo: string
          trip_id: string
        }
        Update: {
          campo?: string | null
          canal?: string | null
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          lido_em?: string | null
          mensagem?: string
          person_id?: string | null
          regra_id?: string | null
          resolvido_em?: string | null
          tipo?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_notice_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_notice_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_trust: {
        Row: {
          account_id: string
          criado_em: string
          organizer_id: string
          revogado_em: string | null
        }
        Insert: {
          account_id?: string
          criado_em?: string
          organizer_id: string
          revogado_em?: string | null
        }
        Update: {
          account_id?: string
          criado_em?: string
          organizer_id?: string
          revogado_em?: string | null
        }
        Relationships: []
      }
      vault_item: {
        Row: {
          account_id: string
          created_at: string
          encrypted_payload: string
          id: string
          iv: string
          loyalty_account_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          encrypted_payload: string
          id?: string
          iv: string
          loyalty_account_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          encrypted_payload?: string
          id?: string
          iv?: string
          loyalty_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_item_loyalty_account_id_fkey"
            columns: ["loyalty_account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_account"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_meta: {
        Row: {
          account_id: string
          created_at: string
          kdf_iterations: number
          kdf_salt: string
          updated_at: string
          verifier_ciphertext: string
          verifier_iv: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          kdf_iterations?: number
          kdf_salt: string
          updated_at?: string
          verifier_ciphertext: string
          verifier_iv: string
        }
        Update: {
          account_id?: string
          created_at?: string
          kdf_iterations?: number
          kdf_salt?: string
          updated_at?: string
          verifier_ciphertext?: string
          verifier_iv?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      autoria_item: {
        Args: { _id: string; _tipo: string }
        Returns: {
          autor: string
          editar: boolean
          sou_eu: boolean
        }[]
      }
      conferencia_nomes_voo: {
        Args: { _ticket_id: string }
        Returns: {
          estado: string
          person_id: string
        }[]
      }
      conferir_viagem: {
        Args: { _tid: string }
        Returns: {
          acesso: boolean
          avisos_abertos: number
          convite_email: string
          convite_telefone: string
          kind: string
          member_id: string
          meu: boolean
          nacionalidades: string[]
          nome: string
          nome_documento: string
          nomes_bilhete: string[]
          papel: string
          passaporte: Json
          pedido_aberto: boolean
          person_id: string
          seguro: string
          status: string
          vacina: string
          vistos: Json
        }[]
      }
      convidar_sem_conta: {
        Args: {
          _email: string
          _idioma: string
          _member: string
          _nome: string
          _person: string
          _telefone: string
          _trip: string
        }
        Returns: string
      }
      convites_recebidos: {
        Args: never
        Returns: {
          assentos: string[]
          data_fim: string
          data_inicio: string
          dependente: boolean
          hoteis: number
          member_id: string
          organizador: string
          organizador_id: string
          person_id: string
          pessoa: string
          quartos: string[]
          reservas: Json
          trens: number
          trip_id: string
          viagem: string
          voos: number
        }[]
      }
      duplicar_viagem: {
        Args: {
          _cidades: string[]
          _fim: string
          _inicio: string
          _moeda: string
          _nome: string
          _novo: string
          _origem: string
        }
        Returns: string
      }
      membros_viagem: {
        Args: { _tid: string }
        Returns: {
          apelido: string
          id: string
          kind: string
          meu: boolean
          nome: string
          nome_como_no_documento: string
          papel: string
          person_id: string
          status: string
        }[]
      }
      pedidos_recebidos: {
        Args: never
        Returns: {
          ate: string
          blocos: string[]
          from_id: string
          from_nome: string
          id: string
          pessoa: string
          trip_id: string
          viagem: string
        }[]
      }
      pedir_dados: {
        Args: {
          _ate_fim: boolean
          _blocos: string[]
          _id: string
          _person: string
          _trip: string
        }
        Returns: string
      }
      pontos_viagem: {
        Args: { _tid: string }
        Returns: {
          inicio_utc: string
          item_id: string
          item_tipo: string
          lat: number
          lng: number
          place_id: string
          titulo: string
          tz: string
        }[]
      }
      receber_convites_por_email: { Args: never; Returns: number }
      responder_pedido: {
        Args: { _aceitar: boolean; _blocos: string[]; _id: string }
        Returns: boolean
      }
      roteiro_viagem: {
        Args: { _tid: string }
        Returns: {
          cidade: string
          companhia: string
          destino_iata: string
          detalhe: boolean
          editar: boolean
          fim_tz: string
          fim_utc: string
          inicio_tz: string
          inicio_utc: string
          item_id: string
          item_tipo: string
          numero: string
          origem_iata: string
          pessoas: Json
          subtipo: string
          titulo: string
        }[]
      }
      somar_uso_api: { Args: { _mes: string; _n: number }; Returns: number }
      telefones_viagem: {
        Args: { _tid: string }
        Returns: {
          person_id: string
          telefone: string
        }[]
      }
      verificar_cron_voos: { Args: { _t: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
