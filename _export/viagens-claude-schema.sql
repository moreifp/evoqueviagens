Output format is unaligned.
-- Viagens Claude: schema-only export (no data). Generated from catalog.
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions; -- v1.1
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog; -- v1.6.4
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public; -- v0.20.4
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions; -- v1.11
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; -- v1.3
CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog; -- v1.0
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault; -- v0.3.1
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions; -- v1.1

CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS app_private;

-- Types

-- Sequences

-- Tables
CREATE TABLE app_private.cron_config (
  k text NOT NULL,
  v text NOT NULL
);
CREATE TABLE public.agent_inbox (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid DEFAULT auth.uid() NOT NULL,
  trip_id uuid,
  tipo_alvo text NOT NULL,
  payload_json jsonb NOT NULL,
  idempotency_key text NOT NULL,
  origem_cliente text,
  lote_id uuid,
  status text DEFAULT 'pendente'::text NOT NULL,
  achados_json jsonb DEFAULT '[]'::jsonb NOT NULL,
  criado_em timestamp with time zone DEFAULT now() NOT NULL,
  resolvido_em timestamp with time zone,
  item_id uuid
);
CREATE TABLE public.api_alerta (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trip_id uuid NOT NULL,
  mensagem text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.api_usage (
  mes text NOT NULL,
  unidades integer DEFAULT 0 NOT NULL,
  aviso_em timestamp with time zone
);
CREATE TABLE public.app_admin (
  email text NOT NULL,
  added_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  telefone text
);
CREATE TABLE public.cadastro_link (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  token_hash text NOT NULL,
  expira_em timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
  revogado_em timestamp with time zone,
  criado_por text,
  ultimo_acesso_em timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  token_cifrado text
);
CREATE TABLE public.consistency_finding (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trip_id uuid NOT NULL,
  regra_id text NOT NULL,
  severidade text NOT NULL,
  itens_envolvidos text[] DEFAULT '{}'::text[] NOT NULL,
  mensagem text NOT NULL,
  hash_dos_dados text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  dispensado_em timestamp with time zone
);
CREATE TABLE public.document_attachment (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_id uuid NOT NULL,
  person_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint DEFAULT 0 NOT NULL,
  is_primary boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);
CREATE TABLE public.entry_rule (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nacionalidade character(2) NOT NULL,
  pais_destino character(2) NOT NULL,
  exigencia text NOT NULL,
  detalhe text,
  estadia_max_dias integer,
  validade_passaporte_min_meses integer,
  lead_time_dias integer,
  fonte_url text NOT NULL,
  verificado_em date NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.expense (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trip_id uuid NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL,
  data date NOT NULL,
  valor_original numeric(14,2) NOT NULL,
  moeda_original character(3) NOT NULL,
  taxa_cambio numeric(18,8) NOT NULL,
  valor_moeda_base numeric(14,2) NOT NULL,
  pago_por uuid,
  comprovante_url text,
  criado_por uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  editado_em timestamp with time zone,
  deleted_at timestamp with time zone,
  taxa_fonte text,
  taxa_data date
);
CREATE TABLE public.flight_status (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  consultado_em timestamp with time zone DEFAULT now() NOT NULL,
  status text,
  partida_prevista_utc timestamp with time zone,
  partida_revista_utc timestamp with time zone,
  partida_real_utc timestamp with time zone,
  chegada_prevista_utc timestamp with time zone,
  chegada_revista_utc timestamp with time zone,
  chegada_real_utc timestamp with time zone,
  terminal_partida text,
  portao_partida text,
  terminal_chegada text,
  portao_chegada text,
  esteira text,
  atraso_partida_min integer,
  atraso_chegada_min integer,
  origem text DEFAULT 'manual'::text NOT NULL,
  payload_json jsonb
);
CREATE TABLE public.item_attachment (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  item_tipo text NOT NULL,
  item_id uuid NOT NULL,
  storage_path text NOT NULL,
  nome text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  privado boolean DEFAULT false NOT NULL
);
CREATE TABLE public.lodging (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trip_id uuid NOT NULL,
  nome text NOT NULL,
  endereco text,
  cidade text,
  lat double precision,
  lng double precision,
  checkin timestamp with time zone NOT NULL,
  checkout timestamp with time zone NOT NULL,
  localizador text,
  valor numeric(12,2),
  moeda character(3),
  politica_cancelamento text,
  anexo_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  traveler_person_id uuid,
  criado_por uuid DEFAULT auth.uid(),
  origem text DEFAULT 'ui'::text NOT NULL,
  cancelamento_gratis_ate date,
  expense_id uuid,
  place_id text,
  site text,
  tz text
);
CREATE TABLE public.lodging_guest (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  room_id uuid NOT NULL,
  person_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);
CREATE TABLE public.lodging_room (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lodging_id uuid NOT NULL,
  nome text DEFAULT 'Quarto'::text NOT NULL,
  tipo text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);
CREATE TABLE public.loyalty_account (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  owner_id uuid DEFAULT auth.uid(),
  programa text NOT NULL,
  numero text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  categoria text,
  tipo text DEFAULT 'aerea'::text NOT NULL,
  titular text,
  site_url text,
  cartao_path text
);
CREATE TABLE public.person (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  owner_id uuid DEFAULT auth.uid(),
  nome text NOT NULL,
  nome_como_no_documento text,
  nacionalidades text[] DEFAULT '{}'::text[] NOT NULL,
  data_nascimento date,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  apelido text,
  cpf text,
  telefone text,
  email text,
  foto_url text,
  sexo text,
  endereco text,
  emergencia_nome text,
  emergencia_parentesco text,
  emergencia_telefone text,
  status text DEFAULT 'convidado'::text NOT NULL,
  passo_atual integer DEFAULT 0 NOT NULL,
  modo text,
  idioma text DEFAULT 'pt'::text NOT NULL,
  consentimento_em timestamp with time zone,
  atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
  visto_negado boolean,
  visto_negado_detalhe text,
  account_id uuid DEFAULT auth.uid(),
  kind text DEFAULT 'dependent'::text NOT NULL
);
CREATE TABLE public.person_change (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  secao text NOT NULL,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  arquivo_antigo text,
  arquivo_novo text,
  criado_em timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'pendente'::text NOT NULL,
  deleted_at timestamp with time zone
);
CREATE TABLE public.person_item_dispensa (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  item text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);
CREATE TABLE public.person_preferences (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  assento text,
  quarto text,
  bebe_alcool boolean,
  restricoes text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  refeicao_voo text
);
CREATE TABLE public.person_section_review (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  secao text NOT NULL,
  status text DEFAULT 'pendente'::text NOT NULL,
  recado text,
  revisado_por text,
  revisado_em timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);
CREATE TABLE public.push_device (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  token text NOT NULL,
  plataforma text DEFAULT 'web'::text NOT NULL,
  user_agent text,
  criado_em timestamp with time zone DEFAULT now() NOT NULL,
  visto_em timestamp with time zone DEFAULT now() NOT NULL,
  ativo boolean DEFAULT true NOT NULL
);
CREATE TABLE public.push_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  tipo text NOT NULL,
  ref_id text,
  titulo text NOT NULL,
  corpo text NOT NULL,
  url text,
  status text NOT NULL,
  erro text,
  enviado_em timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.push_pref (
  account_id uuid NOT NULL,
  voo boolean DEFAULT true NOT NULL,
  aviso boolean DEFAULT true NOT NULL,
  convite boolean DEFAULT true NOT NULL,
  claude boolean DEFAULT true NOT NULL,
  documento boolean DEFAULT true NOT NULL,
  checkin boolean DEFAULT false NOT NULL,
  silencio_inicio text DEFAULT '22:00'::text NOT NULL,
  silencio_fim text DEFAULT '07:00'::text NOT NULL,
  criado_em timestamp with time zone DEFAULT now() NOT NULL,
  atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.reservation (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trip_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  inicio_utc timestamp with time zone NOT NULL,
  inicio_tz text NOT NULL,
  fim_utc timestamp with time zone,
  fim_tz text,
  local text,
  cidade text,
  lat double precision,
  lng double precision,
  localizador text,
  valor numeric,
  moeda character(3),
  criado_por uuid DEFAULT auth.uid(),
  origem text DEFAULT 'ui'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  expense_id uuid,
  place_id text,
  site text
);
CREATE TABLE public.reservation_person (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reservation_id uuid NOT NULL,
  person_id uuid NOT NULL,
  papel text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);
CREATE TABLE public.share_grant (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  grantee_id uuid NOT NULL,
  owner_nome text,
  grantee_nome text,
  blocos text[] DEFAULT '{}'::text[] NOT NULL,
  status text DEFAULT 'ativo'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  revogado_em timestamp with time zone,
  trip_ids uuid[],
  trip_id uuid,
  expira_em timestamp with time zone
);
CREATE TABLE public.share_invite (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  from_id uuid DEFAULT auth.uid() NOT NULL,
  from_nome text,
  direcao text DEFAULT 'pedido'::text NOT NULL,
  blocos text[] DEFAULT '{}'::text[] NOT NULL,
  person_id uuid,
  token_hash text NOT NULL,
  token_cifrado text,
  expira_em timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
  usado_em timestamp with time zone,
  usado_por uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  trip_ids uuid[],
  trip_id uuid,
  para_account uuid,
  grant_expira_em timestamp with time zone,
  recusado_em timestamp with time zone
);
CREATE TABLE public.ticket (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trip_id uuid NOT NULL,
  tipo text NOT NULL,
  companhia text,
  numero text,
  localizador text,
  origem_iata character(3),
  destino_iata character(3),
  origem_cidade text,
  destino_cidade text,
  partida_utc timestamp with time zone NOT NULL,
  partida_tz text NOT NULL,
  chegada_utc timestamp with time zone NOT NULL,
  chegada_tz text NOT NULL,
  assento text,
  nome_no_bilhete text,
  anexo_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  traveler_person_id uuid,
  criado_por uuid DEFAULT auth.uid(),
  origem text DEFAULT 'ui'::text NOT NULL,
  grupo_reserva text,
  expense_id uuid,
  bag_mao_qtd integer,
  bag_mao_kg numeric,
  item_pessoal boolean,
  bag_desp_qtd integer,
  bag_desp_kg numeric
);
CREATE TABLE public.ticket_passenger (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  person_id uuid NOT NULL,
  nome_no_bilhete text,
  assento text,
  eticket text,
  loyalty_account_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  bag_mao_qtd integer,
  bag_mao_kg numeric,
  item_pessoal boolean,
  bag_desp_qtd integer,
  bag_desp_kg numeric
);
CREATE TABLE public.traveler_document (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  owner_id uuid DEFAULT auth.uid(),
  tipo text NOT NULL,
  numero text,
  pais_emissor text,
  validade date,
  anexo_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  emissao date,
  nome_no_documento text,
  sexo text,
  detalhe text,
  arquivo_path text,
  aguardando_em timestamp with time zone
);
CREATE TABLE public.trip (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  nome text NOT NULL,
  destino text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  moeda_base character(3) NOT NULL,
  status text DEFAULT 'planejada'::text NOT NULL,
  capa_url text,
  arquivada_em timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  cidades text[] DEFAULT '{}'::text[] NOT NULL,
  regra_passaporte jsonb
);
CREATE TABLE public.trip_member (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trip_id uuid NOT NULL,
  person_id uuid NOT NULL,
  papel text DEFAULT 'membro'::text NOT NULL,
  entrou_em date DEFAULT CURRENT_DATE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  status text DEFAULT 'convidado'::text NOT NULL,
  convidado_por uuid DEFAULT auth.uid(),
  respondido_em timestamp with time zone,
  convite_email text,
  convite_telefone text,
  convite_idioma text DEFAULT 'pt'::text NOT NULL,
  lembrado_em timestamp with time zone
);
CREATE TABLE public.trip_notice (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trip_id uuid NOT NULL,
  person_id uuid,
  tipo text NOT NULL,
  mensagem text NOT NULL,
  regra_id text,
  enviado_por uuid DEFAULT auth.uid(),
  enviado_em timestamp with time zone DEFAULT now() NOT NULL,
  canal text,
  lido_em timestamp with time zone,
  resolvido_em timestamp with time zone,
  campo text
);
CREATE TABLE public.trip_trust (
  account_id uuid DEFAULT auth.uid() NOT NULL,
  organizer_id uuid NOT NULL,
  criado_em timestamp with time zone DEFAULT now() NOT NULL,
  revogado_em timestamp with time zone
);
CREATE TABLE public.vault_item (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid DEFAULT auth.uid() NOT NULL,
  loyalty_account_id uuid NOT NULL,
  encrypted_payload text NOT NULL,
  iv text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.vault_meta (
  account_id uuid DEFAULT auth.uid() NOT NULL,
  kdf_salt text NOT NULL,
  kdf_iterations integer DEFAULT 600000 NOT NULL,
  verifier_ciphertext text NOT NULL,
  verifier_iv text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Constraints
ALTER TABLE app_private.cron_config ADD CONSTRAINT cron_config_pkey PRIMARY KEY (k);
ALTER TABLE public.agent_inbox ADD CONSTRAINT agent_inbox_pkey PRIMARY KEY (id);
ALTER TABLE public.api_alerta ADD CONSTRAINT api_alerta_pkey PRIMARY KEY (id);
ALTER TABLE public.api_usage ADD CONSTRAINT api_usage_pkey PRIMARY KEY (mes);
ALTER TABLE public.app_admin ADD CONSTRAINT app_admin_pkey PRIMARY KEY (email);
ALTER TABLE public.cadastro_link ADD CONSTRAINT cadastro_link_pkey PRIMARY KEY (id);
ALTER TABLE public.consistency_finding ADD CONSTRAINT consistency_finding_pkey PRIMARY KEY (id);
ALTER TABLE public.document_attachment ADD CONSTRAINT document_attachment_pkey PRIMARY KEY (id);
ALTER TABLE public.entry_rule ADD CONSTRAINT entry_rule_pkey PRIMARY KEY (id);
ALTER TABLE public.expense ADD CONSTRAINT expense_pkey PRIMARY KEY (id);
ALTER TABLE public.flight_status ADD CONSTRAINT flight_status_pkey PRIMARY KEY (id);
ALTER TABLE public.item_attachment ADD CONSTRAINT item_attachment_pkey PRIMARY KEY (id);
ALTER TABLE public.lodging ADD CONSTRAINT lodging_pkey PRIMARY KEY (id);
ALTER TABLE public.lodging_guest ADD CONSTRAINT lodging_guest_pkey PRIMARY KEY (id);
ALTER TABLE public.lodging_room ADD CONSTRAINT lodging_room_pkey PRIMARY KEY (id);
ALTER TABLE public.loyalty_account ADD CONSTRAINT loyalty_account_pkey PRIMARY KEY (id);
ALTER TABLE public.person ADD CONSTRAINT person_pkey PRIMARY KEY (id);
ALTER TABLE public.person_change ADD CONSTRAINT person_change_pkey PRIMARY KEY (id);
ALTER TABLE public.person_item_dispensa ADD CONSTRAINT person_item_dispensa_pkey PRIMARY KEY (id);
ALTER TABLE public.person_preferences ADD CONSTRAINT person_preferences_pkey PRIMARY KEY (id);
ALTER TABLE public.person_section_review ADD CONSTRAINT person_section_review_pkey PRIMARY KEY (id);
ALTER TABLE public.push_device ADD CONSTRAINT push_device_pkey PRIMARY KEY (id);
ALTER TABLE public.push_log ADD CONSTRAINT push_log_pkey PRIMARY KEY (id);
ALTER TABLE public.push_pref ADD CONSTRAINT push_pref_pkey PRIMARY KEY (account_id);
ALTER TABLE public.reservation ADD CONSTRAINT reservation_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_person ADD CONSTRAINT reservation_person_pkey PRIMARY KEY (id);
ALTER TABLE public.share_grant ADD CONSTRAINT share_grant_pkey PRIMARY KEY (id);
ALTER TABLE public.share_invite ADD CONSTRAINT share_invite_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket ADD CONSTRAINT ticket_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_passenger ADD CONSTRAINT ticket_passenger_pkey PRIMARY KEY (id);
ALTER TABLE public.traveler_document ADD CONSTRAINT traveler_document_pkey PRIMARY KEY (id);
ALTER TABLE public.trip ADD CONSTRAINT trip_pkey PRIMARY KEY (id);
ALTER TABLE public.trip_member ADD CONSTRAINT trip_member_pkey PRIMARY KEY (id);
ALTER TABLE public.trip_notice ADD CONSTRAINT trip_notice_pkey PRIMARY KEY (id);
ALTER TABLE public.trip_trust ADD CONSTRAINT trip_trust_pkey PRIMARY KEY (account_id, organizer_id);
ALTER TABLE public.vault_item ADD CONSTRAINT vault_item_pkey PRIMARY KEY (id);
ALTER TABLE public.vault_meta ADD CONSTRAINT vault_meta_pkey PRIMARY KEY (account_id);
ALTER TABLE public.agent_inbox ADD CONSTRAINT agent_inbox_account_id_idempotency_key_key UNIQUE (account_id, idempotency_key);
ALTER TABLE public.cadastro_link ADD CONSTRAINT cadastro_link_token_hash_key UNIQUE (token_hash);
ALTER TABLE public.consistency_finding ADD CONSTRAINT consistency_finding_trip_id_regra_id_hash_dos_dados_key UNIQUE (trip_id, regra_id, hash_dos_dados);
ALTER TABLE public.document_attachment ADD CONSTRAINT document_attachment_storage_path_key UNIQUE (storage_path);
ALTER TABLE public.entry_rule ADD CONSTRAINT entry_rule_nacionalidade_pais_destino_key UNIQUE (nacionalidade, pais_destino);
ALTER TABLE public.person_preferences ADD CONSTRAINT person_preferences_person_id_key UNIQUE (person_id);
ALTER TABLE public.person_section_review ADD CONSTRAINT person_section_review_person_id_secao_key UNIQUE (person_id, secao);
ALTER TABLE public.push_device ADD CONSTRAINT push_device_token_key UNIQUE (token);
ALTER TABLE public.share_invite ADD CONSTRAINT share_invite_token_hash_key UNIQUE (token_hash);
ALTER TABLE public.trip_member ADD CONSTRAINT trip_member_trip_id_person_id_key UNIQUE (trip_id, person_id);
ALTER TABLE public.vault_item ADD CONSTRAINT vault_item_account_id_loyalty_account_id_key UNIQUE (account_id, loyalty_account_id);
ALTER TABLE public.agent_inbox ADD CONSTRAINT agent_inbox_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'confirmado'::text, 'descartado'::text])));
ALTER TABLE public.agent_inbox ADD CONSTRAINT agent_inbox_tipo_alvo_check CHECK ((tipo_alvo = ANY (ARRAY['voo'::text, 'hotel'::text, 'reserva'::text, 'despesa'::text])));
ALTER TABLE public.consistency_finding ADD CONSTRAINT consistency_finding_severidade_check CHECK ((severidade = ANY (ARRAY['resolver'::text, 'conferir'::text, 'sugestao'::text])));
ALTER TABLE public.document_attachment ADD CONSTRAINT document_attachment_size_bytes_check CHECK ((size_bytes >= 0));
ALTER TABLE public.expense ADD CONSTRAINT expense_valor_original_check CHECK ((valor_original > (0)::numeric));
ALTER TABLE public.flight_status ADD CONSTRAINT flight_status_origem_check CHECK ((origem = ANY (ARRAY['auto'::text, 'manual'::text])));
ALTER TABLE public.item_attachment ADD CONSTRAINT item_attachment_item_tipo_check CHECK ((item_tipo = ANY (ARRAY['ticket'::text, 'lodging'::text, 'reservation'::text])));
ALTER TABLE public.lodging ADD CONSTRAINT lodging_check CHECK ((checkout > checkin));
ALTER TABLE public.lodging ADD CONSTRAINT lodging_origem_check CHECK ((origem = ANY (ARRAY['ui'::text, 'agente'::text])));
ALTER TABLE public.loyalty_account ADD CONSTRAINT loyalty_account_tipo_check CHECK ((tipo = ANY (ARRAY['aerea'::text, 'hotel'::text, 'locadora'::text, 'sala_vip'::text])));
ALTER TABLE public.person ADD CONSTRAINT person_idioma_check CHECK ((idioma = ANY (ARRAY['pt'::text, 'en'::text])));
ALTER TABLE public.person ADD CONSTRAINT person_modo_check CHECK ((modo = ANY (ARRAY['rapido'::text, 'completo'::text])));
ALTER TABLE public.person ADD CONSTRAINT person_status_check CHECK ((status = ANY (ARRAY['convidado'::text, 'em_andamento'::text, 'enviado'::text, 'aprovado'::text, 'correcao'::text])));
ALTER TABLE public.person_change ADD CONSTRAINT person_change_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'recusado'::text])));
ALTER TABLE public.person_preferences ADD CONSTRAINT person_preferences_assento_check CHECK ((assento = ANY (ARRAY['janela'::text, 'corredor'::text, 'tanto_faz'::text])));
ALTER TABLE public.person_preferences ADD CONSTRAINT person_preferences_quarto_check CHECK ((quarto = ANY (ARRAY['casal'::text, 'duas_camas'::text, 'tanto_faz'::text])));
ALTER TABLE public.person_section_review ADD CONSTRAINT person_section_review_secao_check CHECK ((secao = ANY (ARRAY['voce'::text, 'passaporte'::text, 'extras'::text, 'vistos'::text, 'fidelidade'::text, 'preferencias'::text, 'emergencia'::text])));
ALTER TABLE public.person_section_review ADD CONSTRAINT person_section_review_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'correcao'::text])));
ALTER TABLE public.reservation ADD CONSTRAINT reservation_origem_check CHECK ((origem = ANY (ARRAY['ui'::text, 'agente'::text])));
ALTER TABLE public.reservation ADD CONSTRAINT reservation_tipo_check CHECK ((tipo = ANY (ARRAY['carro'::text, 'passeio'::text, 'restaurante'::text, 'outro'::text])));
ALTER TABLE public.ticket ADD CONSTRAINT ticket_origem_check CHECK ((origem = ANY (ARRAY['ui'::text, 'agente'::text])));
ALTER TABLE public.ticket ADD CONSTRAINT ticket_tipo_check CHECK ((tipo = ANY (ARRAY['voo'::text, 'trem'::text, 'onibus'::text, 'carro'::text, 'transfer'::text])));
ALTER TABLE public.traveler_document ADD CONSTRAINT traveler_document_tipo_chk CHECK ((tipo = ANY (ARRAY['passaporte'::text, 'visto'::text, 'esta'::text, 'eta_canada'::text, 'eta_uk'::text, 'etias'::text, 'k_eta'::text, 'outro_visto'::text, 'rg'::text, 'cnh'::text, 'pid'::text, 'vacina'::text, 'outra_vacina'::text, 'seguro'::text, 'global_entry'::text])));
ALTER TABLE public.trip ADD CONSTRAINT trip_check CHECK ((data_fim >= data_inicio));
ALTER TABLE public.trip ADD CONSTRAINT trip_status_check CHECK ((status = ANY (ARRAY['planejada'::text, 'andamento'::text, 'encerrada'::text])));
ALTER TABLE public.trip_member ADD CONSTRAINT trip_member_papel_check CHECK ((papel = ANY (ARRAY['owner'::text, 'membro'::text, 'convidado'::text])));
ALTER TABLE public.trip_member ADD CONSTRAINT trip_member_status_check CHECK ((status = ANY (ARRAY['convidado'::text, 'aceito'::text, 'recusado'::text, 'saiu'::text])));
ALTER TABLE public.vault_meta ADD CONSTRAINT vault_meta_kdf_iterations_check CHECK ((kdf_iterations >= 600000));
ALTER TABLE public.agent_inbox ADD CONSTRAINT agent_inbox_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id);
ALTER TABLE public.api_alerta ADD CONSTRAINT api_alerta_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE;
ALTER TABLE public.cadastro_link ADD CONSTRAINT cadastro_link_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.consistency_finding ADD CONSTRAINT consistency_finding_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE;
ALTER TABLE public.document_attachment ADD CONSTRAINT document_attachment_document_id_fkey FOREIGN KEY (document_id) REFERENCES traveler_document(id) ON DELETE CASCADE;
ALTER TABLE public.document_attachment ADD CONSTRAINT document_attachment_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE;
ALTER TABLE public.expense ADD CONSTRAINT expense_pago_por_fkey FOREIGN KEY (pago_por) REFERENCES person(id);
ALTER TABLE public.expense ADD CONSTRAINT expense_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE;
ALTER TABLE public.flight_status ADD CONSTRAINT flight_status_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE;
ALTER TABLE public.lodging ADD CONSTRAINT lodging_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expense(id) ON DELETE SET NULL;
ALTER TABLE public.lodging ADD CONSTRAINT lodging_traveler_person_id_fkey FOREIGN KEY (traveler_person_id) REFERENCES person(id);
ALTER TABLE public.lodging ADD CONSTRAINT lodging_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE;
ALTER TABLE public.lodging_guest ADD CONSTRAINT lodging_guest_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.lodging_guest ADD CONSTRAINT lodging_guest_room_id_fkey FOREIGN KEY (room_id) REFERENCES lodging_room(id) ON DELETE CASCADE;
ALTER TABLE public.lodging_room ADD CONSTRAINT lodging_room_lodging_id_fkey FOREIGN KEY (lodging_id) REFERENCES lodging(id) ON DELETE CASCADE;
ALTER TABLE public.loyalty_account ADD CONSTRAINT loyalty_account_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE;
ALTER TABLE public.person_change ADD CONSTRAINT person_change_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.person_item_dispensa ADD CONSTRAINT person_item_dispensa_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.person_preferences ADD CONSTRAINT person_preferences_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.person_section_review ADD CONSTRAINT person_section_review_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.reservation ADD CONSTRAINT reservation_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expense(id) ON DELETE SET NULL;
ALTER TABLE public.reservation ADD CONSTRAINT reservation_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE;
ALTER TABLE public.reservation_person ADD CONSTRAINT reservation_person_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.reservation_person ADD CONSTRAINT reservation_person_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservation(id) ON DELETE CASCADE;
ALTER TABLE public.share_grant ADD CONSTRAINT share_grant_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE SET NULL;
ALTER TABLE public.share_invite ADD CONSTRAINT share_invite_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.share_invite ADD CONSTRAINT share_invite_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE SET NULL;
ALTER TABLE public.ticket ADD CONSTRAINT ticket_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expense(id) ON DELETE SET NULL;
ALTER TABLE public.ticket ADD CONSTRAINT ticket_traveler_person_id_fkey FOREIGN KEY (traveler_person_id) REFERENCES person(id);
ALTER TABLE public.ticket ADD CONSTRAINT ticket_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE;
ALTER TABLE public.ticket_passenger ADD CONSTRAINT ticket_passenger_loyalty_account_id_fkey FOREIGN KEY (loyalty_account_id) REFERENCES loyalty_account(id) ON DELETE SET NULL;
ALTER TABLE public.ticket_passenger ADD CONSTRAINT ticket_passenger_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.ticket_passenger ADD CONSTRAINT ticket_passenger_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE;
ALTER TABLE public.traveler_document ADD CONSTRAINT traveler_document_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE;
ALTER TABLE public.trip_member ADD CONSTRAINT trip_member_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.trip_member ADD CONSTRAINT trip_member_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE;
ALTER TABLE public.trip_notice ADD CONSTRAINT trip_notice_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE public.trip_notice ADD CONSTRAINT trip_notice_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE;
ALTER TABLE public.vault_item ADD CONSTRAINT vault_item_loyalty_account_id_fkey FOREIGN KEY (loyalty_account_id) REFERENCES loyalty_account(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX agent_inbox_pendentes ON public.agent_inbox USING btree (account_id, trip_id) WHERE (status = 'pendente'::text);
CREATE INDEX document_attachment_document_idx ON public.document_attachment USING btree (document_id, created_at) WHERE (deleted_at IS NULL);
CREATE INDEX flight_status_ticket_idx ON public.flight_status USING btree (ticket_id, consultado_em DESC);
CREATE INDEX idx_expense_trip ON public.expense USING btree (trip_id);
CREATE INDEX idx_finding_trip ON public.consistency_finding USING btree (trip_id);
CREATE INDEX idx_lodging_trip ON public.lodging USING btree (trip_id);
CREATE INDEX idx_member_trip ON public.trip_member USING btree (trip_id);
CREATE INDEX idx_ticket_trip ON public.ticket USING btree (trip_id);
CREATE INDEX item_attachment_item_tipo_item_id_idx ON public.item_attachment USING btree (item_tipo, item_id);
CREATE INDEX item_attachment_storage_path_idx ON public.item_attachment USING btree (storage_path);
CREATE INDEX lodging_expense_id_idx ON public.lodging USING btree (expense_id) WHERE (expense_id IS NOT NULL);
CREATE INDEX lodging_guest_person_id_idx ON public.lodging_guest USING btree (person_id);
CREATE INDEX lodging_guest_room_id_idx ON public.lodging_guest USING btree (room_id);
CREATE INDEX lodging_room_lodging_id_idx ON public.lodging_room USING btree (lodging_id);
CREATE INDEX person_change_person_idx ON public.person_change USING btree (person_id) WHERE (status = 'pendente'::text);
CREATE INDEX push_log_dedupe ON public.push_log USING btree (account_id, tipo, ref_id, enviado_em);
CREATE INDEX reservation_expense_id_idx ON public.reservation USING btree (expense_id) WHERE (expense_id IS NOT NULL);
CREATE INDEX reservation_person_person_id_idx ON public.reservation_person USING btree (person_id);
CREATE INDEX reservation_person_reservation_id_idx ON public.reservation_person USING btree (reservation_id);
CREATE INDEX reservation_trip_id_idx ON public.reservation USING btree (trip_id);
CREATE INDEX ticket_expense_id_idx ON public.ticket USING btree (expense_id) WHERE (expense_id IS NOT NULL);
CREATE INDEX ticket_passenger_person_id_idx ON public.ticket_passenger USING btree (person_id);
CREATE INDEX ticket_passenger_ticket_id_idx ON public.ticket_passenger USING btree (ticket_id);
CREATE INDEX trip_member_convite_email_idx ON public.trip_member USING btree (lower(convite_email)) WHERE (deleted_at IS NULL);
CREATE INDEX trip_notice_person_aberto ON public.trip_notice USING btree (person_id) WHERE (resolvido_em IS NULL);
CREATE INDEX trip_notice_trip_id_idx ON public.trip_notice USING btree (trip_id);
CREATE UNIQUE INDEX document_attachment_one_primary ON public.document_attachment USING btree (document_id) WHERE (is_primary AND (deleted_at IS NULL));
CREATE UNIQUE INDEX person_item_dispensa_ativo ON public.person_item_dispensa USING btree (person_id, item) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX person_one_self ON public.person USING btree (account_id) WHERE ((kind = 'self'::text) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX share_grant_par ON public.share_grant USING btree (owner_id, grantee_id) WHERE (status = 'ativo'::text);

-- Views

-- Functions
CREATE OR REPLACE FUNCTION app_private.acct_person(_pid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.person p where p.id = _pid and p.account_id = auth.uid() and p.deleted_at is null)
$function$
;
CREATE OR REPLACE FUNCTION app_private.agent_inbox_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.account_id <> OLD.account_id OR NEW.tipo_alvo <> OLD.tipo_alvo OR NEW.payload_json <> OLD.payload_json
     OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.criado_em <> OLD.criado_em
     OR NEW.lote_id IS DISTINCT FROM OLD.lote_id OR NEW.origem_cliente IS DISTINCT FROM OLD.origem_cliente THEN
    RAISE EXCEPTION 'agent_inbox: conteúdo não pode mudar';
  END IF;
  IF OLD.status <> 'pendente' THEN
    RAISE EXCEPTION 'agent_inbox: item já resolvido';
  END IF;
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id AND NEW.trip_id IS NOT NULL AND NOT app_private.can_view_trip(NEW.trip_id) THEN
    RAISE EXCEPTION 'agent_inbox: viagem sem acesso';
  END IF;
  IF NEW.status <> 'pendente' AND NEW.resolvido_em IS NULL THEN NEW.resolvido_em := now(); END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION app_private.can_edit_item(_tipo text, _id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM app_private.item_base(_tipo, _id);
  IF b.trip_id IS NULL THEN RETURN false; END IF;
  RETURN app_private.owns_trip(b.trip_id) OR (b.criado_por = auth.uid() AND app_private.can_view_trip(b.trip_id));
END $function$
;
CREATE OR REPLACE FUNCTION app_private.can_edit_trip_path(_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _item uuid;
BEGIN
  IF split_part(_name, '/', 1) <> 'trip' OR split_part(_name, '/', 3) !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
  _item := split_part(_name, '/', 3)::uuid;
  RETURN app_private.can_edit_item('ticket', _item) OR app_private.can_edit_item('lodging', _item) OR app_private.can_edit_item('reservation', _item);
END $function$
;
CREATE OR REPLACE FUNCTION app_private.can_view(_pid uuid, _bloco text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.person p where p.id = _pid and p.account_id = auth.uid())
  or exists (
    select 1 from public.person p join public.share_grant g on g.owner_id = p.account_id
    where p.id = _pid and g.grantee_id = auth.uid() and g.status = 'ativo'
      and (g.expira_em is null or g.expira_em > now())
      and _bloco = any(g.blocos)
      and (p.kind = 'self' or (p.kind = 'dependent' and 'dependentes' = any(g.blocos)))
  )
$function$
;
CREATE OR REPLACE FUNCTION app_private.can_view_attachment(_tipo text, _item uuid, _privado boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE b record;
BEGIN
  IF NOT _privado THEN RETURN app_private.can_view_item_detail(_tipo, _item); END IF;
  SELECT * INTO b FROM app_private.item_base(_tipo, _item);
  RETURN b.trip_id IS NOT NULL AND app_private.owns_trip(b.trip_id);
END $function$
;
CREATE OR REPLACE FUNCTION app_private.can_view_file(_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid; _seg text; _tipo text; _item uuid; _priv boolean;
BEGIN
  _seg := split_part(_name, '/', 1);
  IF _seg = 'trip' THEN
    SELECT item_tipo, item_id, privado INTO _tipo, _item, _priv FROM public.item_attachment WHERE storage_path = _name AND deleted_at IS NULL ORDER BY privado DESC LIMIT 1;
    IF _item IS NULL THEN RETURN false; END IF;
    RETURN app_private.can_view_attachment(_tipo, _item, _priv);
  END IF;
  IF _seg !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
  _pid := _seg::uuid;
  IF EXISTS (SELECT 1 FROM public.document_attachment d WHERE d.person_id = _pid AND d.storage_path = _name AND d.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'documentos');
  END IF;
  IF EXISTS (SELECT 1 FROM public.traveler_document d WHERE d.person_id = _pid AND d.arquivo_path = _name AND d.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'documentos');
  END IF;
  IF EXISTS (SELECT 1 FROM public.person p WHERE p.id = _pid AND p.foto_url = _name AND p.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'basico');
  END IF;
  IF EXISTS (SELECT 1 FROM public.loyalty_account l WHERE l.person_id = _pid AND l.cartao_path = _name AND l.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'fidelidade');
  END IF;
  RETURN false;
END $function$
;
CREATE OR REPLACE FUNCTION app_private.can_view_item_detail(_tipo text, _id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM app_private.item_base(_tipo, _id);
  IF b.trip_id IS NULL THEN RETURN false; END IF;
  IF app_private.owns_trip(b.trip_id) THEN RETURN true; END IF;
  IF b.criado_por = auth.uid() AND app_private.can_view_trip(b.trip_id) THEN RETURN true; END IF;
  IF app_private.grant_trip(b.trip_id) THEN RETURN true; END IF;
  IF NOT app_private.can_view_trip(b.trip_id) THEN RETURN false; END IF;
  IF _tipo = 'ticket' THEN
    RETURN exists (select 1 from public.ticket_passenger x join public.person p on p.id = x.person_id
      where x.ticket_id = _id and x.deleted_at is null and p.account_id = auth.uid());
  ELSIF _tipo = 'lodging' THEN
    RETURN exists (select 1 from public.lodging_room r join public.lodging_guest g on g.room_id = r.id
      join public.person p on p.id = g.person_id
      where r.lodging_id = _id and r.deleted_at is null and g.deleted_at is null and p.account_id = auth.uid());
  ELSE
    RETURN exists (select 1 from public.reservation_person x join public.person p on p.id = x.person_id
      where x.reservation_id = _id and x.deleted_at is null and p.account_id = auth.uid());
  END IF;
END $function$
;
CREATE OR REPLACE FUNCTION app_private.can_view_trip(_tid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.trip t where t.id = _tid and t.owner_id = auth.uid())
  or exists (select 1 from public.trip_member m join public.person p on p.id = m.person_id
    where m.trip_id = _tid and m.status = 'aceito' and m.deleted_at is null and p.account_id = auth.uid())
  or app_private.grant_trip(_tid)
$function$
;
CREATE OR REPLACE FUNCTION app_private.doc_resolve_aviso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _campo text;
BEGIN
  BEGIN
    IF current_setting('app.teste_falha_aviso', true) = '1' THEN RAISE EXCEPTION 'falha simulada'; END IF;
    _campo := CASE WHEN NEW.tipo IN ('visto','esta','eta_canada','eta_uk','etias','k_eta','outro_visto') THEN 'visto'
                   WHEN NEW.tipo IN ('vacina','outra_vacina') THEN 'vacina' ELSE NEW.tipo END;
    UPDATE public.trip_notice SET resolvido_em = now()
      WHERE person_id = NEW.person_id AND campo = _campo AND resolvido_em IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'doc_resolve_aviso: %', SQLERRM;
  END;
  RETURN NULL;
END $function$
;
CREATE OR REPLACE FUNCTION app_private.grant_trip(_tid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.trip t join public.share_grant g on g.owner_id = t.owner_id
    where t.id = _tid and g.grantee_id = auth.uid() and g.status = 'ativo' and 'viagens' = any(g.blocos)
      and (g.trip_ids is null or t.id = any(g.trip_ids))
      and (g.expira_em is null or g.expira_em > now()))
$function$
;
CREATE OR REPLACE FUNCTION app_private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.app_admin WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')))
$function$
;
CREATE OR REPLACE FUNCTION app_private.item_base(_tipo text, _id uuid, OUT trip_id uuid, OUT criado_por uuid)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _tipo = 'ticket' THEN SELECT t.trip_id, t.criado_por INTO trip_id, criado_por FROM public.ticket t WHERE t.id = _id;
  ELSIF _tipo = 'lodging' THEN SELECT l.trip_id, l.criado_por INTO trip_id, criado_por FROM public.lodging l WHERE l.id = _id;
  ELSIF _tipo = 'reservation' THEN SELECT r.trip_id, r.criado_por INTO trip_id, criado_por FROM public.reservation r WHERE r.id = _id;
  END IF;
END $function$
;
CREATE OR REPLACE FUNCTION app_private.owns_person(_pid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.person p where p.id = _pid and p.account_id = auth.uid())
$function$
;
CREATE OR REPLACE FUNCTION app_private.owns_trip(_trip_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.trip t
    where t.id = _trip_id and t.owner_id = auth.uid()
  )
$function$
;
CREATE OR REPLACE FUNCTION app_private.push_evento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private', 'extensions'
AS $function$
DECLARE _url text; _tok text; _corpo jsonb;
BEGIN
  SELECT v INTO _url FROM app_private.cron_config WHERE k = 'app_url';
  SELECT v INTO _tok FROM app_private.cron_config WHERE k = 'status_voos';
  IF _url IS NULL OR _tok IS NULL THEN RETURN NEW; END IF;
  _corpo := CASE TG_TABLE_NAME
    WHEN 'trip_notice' THEN jsonb_build_object('tipo', 'aviso', 'id', NEW.id)
    WHEN 'agent_inbox' THEN jsonb_build_object('tipo', 'claude', 'account_id', NEW.account_id)
    WHEN 'trip_member' THEN jsonb_build_object('tipo', 'convite', 'id', NEW.id)
  END;
  PERFORM net.http_post(
    _url || '/api/public/hooks/push-evento',
    _corpo,
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || _tok, 'Content-Type', 'application/json')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END
$function$
;
CREATE OR REPLACE FUNCTION app_private.room_lodging(_room uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select lodging_id from public.lodging_room where id = _room
$function$
;
CREATE OR REPLACE FUNCTION app_private.share_grant_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.grantee_id IS DISTINCT FROM OLD.grantee_id THEN
    RAISE EXCEPTION 'owner_id/grantee_id são imutáveis';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() = OLD.owner_id THEN
    RETURN NEW;
  END IF;
  -- quem recebe só pode revogar
  IF NEW.status <> 'revogado'
     OR NEW.blocos IS DISTINCT FROM OLD.blocos
     OR NEW.trip_ids IS DISTINCT FROM OLD.trip_ids
     OR NEW.owner_nome IS DISTINCT FROM OLD.owner_nome
     OR NEW.grantee_nome IS DISTINCT FROM OLD.grantee_nome
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Quem recebe só pode revogar';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION app_private.ticket_trip(_tid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select trip_id from public.ticket where id = _tid
$function$
;
CREATE OR REPLACE FUNCTION app_private.trip_member_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR app_private.owns_trip(OLD.trip_id) OR current_setting('app.receber_convite', true) = '1' THEN RETURN NEW; END IF;
  IF NEW.trip_id <> OLD.trip_id OR NEW.person_id <> OLD.person_id OR NEW.papel <> OLD.papel
     OR NEW.convidado_por IS DISTINCT FROM OLD.convidado_por OR NEW.entrou_em <> OLD.entrou_em
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.convite_email IS DISTINCT FROM OLD.convite_email OR NEW.convite_telefone IS DISTINCT FROM OLD.convite_telefone
     OR NEW.lembrado_em IS DISTINCT FROM OLD.lembrado_em
     OR NEW.status NOT IN ('aceito','recusado','saiu') THEN
    RAISE EXCEPTION 'Só é possível responder ao convite';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION app_private.trip_member_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _dono uuid; p record;
BEGIN
  IF NEW.papel = 'owner' THEN RETURN NEW; END IF;
  SELECT owner_id INTO _dono FROM public.trip WHERE id = NEW.trip_id;
  SELECT account_id, kind INTO p FROM public.person WHERE id = NEW.person_id;
  NEW.convidado_por := coalesce(NEW.convidado_por, auth.uid(), _dono);
  IF p.kind = 'precadastro' THEN
    NEW.status := 'convidado';
  ELSIF p.account_id = _dono THEN
    NEW.status := 'aceito'; NEW.respondido_em := coalesce(NEW.respondido_em, now());
  ELSIF p.account_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.trip_trust t WHERE t.account_id = p.account_id AND t.organizer_id = _dono AND t.revogado_em IS NULL) THEN
    NEW.status := 'aceito'; NEW.respondido_em := coalesce(NEW.respondido_em, now());
  ELSE
    NEW.status := 'convidado';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION app_private.trip_owner_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid;
BEGIN
  SELECT id INTO _pid FROM public.person WHERE account_id = NEW.owner_id AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF _pid IS NOT NULL THEN
    INSERT INTO public.trip_member(trip_id, person_id, papel, status, convidado_por, respondido_em)
    VALUES (NEW.id, _pid, 'owner', 'aceito', NEW.owner_id, now());
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.autoria_item(_tipo text, _id uuid)
 RETURNS TABLE(autor text, sou_eu boolean, editar boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE b record; _uid uuid;
BEGIN
  IF NOT app_private.can_view_item_detail(_tipo, _id) THEN RETURN; END IF;
  SELECT * INTO b FROM app_private.item_base(_tipo, _id);
  _uid := coalesce(b.criado_por, (SELECT owner_id FROM public.trip WHERE id = b.trip_id));
  RETURN QUERY SELECT coalesce((SELECT coalesce(o.apelido, o.nome) FROM public.person o WHERE o.account_id = _uid AND o.kind = 'self' AND o.deleted_at IS NULL ORDER BY o.created_at LIMIT 1), 'Organizador'),
    _uid = auth.uid(), app_private.can_edit_item(_tipo, _id);
END $function$
;
CREATE OR REPLACE FUNCTION public.conferencia_nomes_voo(_ticket_id uuid)
 RETURNS TABLE(person_id uuid, estado text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _trip uuid;
BEGIN
  SELECT trip_id INTO _trip FROM public.ticket WHERE id = _ticket_id AND deleted_at IS NULL;
  IF _trip IS NULL OR NOT app_private.can_view_item_detail('ticket', _ticket_id) THEN RETURN; END IF;

  RETURN QUERY
  SELECT tp.person_id,
    CASE
      WHEN NOT (p.account_id = auth.uid() OR p.owner_id = auth.uid() OR app_private.can_view(p.id, 'documentos')) THEN 'sem_acesso'::text
      WHEN NOT EXISTS (SELECT 1 FROM public.traveler_document d WHERE d.person_id = p.id AND d.tipo = 'passaporte' AND d.deleted_at IS NULL) THEN 'sem_passaporte'::text
      WHEN p.nome_como_no_documento IS NOT NULL AND tp.nome_no_bilhete IS NOT NULL
        AND regexp_replace(upper(extensions.unaccent(p.nome_como_no_documento)), '[^A-Z ]', '', 'g') = regexp_replace(upper(extensions.unaccent(tp.nome_no_bilhete)), '[^A-Z ]', '', 'g') THEN 'confere'::text
      ELSE 'conferir'::text
    END
  FROM public.ticket_passenger tp
  JOIN public.person p ON p.id = tp.person_id
  WHERE tp.ticket_id = _ticket_id AND tp.deleted_at IS NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.conferir_viagem(_tid uuid)
 RETURNS TABLE(member_id uuid, person_id uuid, nome text, kind text, status text, papel text, acesso boolean, meu boolean, nacionalidades text[], nome_documento text, passaporte jsonb, vistos jsonb, vacina date, seguro date, nomes_bilhete text[], convite_telefone text, convite_email text, pedido_aberto boolean, avisos_abertos integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT app_private.owns_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, p.id, coalesce(p.apelido, p.nome), p.kind, m.status, m.papel, x.ok, p.account_id = auth.uid(),
    CASE WHEN x.ok THEN p.nacionalidades ELSE '{}'::text[] END,
    CASE WHEN x.ok THEN p.nome_como_no_documento END,
    CASE WHEN x.ok THEN (SELECT jsonb_build_object('validade', d.validade, 'nome', d.nome_no_documento, 'pais', d.pais_emissor)
       FROM public.traveler_document d WHERE d.person_id = p.id AND d.tipo = 'passaporte' AND d.deleted_at IS NULL ORDER BY d.validade DESC NULLS LAST LIMIT 1) END,
    CASE WHEN x.ok THEN coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', d.tipo, 'validade', d.validade)) FROM public.traveler_document d
       WHERE d.person_id = p.id AND d.deleted_at IS NULL AND d.tipo IN ('visto','esta','eta_canada','eta_uk','etias','k_eta','outro_visto')), '[]'::jsonb) ELSE '[]'::jsonb END,
    CASE WHEN x.ok THEN (SELECT max(d.validade) FROM public.traveler_document d WHERE d.person_id = p.id AND d.deleted_at IS NULL AND d.tipo IN ('vacina','outra_vacina')) END,
    CASE WHEN x.ok THEN (SELECT max(d.validade) FROM public.traveler_document d WHERE d.person_id = p.id AND d.deleted_at IS NULL AND d.tipo = 'seguro') END,
    coalesce((SELECT array_agg(DISTINCT tp.nome_no_bilhete) FROM public.ticket_passenger tp JOIN public.ticket k ON k.id = tp.ticket_id
       WHERE tp.person_id = p.id AND tp.deleted_at IS NULL AND k.trip_id = _tid AND k.deleted_at IS NULL AND tp.nome_no_bilhete IS NOT NULL), '{}'),
    m.convite_telefone, m.convite_email,
    EXISTS (SELECT 1 FROM public.share_invite i WHERE i.from_id = auth.uid() AND i.trip_id = _tid AND i.person_id = p.id AND i.usado_em IS NULL AND i.recusado_em IS NULL AND i.expira_em > now()),
    (SELECT count(*)::int FROM public.trip_notice n WHERE n.trip_id = _tid AND n.person_id = p.id AND n.resolvido_em IS NULL AND n.tipo = 'aviso')
  FROM public.trip_member m JOIN public.person p ON p.id = m.person_id
  CROSS JOIN LATERAL (SELECT (p.account_id = auth.uid() OR app_private.can_view(p.id, 'documentos')) AS ok) x
  WHERE m.trip_id = _tid AND m.deleted_at IS NULL AND p.deleted_at IS NULL
  ORDER BY m.created_at;
END $function$
;
CREATE OR REPLACE FUNCTION public.convidar_sem_conta(_trip uuid, _member uuid, _person uuid, _nome text, _email text, _telefone text, _idioma text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_trip) THEN RAISE EXCEPTION 'Só quem organiza pode convidar'; END IF;
  IF coalesce(trim(_nome), '') = '' OR (coalesce(trim(_email), '') = '' AND coalesce(trim(_telefone), '') = '') THEN RAISE EXCEPTION 'Informe nome e e-mail ou WhatsApp'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip_member WHERE id = _member) THEN RETURN _member; END IF;
  INSERT INTO public.person(id, nome, account_id, owner_id, kind, email, telefone, idioma)
  VALUES (_person, trim(_nome), auth.uid(), auth.uid(), 'precadastro', nullif(lower(trim(_email)), ''), nullif(trim(_telefone), ''), CASE WHEN _idioma = 'en' THEN 'en' ELSE 'pt' END);
  INSERT INTO public.trip_member(id, trip_id, person_id, papel, status, convidado_por, convite_email, convite_telefone, convite_idioma)
  VALUES (_member, _trip, _person, 'membro', 'convidado', auth.uid(), nullif(lower(trim(_email)), ''), nullif(trim(_telefone), ''), CASE WHEN _idioma = 'en' THEN 'en' ELSE 'pt' END);
  RETURN _member;
END $function$
;
CREATE OR REPLACE FUNCTION public.convites_recebidos()
 RETURNS TABLE(member_id uuid, trip_id uuid, person_id uuid, pessoa text, dependente boolean, viagem text, data_inicio date, data_fim date, organizador_id uuid, organizador text, voos integer, assentos text[], hoteis integer, quartos text[], trens integer, reservas jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id, t.id, p.id, coalesce(p.apelido, p.nome), p.kind = 'dependent', t.nome, t.data_inicio, t.data_fim, t.owner_id,
    coalesce((SELECT coalesce(o.apelido, o.nome) FROM public.person o WHERE o.account_id = t.owner_id AND o.kind = 'self' AND o.deleted_at IS NULL ORDER BY o.created_at LIMIT 1), 'Organizador'),
    (SELECT count(*)::int FROM public.ticket_passenger x JOIN public.ticket k ON k.id = x.ticket_id WHERE x.person_id = p.id AND x.deleted_at IS NULL AND k.trip_id = t.id AND k.deleted_at IS NULL AND k.tipo = 'voo'),
    coalesce((SELECT array_agg(DISTINCT x.assento) FROM public.ticket_passenger x JOIN public.ticket k ON k.id = x.ticket_id WHERE x.person_id = p.id AND x.deleted_at IS NULL AND k.trip_id = t.id AND k.deleted_at IS NULL AND x.assento IS NOT NULL), '{}'),
    (SELECT count(DISTINCT l.id)::int FROM public.lodging_guest g JOIN public.lodging_room r ON r.id = g.room_id JOIN public.lodging l ON l.id = r.lodging_id WHERE g.person_id = p.id AND g.deleted_at IS NULL AND r.deleted_at IS NULL AND l.trip_id = t.id AND l.deleted_at IS NULL),
    coalesce((SELECT array_agg(DISTINCT r.nome) FROM public.lodging_guest g JOIN public.lodging_room r ON r.id = g.room_id JOIN public.lodging l ON l.id = r.lodging_id WHERE g.person_id = p.id AND g.deleted_at IS NULL AND r.deleted_at IS NULL AND l.trip_id = t.id AND l.deleted_at IS NULL), '{}'),
    (SELECT count(*)::int FROM public.ticket_passenger x JOIN public.ticket k ON k.id = x.ticket_id WHERE x.person_id = p.id AND x.deleted_at IS NULL AND k.trip_id = t.id AND k.deleted_at IS NULL AND k.tipo <> 'voo'),
    coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', v.tipo, 'papel', x.papel)) FROM public.reservation_person x JOIN public.reservation v ON v.id = x.reservation_id WHERE x.person_id = p.id AND x.deleted_at IS NULL AND v.trip_id = t.id AND v.deleted_at IS NULL), '[]'::jsonb)
  FROM public.trip_member m JOIN public.person p ON p.id = m.person_id JOIN public.trip t ON t.id = m.trip_id
  WHERE m.status = 'convidado' AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL
    AND p.account_id = auth.uid() AND p.kind <> 'precadastro' AND t.owner_id <> auth.uid()
  ORDER BY t.data_inicio;
$function$
;
CREATE OR REPLACE FUNCTION public.duplicar_viagem(_origem uuid, _novo uuid, _nome text, _cidades text[], _inicio date, _fim date, _moeda text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o record; r record; _rid uuid; _delta interval;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_origem) THEN RAISE EXCEPTION 'Só quem organiza pode duplicar'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip WHERE id = _novo) THEN RETURN _novo; END IF;
  SELECT * INTO o FROM public.trip WHERE id = _origem AND deleted_at IS NULL;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Viagem de origem não encontrada'; END IF;
  _delta := (_inicio - o.data_inicio) * interval '1 day';
  INSERT INTO public.trip(id, owner_id, nome, destino, cidades, data_inicio, data_fim, moeda_base, status)
  VALUES (_novo, auth.uid(), _nome, array_to_string(_cidades, ', '), coalesce(_cidades, '{}'), _inicio, _fim, _moeda, 'planejada');
  INSERT INTO public.trip_member(trip_id, person_id, papel, status, convidado_por, convite_email, convite_telefone, convite_idioma)
  SELECT _novo, m.person_id, m.papel, 'convidado', auth.uid(), m.convite_email, m.convite_telefone, m.convite_idioma
  FROM public.trip_member m WHERE m.trip_id = _origem AND m.deleted_at IS NULL AND m.papel <> 'owner' AND m.status <> 'recusado'
  ON CONFLICT (trip_id, person_id) DO NOTHING;
  FOR r IN SELECT * FROM public.reservation WHERE trip_id = _origem AND deleted_at IS NULL LOOP
    _rid := gen_random_uuid();
    INSERT INTO public.reservation(id, trip_id, tipo, titulo, inicio_utc, inicio_tz, fim_utc, fim_tz, local, cidade, lat, lng, localizador, valor, moeda, criado_por, origem)
    VALUES (_rid, _novo, r.tipo, r.titulo, r.inicio_utc + _delta, r.inicio_tz, r.fim_utc + _delta, r.fim_tz, r.local, r.cidade, r.lat, r.lng, r.localizador, r.valor, r.moeda, auth.uid(), r.origem);
    INSERT INTO public.reservation_person(reservation_id, person_id, papel)
    SELECT _rid, x.person_id, x.papel FROM public.reservation_person x WHERE x.reservation_id = r.id AND x.deleted_at IS NULL;
  END LOOP;
  RETURN _novo;
END $function$
;
CREATE OR REPLACE FUNCTION public.membros_viagem(_tid uuid)
 RETURNS TABLE(id uuid, person_id uuid, papel text, status text, nome text, apelido text, nome_como_no_documento text, kind text, meu boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT app_private.can_view_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, m.person_id, m.papel, m.status, p.nome, p.apelido, p.nome_como_no_documento, p.kind, (p.account_id = auth.uid())
  FROM public.trip_member m JOIN public.person p ON p.id = m.person_id
  WHERE m.trip_id = _tid AND m.deleted_at IS NULL
  ORDER BY (m.papel = 'owner') DESC, m.created_at;
END $function$
;
CREATE OR REPLACE FUNCTION public.pedidos_recebidos()
 RETURNS TABLE(id uuid, from_id uuid, from_nome text, blocos text[], trip_id uuid, viagem text, ate timestamp with time zone, pessoa text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.id, i.from_id, i.from_nome, i.blocos, i.trip_id, t.nome, i.grant_expira_em, coalesce(p.apelido, p.nome)
  FROM public.share_invite i LEFT JOIN public.trip t ON t.id = i.trip_id LEFT JOIN public.person p ON p.id = i.person_id
  WHERE i.para_account = auth.uid() AND i.direcao = 'pedido' AND i.usado_em IS NULL AND i.recusado_em IS NULL AND i.expira_em > now()
  ORDER BY i.created_at DESC;
$function$
;
CREATE OR REPLACE FUNCTION public.pedir_dados(_id uuid, _trip uuid, _person uuid, _blocos text[], _ate_fim boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record; t record; _nome text;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_trip) THEN RAISE EXCEPTION 'Só quem organiza pode pedir'; END IF;
  IF EXISTS (SELECT 1 FROM public.share_invite WHERE id = _id) THEN RETURN _id; END IF;
  SELECT * INTO p FROM public.person WHERE id = _person AND deleted_at IS NULL;
  IF p.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.trip_member WHERE trip_id = _trip AND person_id = _person AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Pessoa fora da viagem'; END IF;
  IF p.kind = 'precadastro' OR p.account_id = auth.uid() THEN RAISE EXCEPTION 'Pessoa sem conta própria'; END IF;
  SELECT * INTO t FROM public.trip WHERE id = _trip;
  SELECT coalesce(apelido, nome) INTO _nome FROM public.person WHERE account_id = auth.uid() AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  INSERT INTO public.share_invite(id, from_id, from_nome, direcao, blocos, person_id, token_hash, expira_em, trip_id, para_account, grant_expira_em)
  VALUES (_id, auth.uid(), coalesce(_nome, 'Organizador'), 'pedido',
    CASE WHEN p.kind = 'dependent' AND NOT 'dependentes' = ANY(_blocos) THEN _blocos || 'dependentes'::text ELSE _blocos END,
    _person, encode(extensions.gen_random_bytes(32), 'hex'), greatest(now() + interval '30 days', (t.data_fim + 1)::timestamptz), _trip, p.account_id,
    CASE WHEN _ate_fim THEN (t.data_fim + 1)::timestamptz END);
  RETURN _id;
END $function$
;
CREATE OR REPLACE FUNCTION public.pontos_viagem(_tid uuid)
 RETURNS TABLE(item_tipo text, item_id uuid, titulo text, inicio_utc timestamp with time zone, tz text, lat double precision, lng double precision, place_id text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT app_private.can_view_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT 'lodging'::text, l.id, l.nome, l.checkin, coalesce(l.tz,'UTC'), l.lat::double precision, l.lng::double precision, l.place_id
  FROM public.lodging l WHERE l.trip_id = _tid AND l.deleted_at IS NULL AND (l.lat IS NOT NULL OR l.place_id IS NOT NULL)
    AND app_private.can_view_item_detail('lodging', l.id)
  UNION ALL
  SELECT 'reservation'::text, r.id, r.titulo, r.inicio_utc, r.inicio_tz, r.lat::double precision, r.lng::double precision, r.place_id
  FROM public.reservation r WHERE r.trip_id = _tid AND r.deleted_at IS NULL AND (r.lat IS NOT NULL OR r.place_id IS NOT NULL)
    AND app_private.can_view_item_detail('reservation', r.id);
END $function$
;
CREATE OR REPLACE FUNCTION public.receber_convites_por_email()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _email text; _eu uuid; m record; n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  SELECT id INTO _eu FROM public.person WHERE account_id = auth.uid() AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF _email IS NULL OR _eu IS NULL THEN RETURN 0; END IF;
  PERFORM set_config('app.receber_convite', '1', true);
  FOR m IN SELECT tm.* FROM public.trip_member tm JOIN public.person p ON p.id = tm.person_id
    WHERE lower(tm.convite_email) = _email AND tm.deleted_at IS NULL AND p.kind = 'precadastro' AND p.account_id <> auth.uid() LOOP
    IF NOT EXISTS (SELECT 1 FROM public.trip_member WHERE trip_id = m.trip_id AND person_id = _eu) THEN
      INSERT INTO public.trip_member(trip_id, person_id, papel, status, convidado_por, convite_email, convite_idioma)
      VALUES (m.trip_id, _eu, 'membro', 'convidado', m.convidado_por, m.convite_email, m.convite_idioma);
    END IF;
    UPDATE public.ticket_passenger SET person_id = _eu WHERE person_id = m.person_id AND ticket_id IN (SELECT id FROM public.ticket WHERE trip_id = m.trip_id);
    UPDATE public.lodging_guest SET person_id = _eu WHERE person_id = m.person_id AND room_id IN (SELECT r.id FROM public.lodging_room r JOIN public.lodging l ON l.id = r.lodging_id WHERE l.trip_id = m.trip_id);
    UPDATE public.reservation_person SET person_id = _eu WHERE person_id = m.person_id AND reservation_id IN (SELECT id FROM public.reservation WHERE trip_id = m.trip_id);
    UPDATE public.trip_member SET deleted_at = now() WHERE id = m.id;
    n := n + 1;
  END LOOP;
  PERFORM set_config('app.receber_convite', '0', true);
  RETURN n;
END $function$
;
CREATE OR REPLACE FUNCTION public.responder_pedido(_id uuid, _blocos text[], _aceitar boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE i record; _nome text; _trips uuid[];
BEGIN
  SELECT * INTO i FROM public.share_invite WHERE id = _id AND para_account = auth.uid() AND direcao = 'pedido';
  IF i.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF i.usado_em IS NOT NULL OR i.recusado_em IS NOT NULL THEN RETURN true; END IF;
  IF NOT _aceitar OR coalesce(array_length(_blocos, 1), 0) = 0 THEN
    UPDATE public.share_invite SET recusado_em = now() WHERE id = _id; RETURN true;
  END IF;
  SELECT coalesce(apelido, nome) INTO _nome FROM public.person WHERE account_id = auth.uid() AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF 'viagens' = ANY(_blocos) THEN
    SELECT coalesce(array_agg(id), '{}') INTO _trips FROM public.trip WHERE owner_id = auth.uid() AND id = i.trip_id;
  END IF;
  UPDATE public.share_grant SET status = 'revogado', revogado_em = now() WHERE owner_id = auth.uid() AND grantee_id = i.from_id AND status = 'ativo';
  INSERT INTO public.share_grant(owner_id, grantee_id, owner_nome, grantee_nome, blocos, trip_ids, trip_id, expira_em)
  VALUES (auth.uid(), i.from_id, coalesce(_nome, 'Participante'), i.from_nome, _blocos, _trips, i.trip_id, i.grant_expira_em);
  UPDATE public.share_invite SET usado_em = now(), usado_por = auth.uid() WHERE id = _id;
  RETURN true;
END $function$
;
CREATE OR REPLACE FUNCTION public.roteiro_viagem(_tid uuid)
 RETURNS TABLE(item_tipo text, item_id uuid, subtipo text, titulo text, inicio_utc timestamp with time zone, inicio_tz text, fim_utc timestamp with time zone, fim_tz text, cidade text, origem_iata text, destino_iata text, companhia text, numero text, pessoas jsonb, detalhe boolean, editar boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT app_private.can_view_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT 'ticket'::text, t.id, t.tipo, coalesce(t.origem_iata::text, t.origem_cidade, '?') || ' → ' || coalesce(t.destino_iata::text, t.destino_cidade, '?'),
    t.partida_utc, t.partida_tz, t.chegada_utc, t.chegada_tz, t.destino_cidade, t.origem_iata::text, t.destino_iata::text, t.companhia, t.numero,
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(p.apelido, p.nome))) from public.ticket_passenger x join public.person p on p.id = x.person_id where x.ticket_id = t.id and x.deleted_at is null), '[]'::jsonb),
    app_private.can_view_item_detail('ticket', t.id), app_private.can_edit_item('ticket', t.id)
  FROM public.ticket t WHERE t.trip_id = _tid AND t.deleted_at IS NULL
  UNION ALL
  SELECT 'lodging'::text, l.id, 'hotel'::text, l.nome, l.checkin, 'UTC'::text, l.checkout, 'UTC'::text, l.cidade, null::text, null::text, null::text, null::text,
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(p.apelido, p.nome))) from public.lodging_room r join public.lodging_guest g on g.room_id = r.id join public.person p on p.id = g.person_id where r.lodging_id = l.id and r.deleted_at is null and g.deleted_at is null), '[]'::jsonb),
    app_private.can_view_item_detail('lodging', l.id), app_private.can_edit_item('lodging', l.id)
  FROM public.lodging l WHERE l.trip_id = _tid AND l.deleted_at IS NULL
  UNION ALL
  SELECT 'reservation'::text, r.id, r.tipo, r.titulo, r.inicio_utc, r.inicio_tz, r.fim_utc, r.fim_tz, r.cidade, null::text, null::text, null::text, null::text,
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(p.apelido, p.nome), 'papel', x.papel)) from public.reservation_person x join public.person p on p.id = x.person_id where x.reservation_id = r.id and x.deleted_at is null), '[]'::jsonb),
    app_private.can_view_item_detail('reservation', r.id), app_private.can_edit_item('reservation', r.id)
  FROM public.reservation r WHERE r.trip_id = _tid AND r.deleted_at IS NULL;
