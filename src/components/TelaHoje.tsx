import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BookUser, Navigation, Phone, Plane, Siren, Ticket as IconeBilhete, Wallet, BedDouble } from "lucide-react";
import { toast } from "sonner";
import { anexosQuery, expensesQuery, flightStatusQuery, lodgingsQuery, membersQuery, settlementsQuery, ticketsQuery, type Trip } from "@/lib/data";
import { SeloOffline } from "./SeloOffline";
import { MostrarPassaporte } from "./MostrarPassaporte";
import { chaveDia, fmtMoney, fusoLocal, horaNoFuso } from "@/lib/format";
import { resumoSaldos } from "@/lib/saldos";
import { numeroPrincipal, tel } from "@/lib/emergencia";
import { linkGoogle } from "@/lib/mapas";
import { abrirAnexo } from "@/lib/anexosOffline";
import { carregarAeroportos, porIata, type Aeroporto } from "@/lib/aeroportos";
import { euQuery, minhaPessoaQuery } from "@/lib/eu";
import { chipDoStatus } from "@/lib/voo";

const DIA = (iso: string, tz: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: tz }).format(new Date(iso)).replace(".", "").toUpperCase();
const DDMM = (iso: string, tz: string) => chaveDia(iso, tz).slice(5).split("-").reverse().join("/");

/** Viagem em andamento, ou que começa em até 48 h. */
export function viagemDeHoje(viagens: Trip[]): Trip | null {
  const agora = Date.now();
  const hoje = chaveDia(new Date().toISOString(), fusoLocal());
  const limite = chaveDia(new Date(agora + 48 * 3600e3).toISOString(), fusoLocal());
  const ativas = viagens.filter((v) => !v.arquivada_em && !v.deleted_at && v.data_fim >= hoje && v.data_inicio <= limite);
  return ativas.sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0] ?? null;
}

