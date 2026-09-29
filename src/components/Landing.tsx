import { useEffect, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  CircleCheck,
  FileScan,
  Plane,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WifiOff,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { APP_URL } from "@/lib/site";

const ICONE = { strokeWidth: 2.2, "aria-hidden": true } as const;

/** Landing institucional provisória de evoque.global. */
export function Landing() {
  const [mudou, setMudou] = useState(false);

  // Quem instalou o app em evoque.global: remove o service worker antigo e avisa da mudança.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        if (!regs.length) return;
        await Promise.all(regs.map((r) => r.unregister()));
        try {
          const nomes = await caches.keys();
          await Promise.all(
            nomes.filter((n) => n.startsWith("evoque-")).map((n) => caches.delete(n)),
          );
        } catch {
          /* sem cache */
        }
        setMudou(true);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-ld-sand font-sans text-ld-navy">
      {mudou && (
        <div role="status" className="bg-ld-navy px-4 py-3 text-center text-base text-ld-sand">
          O app mudou para <strong>app.evoque.global</strong> ·{" "}
          <a href={APP_URL} className="font-bold underline underline-offset-4">
            Abrir e instalar de novo
          </a>
          <button
            onClick={() => setMudou(false)}
            aria-label="Fechar aviso"
            className="ml-3 inline-flex size-10 items-center justify-center align-middle"
          >
            <X {...ICONE} className="size-5" />
          </button>
        </div>
      )}

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <a href="/" className="flex items-baseline gap-2" aria-label="Évoque Viagens, início">
          <span className="font-wordmark text-3xl font-semibold tracking-tight">Évoque</span>
          <span className="text-lg text-ld-teal">Viagens</span>
        </a>
        <a
          href={APP_URL}
          className="inline-flex min-h-12 items-center rounded-full px-5 text-base font-semibold text-ld-teal hover:underline"
        >
          Entrar
        </a>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-6 md:grid-cols-[1.1fr_0.9fr] md:pt-12">
          <div>
            <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-tight md:text-6xl">
              A viagem inteira.
              <span className="block bg-gradient-to-r from-ld-olive to-ld-teal bg-clip-text text-transparent">
                Mesmo sem internet.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ld-navy/80 md:text-xl">
              Documentos, bilhetes, hotéis e reservas num lugar só — e o app confere se está tudo
              certo antes do aeroporto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={APP_URL}
                className="inline-flex min-h-14 items-center gap-2 rounded-full bg-ld-navy px-7 text-lg font-semibold text-ld-sand shadow-lg shadow-ld-navy/20 transition hover:bg-ld-teal"
              >
                Abrir o app <ArrowRight {...ICONE} className="size-5" />
              </a>
              <a
                href={APP_URL}
                className="inline-flex min-h-14 items-center rounded-full border-2 border-ld-navy/20 px-7 text-lg font-semibold text-ld-navy transition hover:border-ld-teal hover:text-ld-teal"
              >
                Entrar
              </a>
            </div>
          </div>
          <Celular />
        </section>

        <section aria-labelledby="recursos" className="mx-auto max-w-6xl px-5 pb-16">
          <h2 id="recursos" className="sr-only">
            O que o app faz
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Bloco icone={<WifiOff {...ICONE} className="size-6" />} titulo="Abre no avião">
              Tudo fica no celular, até os PDFs dos bilhetes e vouchers.
            </Bloco>
            <Bloco
              icone={<FileScan {...ICONE} className="size-6" />}
              titulo="Foto ou PDF preenche tudo"
            >
              Mande a foto ou o PDF da reserva e os campos se preenchem. Você só confere.
            </Bloco>
            <Bloco icone={<ShieldCheck {...ICONE} className="size-6" />} titulo="Está tudo certo?">
              Noite sem hotel, passaporte vencendo, nome diferente do bilhete. O app avisa — nunca
              bloqueia.
            </Bloco>
            <Bloco
              icone={<CircleCheck {...ICONE} className="size-6" />}
              titulo="Seus dados são seus"
            >
              Cada um escolhe o que compartilhar, com quem e até quando. Sem anúncios.
            </Bloco>
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="flex flex-col gap-4 rounded-3xl bg-ld-navy p-8 text-ld-sand md:flex-row md:items-center md:gap-8 md:p-10">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-ld-olive to-ld-teal">
              <Sparkles {...ICONE} className="size-7" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold">Funciona com o Claude</h2>
              <p className="mt-2 text-lg text-ld-sand/85">
                Peça ao Claude para trazer as reservas do seu e-mail. Elas chegam pendentes e só
                entram quando você confirma.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <p className="flex flex-wrap items-center gap-2 text-lg">
            <UtensilsCrossed {...ICONE} className="size-5 text-ld-teal" />
            Da mesma família do{" "}
            <a
              href="https://evoque.guru"
              className="font-semibold text-ld-teal underline underline-offset-4"
            >
              Évoque — seu diário gastronômico
            </a>
          </p>
        </section>
      </main>

      <footer className="border-t border-ld-navy/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-base text-ld-navy/75">
          <span>© 2026 DPM Tecnologia Ltda.</span>
          <nav aria-label="Legal" className="flex gap-2">
            <a
              href="[LINK]"
              className="inline-flex min-h-12 items-center px-2 underline-offset-4 hover:underline"
            >
              Termos
            </a>
            <a
              href="[LINK]"
              className="inline-flex min-h-12 items-center px-2 underline-offset-4 hover:underline"
            >
              Privacidade
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Bloco({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-3xl border border-ld-navy/10 bg-white p-6">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-ld-teal/10 text-ld-teal">
        {icone}
      </span>
      <h3 className="mt-4 font-display text-xl font-bold">{titulo}</h3>
      <p className="mt-2 text-base leading-relaxed text-ld-navy/80">{children}</p>
    </li>
  );
}

/** Mockup da visão da viagem (dados fictícios), desenhado em HTML para ficar nítido e leve. */
function Celular() {
  return (
    <div
      className="mx-auto w-full max-w-[330px]"
      role="img"
      aria-label="Tela do app com a viagem Portugal: voo de ida, hotel em Lisboa e um aviso de noite sem hotel."
    >
      <div className="rounded-[2.75rem] bg-ld-navy p-3 shadow-2xl shadow-ld-navy/30">
        <div className="overflow-hidden rounded-[2.2rem] bg-ld-sand">
          <div className="bg-gradient-to-br from-ld-olive to-ld-teal px-5 pb-6 pt-8 text-white">
            <p className="text-sm opacity-90">12 a 22 de nov · 3 pessoas</p>
            <p className="font-display text-3xl font-bold">Portugal</p>
            <p className="text-sm opacity-90">Lisboa · Porto</p>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 rounded-2xl border border-validity-warn-border bg-validity-warn p-3 text-sm">
              <TriangleAlert {...ICONE} className="size-5 shrink-0 text-ld-navy" />
              <span>
                <strong>1 noite sem hotel</strong> · 17/11 no Porto
              </span>
            </div>
            <Item
              icone={<Plane {...ICONE} className="size-5" />}
              titulo="TP 088 · GRU → LIS"
              linha="12/11 · 22:35 → 12:10"
            />
            <Item
              icone={<BedDouble {...ICONE} className="size-5" />}
              titulo="Hotel Avenida Palace"
              linha="Lisboa · 13 a 17/11"
            />
            <Item
              icone={<Plane {...ICONE} className="size-5" />}
              titulo="TP 1954 · OPO → LIS"
              linha="21/11 · 18:05"
            />
            <div className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm text-ld-teal">
              <CircleCheck {...ICONE} className="size-5" /> Disponível sem internet
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({ icone, titulo, linha }: { icone: React.ReactNode; titulo: string; linha: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-ld-navy/5 text-ld-navy">
        {icone}
      </span>
      <div>
        <p className="text-sm font-bold">{titulo}</p>
        <p className="text-sm text-ld-navy/70">{linha}</p>
      </div>
    </div>
  );
}