END $function$
;
CREATE OR REPLACE FUNCTION public.somar_uso_api(_mes text, _n integer)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.api_usage(mes, unidades) VALUES (_mes, _n)
  ON CONFLICT (mes) DO UPDATE SET unidades = public.api_usage.unidades + EXCLUDED.unidades
  RETURNING unidades;
$function$
;
CREATE OR REPLACE FUNCTION public.telefones_viagem(_tid uuid)
 RETURNS TABLE(person_id uuid, telefone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT app_private.owns_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.telefone FROM public.trip_member m JOIN public.person p ON p.id = m.person_id
  WHERE m.trip_id = _tid AND m.deleted_at IS NULL AND p.deleted_at IS NULL AND p.telefone IS NOT NULL
    AND p.kind <> 'precadastro'
    AND (p.account_id = auth.uid() OR p.owner_id = auth.uid() OR app_private.can_view(p.id, 'basico'));
END $function$
;
CREATE OR REPLACE FUNCTION public.verificar_cron_voos(_t text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM app_private.cron_config WHERE k = 'status_voos' AND v = _t);
$function$
;

-- Triggers (public/app_private)
CREATE TRIGGER agent_inbox_guard BEFORE UPDATE ON public.agent_inbox FOR EACH ROW EXECUTE FUNCTION app_private.agent_inbox_guard();
CREATE TRIGGER doc_resolve_aviso AFTER INSERT OR UPDATE ON public.traveler_document FOR EACH ROW WHEN ((new.deleted_at IS NULL)) EXECUTE FUNCTION app_private.doc_resolve_aviso();
CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();
CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');
CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();
CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');
CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER push_aviso_organizador AFTER INSERT ON public.trip_notice FOR EACH ROW WHEN (((new.tipo = 'aviso'::text) AND (new.person_id IS NOT NULL))) EXECUTE FUNCTION app_private.push_evento();
CREATE TRIGGER push_caixa_claude AFTER INSERT ON public.agent_inbox FOR EACH ROW WHEN ((new.status = 'pendente'::text)) EXECUTE FUNCTION app_private.push_evento();
CREATE TRIGGER push_convite_viagem AFTER INSERT ON public.trip_member FOR EACH ROW WHEN ((new.status = 'convidado'::text)) EXECUTE FUNCTION app_private.push_evento();
CREATE TRIGGER share_grant_guard BEFORE UPDATE ON public.share_grant FOR EACH ROW EXECUTE FUNCTION app_private.share_grant_guard();
CREATE TRIGGER trip_member_guard BEFORE UPDATE ON public.trip_member FOR EACH ROW EXECUTE FUNCTION app_private.trip_member_guard();
CREATE TRIGGER trip_member_status BEFORE INSERT ON public.trip_member FOR EACH ROW EXECUTE FUNCTION app_private.trip_member_status();
CREATE TRIGGER trip_owner_member AFTER INSERT ON public.trip FOR EACH ROW EXECUTE FUNCTION app_private.trip_owner_member();
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

-- RLS
ALTER TABLE public.agent_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_alerta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastro_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consistency_finding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lodging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lodging_guest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lodging_room ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_change ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_item_dispensa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_section_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_device ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_pref ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_person ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_passenger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traveler_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_notice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_meta ENABLE ROW LEVEL SECURITY;

-- Policies (public, app_private, storage.objects)
CREATE POLICY agent_inbox_ins ON public.agent_inbox AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((account_id = auth.uid()) AND (status = 'pendente'::text) AND ((trip_id IS NULL) OR app_private.can_view_trip(trip_id))));
CREATE POLICY agent_inbox_read ON public.agent_inbox AS PERMISSIVE FOR SELECT TO authenticated USING ((account_id = auth.uid()));
CREATE POLICY agent_inbox_upd ON public.agent_inbox AS PERMISSIVE FOR UPDATE TO authenticated USING ((account_id = auth.uid())) WITH CHECK ((account_id = auth.uid()));
CREATE POLICY api_alerta_owner ON public.api_alerta AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM trip t
  WHERE ((t.id = api_alerta.trip_id) AND (t.owner_id = auth.uid())))));
