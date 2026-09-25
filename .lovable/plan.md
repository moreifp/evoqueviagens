# Five changes requested by Fausto

Rules for every item: additive migrations only, existing people/documents/trips untouched, tests with throwaway `@example.com` accounts deleted at the end, no publishing.

## What I found in the app today
- Currencies come from a fixed list of 8 (`BRL, USD, EUR, GBP, ARS, CLP, JPY, CHF`) in `src/lib/format.ts`, so ZAR is missing.
- The app has no automatic exchange-rate lookup yet. The rate on a new expense is typed by hand (default 1).
- The server's automatic status lookup already sends the flight's local departure date to AeroDataBox. The **"Ver status"** button is different: it opens a Google search with only the flight number, and Google shows today's flight. That is the bug Fausto saw. There is also no rule for dates too far ahead.
- The "Sua ficha" progress in "Eu" counts 10 fixed items (`progressoFicha` in `src/lib/eu.ts`) and shows only 3 "falta" chips.

---

## 1. Currency picker with every currency
- New offline list `src/lib/moedas.ts` with all active ISO 4217 currencies (about 155): code, Portuguese name, country or countries, and a flag emoji. It is built into the app, so it works offline.
- New component `src/components/CampoMoeda.tsx`: a searchable list with no blocking pop-up. Search matches code, name, country and words without accents, so "rand", "ZAR" and "africa do sul" all find ZAR. The top group shows BRL, USD, EUR, GBP plus currencies already used in your trips and expenses (read from the cached trips).
- Swap it in wherever a currency is chosen: `nova-viagem.tsx` (trip currency, including edit), `trip.$id.despesas.nova.tsx`, `FormHotel.tsx`, `FormReserva.tsx`, `VirarDespesa.tsx` and the expense edit form. Keep `MOEDAS` as an alias so older code still compiles.
- Exchange rate: new server function `src/lib/cambio.functions.ts` that looks up the rate for any code pair using a free provider with no key (Frankfurter first, then open.er-api.com). If the rate is missing or you are offline, the rate field stays manual with the note "Cotação não encontrada · digite a taxa". The saved rate keeps working as today: once saved, it never changes.
- Server checks (`agente.tools.ts`, `reserva-ai.functions.ts`) accept any code in the full list, not just the 8.
- No migration needed, because currency columns already take any 3-letter code.

## 2. Baggage allowance per passenger
- Migration `0028_bagagem.sql` (additive): new nullable columns on `ticket_passenger` and on `ticket` (the ticket-level values are the default):
  `bag_mao_qtd int`, `bag_mao_kg numeric`, `item_pessoal boolean`, `bag_desp_qtd int`, `bag_desp_kg numeric`. Existing rows stay as they are.
- `FormBilhete.tsx`: a "Bagagem" block (hand bag count + kg, personal item yes/no, checked bags count + kg per bag). Values are copied to every passenger. Each passenger row gets "Ajustar bagagem" to change just that person. Saving goes through the existing `montarOps*` path, so offline editing keeps working.
- Flight card and flight detail screen: a short line such as "1 mão 10 kg · item pessoal · 2 × 23 kg despachadas". If a passenger has different values, their name appears next to that line.
- AI reading (`reserva-ai.functions.ts`, `agente.tools.ts` `propor_voo`, the Claude inbox): optional baggage fields fill the form when the ticket or e-mail mentions them.