export function TelaHoje({ trip }: { trip: Trip }) {
  const id = trip.id;
  const nav = useNavigate();
  const tz = fusoLocal();
  const agoraIso = new Date().toISOString();
  const agora = Date.now();
  const { data: bilhetes = [] } = useQuery(ticketsQuery(id));
  const { data: hoteis = [] } = useQuery(lodgingsQuery(id));
  const { data: anexos = [] } = useQuery(anexosQuery(id));
  const { data: status } = useQuery(flightStatusQuery(id));
  const { data: despesas = [] } = useQuery(expensesQuery(id));
  const { data: acertos = [] } = useQuery(settlementsQuery(id));
  const { data: membros = [] } = useQuery(membersQuery(id));
  const { data: eu } = useQuery(minhaPessoaQuery());
  const { data: euDados } = useQuery({ ...euQuery(eu?.id ?? ""), enabled: !!eu });
  const [aeros, setAeros] = useState<Aeroporto[]>([]);
  useEffect(() => { void carregarAeroportos().then(setAeros); }, []);
  const [passaporte, setPassaporte] = useState(false);

  const meuPid = membros.find((m) => m.meu && m.kind === "self")?.person_id ?? eu?.id;
  const voo = bilhetes.find((b) => {
    if (b.tipo !== "voo") return false;
    const part = Date.parse(b.partida_utc);
    if (Date.parse(b.chegada_utc) < agora) return false;
    return chaveDia(b.partida_utc, b.partida_tz) === chaveDia(agoraIso, b.partida_tz) || (part >= agora && part - agora <= 24 * 3600e3);
  });
  const pax = voo?.passageiros.find((p) => p.person_id === meuPid);
  const st = voo ? status?.[voo.id] : undefined;
  const origem = voo?.origem_iata ? porIata(aeros, voo.origem_iata) : null;
  const destino = voo?.destino_iata ? porIata(aeros, voo.destino_iata) : null;
  const internacional = !!origem && !!destino && origem.pais !== destino.pais;
  const partidaEfetiva = st?.partida_revista_utc ?? voo?.partida_utc;
  const noAeroporto = voo && partidaEfetiva ? horaNoFuso(new Date(Date.parse(partidaEfetiva) - (internacional || !origem || !destino ? 3 : 2) * 3600e3).toISOString(), voo.partida_tz) : null;
  const anexosVoo = voo ? anexos.filter((a) => a.item_id === voo.id) : [];
  const cartao = anexosVoo.find((a) => /embarque|boarding/i.test(a.nome)) ?? anexosVoo[0];

  const hotel = hoteis.find((h) => (h.checkin <= agoraIso && h.checkout > agoraIso) || chaveDia(h.checkin, h.tz ?? tz) === chaveDia(agoraIso, h.tz ?? tz));
  const hTz = hotel?.tz ?? tz;
  const diaCheckin = hotel && chaveDia(hotel.checkin, hTz) === chaveDia(agoraIso, hTz) && hotel.checkin > agoraIso;

  const { saldos, eu: euMembro } = resumoSaldos(despesas, acertos, membros);
  const meuSaldo = euMembro ? saldos[euMembro] ?? 0 : 0;
  const pais = trip.emergencia?.paises?.[0];
  const numeroEmerg = pais ? numeroPrincipal(pais) : null;

  const pessoasPass = euDados ? [{ id: euDados.pessoa.id, nome: euDados.pessoa.nome, docs: euDados.documentos }, ...euDados.dependentes.map((d) => ({ id: d.id, nome: d.nome, docs: euDados.documentosDependentes[d.id] ?? [] }))] : [];

  async function abrirCartao() {
    if (!voo) return;
    if (cartao) { const ok = await abrirAnexo(cartao.storage_path); if (ok) return; toast.error("Sem internet e sem cópia guardada deste arquivo."); }
    void nav({ to: "/trip/$id/item/$tipo/$itemId", params: { id, tipo: "ticket", itemId: voo.id } });
  }

  const chip0 = st ? chipDoStatus(st) : null;
  const chip = chip0 && !chip0.texto.startsWith("Portão") && chip0.tom !== "muted" ? chip0 : null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="px-4 pt-4">
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Hoje · {DIA(agoraIso, tz)} {DDMM(agoraIso, tz)}</p>
        <div className="flex items-end justify-between gap-3">
          <h1 className="min-w-0 truncate text-3xl">{trip.nome}</h1>
          <Link to="/viagens" search={{ todas: true }} className="tap flex shrink-0 items-center text-base font-bold text-accent">Todas as viagens</Link>
        </div>
        <SeloOffline tripId={id} />
      </header>

      <main className="space-y-4 px-4 pt-3">
        {voo && (
          <Link to="/trip/$id/item/$tipo/$itemId" params={{ id, tipo: "ticket", itemId: voo.id }} className="cartao-voo gradient-voos shadow-medium block rounded-3xl p-5 text-white">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide"><Plane size={20} strokeWidth={2.2} /> Voo de hoje{voo.companhia || voo.numero ? ` · ${[voo.companhia, voo.numero].filter(Boolean).join(" ")}` : ""}</p>
            <p className="mt-2 text-3xl font-extrabold">{voo.origem_iata ?? voo.origem_cidade ?? "?"} → {voo.destino_iata ?? voo.destino_cidade ?? "?"}</p>
            <p className="num mt-1 text-[56px] leading-none">{horaNoFuso(partidaEfetiva ?? voo.partida_utc, voo.partida_tz)}</p>
            <p className="mt-3 text-base font-semibold">
              {[(pax?.assento ?? voo.assento) && `Assento ${pax?.assento ?? voo.assento}`, st?.portao_partida && `Portão ${st.portao_partida}`, (pax?.localizador ?? voo.localizador) && `Reserva ${pax?.localizador ?? voo.localizador}`].filter(Boolean).join(" · ")}
            </p>
            {noAeroporto && <p className="mt-1 text-lg font-bold">No aeroporto até {noAeroporto}{chip ? ` · ${chip.texto}` : ""}</p>}
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          {voo && (
            <button type="button" onClick={() => void abrirCartao()} className="novo-cor tap flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl border border-voos-border bg-voos-soft p-3 text-base font-bold text-foreground">
              <IconeBilhete size={30} strokeWidth={2.2} className="novo-cor-icone text-voos" /> Cartão de embarque
            </button>
          )}
          <button type="button" onClick={() => setPassaporte(true)} className={`novo-cor tap flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl border border-doc-border bg-doc-soft p-3 text-base font-bold text-foreground ${voo ? "" : "col-span-2"}`}>
            <BookUser size={30} strokeWidth={2.2} className="novo-cor-icone text-doc" /> Mostrar passaporte
          </button>
        </div>

        {hotel && (
          <div className="cartao-hosp gradient-hosp shadow-medium rounded-3xl p-5 text-white">
            <Link to="/trip/$id/item/$tipo/$itemId" params={{ id, tipo: "lodging", itemId: hotel.id }} className="block">
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide"><BedDouble size={20} strokeWidth={2.2} /> Hotel · {diaCheckin ? `Entrada a partir de ${horaNoFuso(hotel.checkin, hTz)}` : `Saída até ${horaNoFuso(hotel.checkout, hTz)}`}</p>
              <p className="mt-2 text-2xl font-extrabold leading-tight">{hotel.nome}</p>
              {(hotel.endereco || hotel.cidade) && <p className="mt-1 line-clamp-2 text-xl">{hotel.endereco ?? hotel.cidade}</p>}
            </Link>
            <div className="mt-4 flex gap-2">
              <a href={linkGoogle({ nome: hotel.nome, endereco: hotel.endereco, lat: hotel.lat, lng: hotel.lng, place_id: hotel.place_id })} target="_blank" rel="noopener noreferrer" className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-white text-lg font-bold text-hosp"><Navigation size={22} /> Como chegar</a>
              {hotel.telefone && <a href={tel(hotel.telefone)} className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white text-lg font-bold text-white"><Phone size={22} /> Ligar</a>}
            </div>
          </div>
        )}

        <Link to="/trip/$id/despesas" params={{ id }} className="novo-cor tap flex items-center gap-3 rounded-2xl border border-desp-border bg-desp-soft px-4">
          <Wallet size={26} strokeWidth={2.2} className="novo-cor-icone shrink-0 text-desp" />
          <span className="text-lg font-bold text-foreground">Despesas</span>
          <span className={`ml-auto text-right text-base font-bold ${meuSaldo > 0 ? "text-recebe" : meuSaldo < 0 ? "text-deve" : "text-emdia"}`}>{meuSaldo > 0 ? `você recebe ${fmtMoney(meuSaldo / 100, trip.moeda_base)}` : meuSaldo < 0 ? `você deve ${fmtMoney(-meuSaldo / 100, trip.moeda_base)}` : "em dia"}</span>
        </Link>

        <Link to="/trip/$id/emergencia" params={{ id }} className="tap flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-emerg text-xl font-extrabold text-white">
          <Siren size={28} strokeWidth={2.2} /> Emergência{numeroEmerg ? ` · ${numeroEmerg}` : ""}
        </Link>

        <Link to="/trip/$id" params={{ id }} className="tap flex items-center justify-center text-lg font-bold text-accent">Ver a viagem inteira</Link>
      </main>
      <MostrarPassaporte pessoas={pessoasPass} semBotao aberto={passaporte} onFechar={() => setPassaporte(false)} />
    </div>
  );
}