CREATE POLICY app_admin_delete ON public.app_admin AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.is_admin());
CREATE POLICY app_admin_insert ON public.app_admin AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (app_private.is_admin());
CREATE POLICY app_admin_read ON public.app_admin AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.is_admin());
CREATE POLICY link_own ON public.cadastro_link AS PERMISSIVE FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY finding_own ON public.consistency_finding AS PERMISSIVE FOR ALL TO authenticated USING (app_private.owns_trip(trip_id)) WITH CHECK (app_private.owns_trip(trip_id));
CREATE POLICY document_attachment_delete ON public.document_attachment AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.owns_person(person_id));
CREATE POLICY document_attachment_insert ON public.document_attachment AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((app_private.owns_person(person_id) AND (EXISTS ( SELECT 1
   FROM traveler_document d
  WHERE ((d.id = document_attachment.document_id) AND (d.person_id = document_attachment.person_id))))));
CREATE POLICY document_attachment_read ON public.document_attachment AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view(person_id, 'documentos'::text));
CREATE POLICY document_attachment_update ON public.document_attachment AS PERMISSIVE FOR UPDATE TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK ((app_private.owns_person(person_id) AND (EXISTS ( SELECT 1
   FROM traveler_document d
  WHERE ((d.id = document_attachment.document_id) AND (d.person_id = document_attachment.person_id))))));