## 3. Flight status on the right day
- `src/lib/voo.ts`: new `statusDisponivelEm(partida)`, the date the API starts covering a flight (a limit set in the code, confirmed against AeroDataBox's limit during the build).
- `atualizarTicket` (`voo.server.ts`): uses only the local departure date at the origin, which it already does. If the date is past the limit, it does **not** call the API and returns "O status aparece perto do voo (a partir de DD/MM)". It also throws away any API result whose local departure date differs from the ticket's, so no other day's flight is ever shown.
- `StatusVoo.tsx` → `linkGoogleVoo` adds the date, e.g. "TP88 25 set 2026". The same far-ahead message appears on the card, and "Atualizar agora" is disabled until then.
- Scheduled job (`api/public/hooks/status-voos.ts`): it already looks only 30 hours ahead and calls `atualizarTicket`, so it follows the same rule automatically. The date check is added there too.

## 4. "Eu" profile checklist: every item
- `src/lib/eu.ts` → `progressoFicha` is rewritten to use the full list: CPF, RG, CNH, PID, passaporte(s), vistos (EUA, ESTA, eTA Canadá, ETA UK, ETIAS, K-ETA, outro), visto negado/em processo, Global Entry/TSA (KTN), vacina febre amarela + outras, seguro-viagem (seguradora, apólice, telefone), endereço, emergência, preferências, fidelidade (aéreas, hotéis, locadoras, sala VIP).
- Required items: CPF, passaporte, endereço, emergência, preferências. The rest are optional and can be marked **"Não tenho"**, which stops them counting as missing.
- "Não tenho" is stored in migration `0029_ficha_nao_tenho.sql` as a new table `person_item_dispensa (person_id, item, created_at, deleted_at)` with owner-only RLS and GRANTs. This leaves the `person` table and personal-registry tables unchanged; the new table only sits beside them.
- `EuDashboard.tsx`: "X de N" is calculated, and a "Ver tudo" list shows every item with its status (feito / falta / não tenho). Each item opens the forms that already exist (`pessoas.$pid.documentos.novo?tipo=…`, `dados?secao=…`, `fidelidade.novo?tipo=…`), which already support camera, gallery, file and drag, and save only changed fields. The only form change is adding the seguro fields (seguradora, telefone) and KTN to `detalhe`/`numero` if they are missing, and adding "locadora" as a loyalty type. These are UI-only, with no schema change to protected tables.
- The "Em ordem" summary and offline cache keep working (the new table is added to the "Eu" offline download).

## 5. "Colar e-mail da agência"
- New component `src/components/ColarEmailAgencia.tsx`, placed in the flight ticket screen (`trip.$id.bilhetes.novo.tsx`) and in "Adicionar". It accepts pasted text, a dropped or selected `.eml`, a PDF or a screenshot.
- `.eml` is read in the browser (headers removed, text/HTML part kept). PDFs and images go to the AI reader that already exists.
- New server function `lerEmailAgencia` in `src/lib/reserva-ai.functions.ts`, using the Lovable AI Gateway with a strict output format containing only: segments (company, number, origin/destination IATA, local times + tz), passengers, locator, seat, baggage. The prompt tells the AI to ignore prices, fares, taxes, commission and payment. The output format has no fields for them, and a server filter removes any leftover money or card-like text before returning.
- Confirmation screen: one editable card per segment (outbound and return), all confirmed together in one tap. Nothing saves automatically. Saving uses the existing `montarOps*`, creating several tickets in one batch that works offline.
- The original e-mail/PDF is saved as an `item_attachment` on each created ticket, marked private. Additive migration `0030_anexo_privado.sql` adds `privado boolean default false` to `item_attachment`, and the RLS SELECT policy is extended so private attachments are visible only to the trip organizer.

---

## Tests (throwaway accounts, deleted at the end, zero leftovers checked)
1. Picker: search "rand", "ZAR", "África do Sul" finds ZAR. Trip in ZAR, expense in ZAR→BRL gets an automatic rate. An invented code falls back to manual. The list opens offline.
2. Baggage: ticket with 2 passengers, default copied, one changed. The card shows the compact line. An AI reading of a sample ticket fills baggage.
3. Status: flight 5 months ahead shows the "a partir de DD/MM" message with no API call (usage counter unchanged). The Google link contains the date. One real call for a flight within range, max 2 units.
4. Ficha: new account shows the full list and correct %. Marking "Não tenho" on CNH/PID raises %. Each item opens its form. Offline view works.
5. E-mail: paste a sample round-trip agency e-mail with prices: 2 tickets proposed, no price shown anywhere or stored. Confirm → 2 tickets plus a private attachment. A second account (participant) cannot see the attachment. Also tested with `.eml` and PDF.
6. Regression: build, `tsgo`, and quick checks of trip, "Eu" and offline.

## Files summary
- New: `src/lib/moedas.ts`, `src/components/CampoMoeda.tsx`, `src/lib/cambio.functions.ts`, `src/components/ColarEmailAgencia.tsx`.
- Edited: `format.ts`, `nova-viagem.tsx`, `trip.$id.despesas.nova.tsx`, `trip.$id.despesas.index.tsx`, `FormHotel.tsx`, `FormReserva.tsx`, `VirarDespesa.tsx`, `FormBilhete.tsx`, `trip.$id.bilhetes.*`, `trip.$id.item.$tipo.$itemId.tsx`, `trip.$id.adicionar.tsx`, `voo.ts`, `voo.server.ts`, `StatusVoo.tsx`, `status-voos.ts`, `eu.ts`, `EuDashboard.tsx`, `offline.ts`, `reserva-ai.functions.ts`, `agente.tools.ts`, `data.ts`, `AnexosItem.tsx`.
- Migrations: `0028_bagagem`, `0029_ficha_nao_tenho`, `0030_anexo_privado`, all additive.
