
CREATE TABLE public.person (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  owner_id uuid NOT NULL,
  nome text NOT NULL,
  nome_como_no_documento text,
  nacionalidades text[] NOT NULL DEFAULT '{}',
  data_nascimento date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person TO authenticated;
GRANT ALL ON public.person TO service_role;
ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;
CREATE POLICY "person_own" ON public.person FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.traveler_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  tipo text NOT NULL,
  numero text,
  pais_emissor text,
  validade date NULL,
  anexo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traveler_document TO authenticated;
GRANT ALL ON public.traveler_document TO service_role;
ALTER TABLE public.traveler_document ENABLE ROW LEVEL SECURITY;
CREATE POLICY "traveler_document_own" ON public.traveler_document FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.loyalty_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  programa text NOT NULL,
  numero text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_account TO authenticated;
GRANT ALL ON public.loyalty_account TO service_role;
ALTER TABLE public.loyalty_account ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_account_own" ON public.loyalty_account FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.trip (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  nome text NOT NULL,
  destino text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  moeda_base char(3) NOT NULL,
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','andamento','encerrada')),
  capa_url text NULL,
  arquivada_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CHECK (data_fim >= data_inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip TO authenticated;
GRANT ALL ON public.trip TO service_role;
ALTER TABLE public.trip ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_own" ON public.trip FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.owns_trip(_trip_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trip t WHERE t.id = _trip_id AND t.owner_id = auth.uid())
$$;

CREATE TABLE public.trip_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person(id),
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('owner','membro','convidado')),
  entrou_em date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  UNIQUE (trip_id, person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_member TO authenticated;
GRANT ALL ON public.trip_member TO service_role;
ALTER TABLE public.trip_member ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_member_own" ON public.trip_member FOR ALL TO authenticated USING (public.owns_trip(trip_id)) WITH CHECK (public.owns_trip(trip_id));

CREATE TABLE public.ticket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('voo','trem','onibus','carro','transfer')),
  companhia text,
  numero text,
  localizador text,
  origem_iata char(3) NULL,
  destino_iata char(3) NULL,
  origem_cidade text,
  destino_cidade text,
  partida_utc timestamptz NOT NULL,
  partida_tz text NOT NULL,
  chegada_utc timestamptz NOT NULL,
  chegada_tz text NOT NULL,
  assento text,
  nome_no_bilhete text,
  anexo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket TO authenticated;
GRANT ALL ON public.ticket TO service_role;
ALTER TABLE public.ticket ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_own" ON public.ticket FOR ALL TO authenticated USING (public.owns_trip(trip_id)) WITH CHECK (public.owns_trip(trip_id));

CREATE TABLE public.lodging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  nome text NOT NULL,
  endereco text,
  cidade text,
  lat double precision NULL,
  lng double precision NULL,
  checkin timestamptz NOT NULL,
  checkout timestamptz NOT NULL,
  localizador text,
  valor numeric(12,2),
  moeda char(3),
  politica_cancelamento text,
  anexo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CHECK (checkout > checkin)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lodging TO authenticated;
GRANT ALL ON public.lodging TO service_role;
ALTER TABLE public.lodging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lodging_own" ON public.lodging FOR ALL TO authenticated USING (public.owns_trip(trip_id)) WITH CHECK (public.owns_trip(trip_id));

CREATE TABLE public.expense (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  categoria text NOT NULL,
  data date NOT NULL,
  valor_original numeric(14,2) NOT NULL CHECK (valor_original > 0),
  moeda_original char(3) NOT NULL,
  taxa_cambio numeric(18,8) NOT NULL,
  valor_moeda_base numeric(14,2) NOT NULL,
  pago_por uuid NULL REFERENCES public.person(id),
  comprovante_url text NULL,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  editado_em timestamptz NULL,
  deleted_at timestamptz NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense TO authenticated;
GRANT ALL ON public.expense TO service_role;
ALTER TABLE public.expense ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_own" ON public.expense FOR ALL TO authenticated USING (public.owns_trip(trip_id)) WITH CHECK (public.owns_trip(trip_id));

CREATE TABLE public.consistency_finding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  regra_id text NOT NULL,
  severidade text NOT NULL CHECK (severidade IN ('resolver','conferir','sugestao')),
  itens_envolvidos text[] NOT NULL DEFAULT '{}',
  mensagem text NOT NULL,
  hash_dos_dados text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispensado_em timestamptz NULL,
  UNIQUE (trip_id, regra_id, hash_dos_dados)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consistency_finding TO authenticated;
GRANT ALL ON public.consistency_finding TO service_role;
ALTER TABLE public.consistency_finding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finding_own" ON public.consistency_finding FOR ALL TO authenticated USING (public.owns_trip(trip_id)) WITH CHECK (public.owns_trip(trip_id));

CREATE INDEX idx_ticket_trip ON public.ticket(trip_id);
CREATE INDEX idx_lodging_trip ON public.lodging(trip_id);
CREATE INDEX idx_expense_trip ON public.expense(trip_id);
CREATE INDEX idx_member_trip ON public.trip_member(trip_id);
CREATE INDEX idx_finding_trip ON public.consistency_finding(trip_id);