CREATE POLICY entry_rule_read ON public.entry_rule AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY expense_read ON public.expense AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view_trip(trip_id));
CREATE POLICY expense_write ON public.expense AS PERMISSIVE FOR ALL TO authenticated USING (app_private.owns_trip(trip_id)) WITH CHECK (app_private.owns_trip(trip_id));
CREATE POLICY flight_status_read ON public.flight_status AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view_trip(app_private.ticket_trip(ticket_id)));
CREATE POLICY ia_del ON public.item_attachment AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.can_edit_item(item_tipo, item_id));
CREATE POLICY ia_ins ON public.item_attachment AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item(item_tipo, item_id));
CREATE POLICY ia_read ON public.item_attachment AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view_attachment(item_tipo, item_id, privado));
CREATE POLICY ia_upd ON public.item_attachment AS PERMISSIVE FOR UPDATE TO authenticated USING (app_private.can_edit_item(item_tipo, item_id)) WITH CHECK (app_private.can_edit_item(item_tipo, item_id));
CREATE POLICY lodging_del ON public.lodging AS PERMISSIVE FOR DELETE TO authenticated USING ((app_private.owns_trip(trip_id) OR (criado_por = auth.uid())));
CREATE POLICY lodging_ins ON public.lodging AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((app_private.can_view_trip(trip_id) AND ((criado_por = auth.uid()) OR app_private.owns_trip(trip_id))));
CREATE POLICY lodging_read ON public.lodging AS PERMISSIVE FOR SELECT TO authenticated USING ((app_private.owns_trip(trip_id) OR ((criado_por = auth.uid()) AND app_private.can_view_trip(trip_id)) OR app_private.can_view_item_detail('lodging'::text, id)));
CREATE POLICY lodging_upd ON public.lodging AS PERMISSIVE FOR UPDATE TO authenticated USING ((app_private.owns_trip(trip_id) OR (criado_por = auth.uid()))) WITH CHECK ((app_private.can_view_trip(trip_id) AND (app_private.owns_trip(trip_id) OR (criado_por = auth.uid()))));
CREATE POLICY lg_del ON public.lodging_guest AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.can_edit_item('lodging'::text, app_private.room_lodging(room_id)));
CREATE POLICY lg_ins ON public.lodging_guest AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item('lodging'::text, app_private.room_lodging(room_id)));
CREATE POLICY lg_read ON public.lodging_guest AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view_item_detail('lodging'::text, app_private.room_lodging(room_id)));
CREATE POLICY lg_upd ON public.lodging_guest AS PERMISSIVE FOR UPDATE TO authenticated USING (app_private.can_edit_item('lodging'::text, app_private.room_lodging(room_id))) WITH CHECK (app_private.can_edit_item('lodging'::text, app_private.room_lodging(room_id)));
CREATE POLICY lr_del ON public.lodging_room AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.can_edit_item('lodging'::text, lodging_id));
CREATE POLICY lr_ins ON public.lodging_room AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item('lodging'::text, lodging_id));
CREATE POLICY lr_read ON public.lodging_room AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view_item_detail('lodging'::text, lodging_id));
CREATE POLICY lr_upd ON public.lodging_room AS PERMISSIVE FOR UPDATE TO authenticated USING (app_private.can_edit_item('lodging'::text, lodging_id)) WITH CHECK (app_private.can_edit_item('lodging'::text, lodging_id));
CREATE POLICY loy_read ON public.loyalty_account AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view(person_id, 'fidelidade'::text));
CREATE POLICY loy_write ON public.loyalty_account AS PERMISSIVE FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY person_del ON public.person AS PERMISSIVE FOR DELETE TO authenticated USING ((account_id = auth.uid()));
CREATE POLICY person_ins ON public.person AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((account_id = auth.uid()));
CREATE POLICY person_read ON public.person AS PERMISSIVE FOR SELECT TO authenticated USING (((account_id = auth.uid()) OR app_private.can_view(id, 'basico'::text)));
CREATE POLICY person_upd ON public.person AS PERMISSIVE FOR UPDATE TO authenticated USING ((account_id = auth.uid())) WITH CHECK ((account_id = auth.uid()));
CREATE POLICY change_own ON public.person_change AS PERMISSIVE FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY pid_del ON public.person_item_dispensa AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.owns_person(person_id));
CREATE POLICY pid_ins ON public.person_item_dispensa AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY pid_sel ON public.person_item_dispensa AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.owns_person(person_id));
CREATE POLICY pid_upd ON public.person_item_dispensa AS PERMISSIVE FOR UPDATE TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY pref_read ON public.person_preferences AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view(person_id, 'preferencias'::text));
CREATE POLICY pref_write ON public.person_preferences AS PERMISSIVE FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY review_own ON public.person_section_review AS PERMISSIVE FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY push_device_dono ON public.push_device AS PERMISSIVE FOR ALL TO authenticated USING ((account_id = auth.uid())) WITH CHECK ((account_id = auth.uid()));
CREATE POLICY push_log_leitura_dono ON public.push_log AS PERMISSIVE FOR SELECT TO authenticated USING ((account_id = auth.uid()));
CREATE POLICY push_pref_dono ON public.push_pref AS PERMISSIVE FOR ALL TO authenticated USING ((account_id = auth.uid())) WITH CHECK ((account_id = auth.uid()));
CREATE POLICY reservation_del ON public.reservation AS PERMISSIVE FOR DELETE TO authenticated USING ((app_private.owns_trip(trip_id) OR (criado_por = auth.uid())));
CREATE POLICY reservation_ins ON public.reservation AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((app_private.can_view_trip(trip_id) AND ((criado_por = auth.uid()) OR app_private.owns_trip(trip_id))));
CREATE POLICY reservation_read ON public.reservation AS PERMISSIVE FOR SELECT TO authenticated USING ((app_private.owns_trip(trip_id) OR ((criado_por = auth.uid()) AND app_private.can_view_trip(trip_id)) OR app_private.can_view_item_detail('reservation'::text, id)));
CREATE POLICY reservation_upd ON public.reservation AS PERMISSIVE FOR UPDATE TO authenticated USING ((app_private.owns_trip(trip_id) OR (criado_por = auth.uid()))) WITH CHECK ((app_private.can_view_trip(trip_id) AND (app_private.owns_trip(trip_id) OR (criado_por = auth.uid()))));
CREATE POLICY rp_del ON public.reservation_person AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.can_edit_item('reservation'::text, reservation_id));
CREATE POLICY rp_ins ON public.reservation_person AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item('reservation'::text, reservation_id));
CREATE POLICY rp_read ON public.reservation_person AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view_item_detail('reservation'::text, reservation_id));
CREATE POLICY rp_upd ON public.reservation_person AS PERMISSIVE FOR UPDATE TO authenticated USING (app_private.can_edit_item('reservation'::text, reservation_id)) WITH CHECK (app_private.can_edit_item('reservation'::text, reservation_id));
CREATE POLICY share_grant_grantee_revoke ON public.share_grant AS PERMISSIVE FOR UPDATE TO authenticated USING ((grantee_id = auth.uid())) WITH CHECK (((grantee_id = auth.uid()) AND (status = 'revogado'::text)));
CREATE POLICY share_grant_owner_upd ON public.share_grant AS PERMISSIVE FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY share_grant_read ON public.share_grant AS PERMISSIVE FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR (grantee_id = auth.uid())));
CREATE POLICY share_invite_del ON public.share_invite AS PERMISSIVE FOR DELETE TO authenticated USING ((from_id = auth.uid()));
CREATE POLICY share_invite_own ON public.share_invite AS PERMISSIVE FOR SELECT TO authenticated USING ((from_id = auth.uid()));
CREATE POLICY ticket_del ON public.ticket AS PERMISSIVE FOR DELETE TO authenticated USING ((app_private.owns_trip(trip_id) OR (criado_por = auth.uid())));
CREATE POLICY ticket_ins ON public.ticket AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((app_private.can_view_trip(trip_id) AND ((criado_por = auth.uid()) OR app_private.owns_trip(trip_id))));
CREATE POLICY ticket_read ON public.ticket AS PERMISSIVE FOR SELECT TO authenticated USING ((app_private.owns_trip(trip_id) OR ((criado_por = auth.uid()) AND app_private.can_view_trip(trip_id)) OR app_private.can_view_item_detail('ticket'::text, id)));
CREATE POLICY ticket_upd ON public.ticket AS PERMISSIVE FOR UPDATE TO authenticated USING ((app_private.owns_trip(trip_id) OR (criado_por = auth.uid()))) WITH CHECK ((app_private.can_view_trip(trip_id) AND (app_private.owns_trip(trip_id) OR (criado_por = auth.uid()))));
CREATE POLICY tp_del ON public.ticket_passenger AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.can_edit_item('ticket'::text, ticket_id));
CREATE POLICY tp_ins ON public.ticket_passenger AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item('ticket'::text, ticket_id));
CREATE POLICY tp_read ON public.ticket_passenger AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view_item_detail('ticket'::text, ticket_id));
CREATE POLICY tp_upd ON public.ticket_passenger AS PERMISSIVE FOR UPDATE TO authenticated USING (app_private.can_edit_item('ticket'::text, ticket_id)) WITH CHECK (app_private.can_edit_item('ticket'::text, ticket_id));
CREATE POLICY doc_read ON public.traveler_document AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view(person_id, 'documentos'::text));
CREATE POLICY doc_write ON public.traveler_document AS PERMISSIVE FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY trip_read ON public.trip AS PERMISSIVE FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR app_private.can_view_trip(id)));
CREATE POLICY trip_write ON public.trip AS PERMISSIVE FOR ALL TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY trip_member_del ON public.trip_member AS PERMISSIVE FOR DELETE TO authenticated USING (app_private.owns_trip(trip_id));
CREATE POLICY trip_member_ins ON public.trip_member AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (app_private.owns_trip(trip_id));
CREATE POLICY trip_member_read ON public.trip_member AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.can_view_trip(trip_id));
CREATE POLICY trip_member_self_read ON public.trip_member AS PERMISSIVE FOR SELECT TO authenticated USING (app_private.acct_person(person_id));
CREATE POLICY trip_member_upd ON public.trip_member AS PERMISSIVE FOR UPDATE TO authenticated USING ((app_private.owns_trip(trip_id) OR app_private.acct_person(person_id))) WITH CHECK ((app_private.owns_trip(trip_id) OR app_private.acct_person(person_id)));
CREATE POLICY notice_ins ON public.trip_notice AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((app_private.owns_trip(trip_id) AND (enviado_por = auth.uid())));
CREATE POLICY notice_pedido_ins ON public.trip_notice AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tipo = 'pedido_correcao'::text) AND (enviado_por = auth.uid()) AND (person_id IS NOT NULL) AND app_private.acct_person(person_id) AND app_private.can_view_trip(trip_id)));
CREATE POLICY notice_read ON public.trip_notice AS PERMISSIVE FOR SELECT TO authenticated USING ((app_private.owns_trip(trip_id) OR ((person_id IS NOT NULL) AND app_private.acct_person(person_id))));
CREATE POLICY notice_upd ON public.trip_notice AS PERMISSIVE FOR UPDATE TO authenticated USING ((app_private.owns_trip(trip_id) OR ((person_id IS NOT NULL) AND app_private.acct_person(person_id)))) WITH CHECK ((app_private.owns_trip(trip_id) OR ((person_id IS NOT NULL) AND app_private.acct_person(person_id))));
CREATE POLICY trust_organizer_read ON public.trip_trust AS PERMISSIVE FOR SELECT TO authenticated USING ((organizer_id = auth.uid()));
CREATE POLICY trust_own ON public.trip_trust AS PERMISSIVE FOR ALL TO authenticated USING ((account_id = auth.uid())) WITH CHECK ((account_id = auth.uid()));
CREATE POLICY vault_item_owner_delete ON public.vault_item AS PERMISSIVE FOR DELETE TO authenticated USING ((account_id = auth.uid()));
CREATE POLICY vault_item_owner_insert ON public.vault_item AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((account_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (loyalty_account l
     JOIN person p ON ((p.id = l.person_id)))
  WHERE ((l.id = vault_item.loyalty_account_id) AND (p.account_id = auth.uid()))))));
CREATE POLICY vault_item_owner_select ON public.vault_item AS PERMISSIVE FOR SELECT TO authenticated USING ((account_id = auth.uid()));
CREATE POLICY vault_item_owner_update ON public.vault_item AS PERMISSIVE FOR UPDATE TO authenticated USING ((account_id = auth.uid())) WITH CHECK (((account_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (loyalty_account l
     JOIN person p ON ((p.id = l.person_id)))
  WHERE ((l.id = vault_item.loyalty_account_id) AND (p.account_id = auth.uid()))))));
CREATE POLICY vault_meta_owner_delete ON public.vault_meta AS PERMISSIVE FOR DELETE TO authenticated USING ((account_id = auth.uid()));
CREATE POLICY vault_meta_owner_insert ON public.vault_meta AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((account_id = auth.uid()));
CREATE POLICY vault_meta_owner_select ON public.vault_meta AS PERMISSIVE FOR SELECT TO authenticated USING ((account_id = auth.uid()));
CREATE POLICY vault_meta_owner_update ON public.vault_meta AS PERMISSIVE FOR UPDATE TO authenticated USING ((account_id = auth.uid())) WITH CHECK ((account_id = auth.uid()));
CREATE POLICY documentos_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'documentos'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'::text) AND app_private.owns_person(((storage.foldername(name))[1])::uuid)));
CREATE POLICY documentos_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'documentos'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'::text) AND app_private.owns_person(((storage.foldername(name))[1])::uuid)));
CREATE POLICY documentos_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'documentos'::text) AND app_private.can_view_file(name)));
CREATE POLICY documentos_trip_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'documentos'::text) AND app_private.can_edit_trip_path(name)));
CREATE POLICY documentos_trip_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'documentos'::text) AND app_private.can_edit_trip_path(name)));

-- Grants (tables)
-- Grants (functions)

-- Storage buckets (definitions only, no objects)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('documentos', 'documentos', f, 10485760, NULL) ON CONFLICT (id) DO NOTHING;

-- pg_cron jobs (secrets are read at runtime from app_private.cron_config, which is NOT exported; URL replaced)
-- SELECT cron.schedule('status-voos-15min', '*/15 * * * *', $$
--   select net.http_post(url := '<APP_URL>/api/public/hooks/status-voos',
--     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select v from app_private.cron_config where k='status_voos')),
--     body := '{}'::jsonb); $$);
-- SELECT cron.schedule('avisos-diarios', '0 11 * * *', $$
--   SELECT net.http_post((SELECT v FROM app_private.cron_config WHERE k = 'app_url') || '/api/public/hooks/avisos-diarios', '{}'::jsonb, '{}'::jsonb,
--     jsonb_build_object('Authorization', 'Bearer ' || (SELECT v FROM app_private.cron_config WHERE k = 'status_voos'), 'Content-Type', 'application/json')); $$);
-- Required config rows (fill yourself): app_private.cron_config (k='status_voos', v='<CRON_TOKEN>'), (k='app_url', v='<APP_URL>')
