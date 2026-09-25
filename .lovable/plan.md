# Lugares e marcas (menos digitação)

Regras mantidas: migrations só aditivas, cadastro pessoal intocado, offline, não publicar, teste só com contas `@example.com`.

## Situação dos conectores (conferida agora)
- **Google Maps Platform**: existe a conexão "Google Maps Platform" gerenciada pela Lovable, liberada para ligar a este projeto sem aprovação extra. Vou usá-la. (A conexão "Diego's Google Maps Platform", com chave própria, não pode ser ligada: o dono do projeto não tem acesso a ela — não será usada.)
- **Logo.dev**: não há nenhuma conexão Logo.dev no workspace. Não vou contornar. Para liberar o item 4, o dono precisa: Configurações do workspace → Conectores → Logo.dev → "Nova conexão" (colar a chave do Logo.dev) e me avisar. Até lá, deixo o código pronto com o ícone atual como padrão; quando a conexão existir, eu ligo e testo TAP/LATAM.

## 1) Endereço sem digitar
- Campo único "Buscar lugar" no hotel (nome/endereço), na reserva (local) e no restaurante. Restaurante hoje é uma reserva do tipo "restaurante" (não existe cadastro separado; a aba Restaurantes segue "em breve").
- Ao escolher: preenche nome (hotel, se vazio), endereço, cidade, lat, lng, place_id, site e fuso.
- Fuso pela coordenada, guardado no item. Hotel: novo campo de fuso; reserva: preenche o fuso de início/fim já existente. Voo continua na tabela de aeroportos.
- Sem internet (ou se o serviço falhar): o campo é texto livre normal, nada bloqueia.
- Economia: espera 300 ms após parar de digitar, mínimo 3 letras, ignora respostas antigas, uma sessão por busca. Só usuário logado pode chamar.
- **Custo por cadastro**: digitando ~3–5 pausas = 3–5 buscas (cobradas como uma sessão ao escolher) + 1 detalhe do lugar + 1 fuso = **em média 5–7 chamadas**; sem escolher nada, só as buscas.

## 2) Mapa
- Detalhe de hotel e reserva: "Abrir no mapa" → escolha Google Maps / Apple Maps (links diretos, usam place_id ou coordenada; sem chave).
- Visão da viagem, por dia: "Ver o dia no mapa" abre o Google Maps com rota passando pelos pontos do dia que têm coordenada (hotéis, reservas, aeroportos). Aparece só com 1+ ponto.

## 3) Como chegar
- Botão no hotel e na reserva. Pede a localização só nesse toque e abre a rota no app escolhido. A localização vai direto no link do mapa; nunca é gravada nem enviada ao nosso servidor. Se negar, abre a rota com "minha localização" do próprio app de mapas.

## 4) Logos (depende do Logo.dev)
- Voo: domínio pela companhia (mapa IATA → domínio para ~40 principais: TP, LA, G3, AD, AF, KL, LH, BA, IB, UX, EK, QR, TK, AA, UA, DL, CM, AV, AR, etc.). Hotel: domínio do site gravado no item 1.
- Imagem pequena no cartão; se falhar, ícone atual. Logos entram no cache do "baixar viagem".

## Teste
Conta descartável: hotel em Lisboa e restaurante no Porto pelo autocomplete; conferir no banco endereço, cidade, lat/lng, place_id e fuso (Europe/Lisbon); "Abrir no mapa" (links Google/Apple); "Como chegar" com localização simulada e conferência de que nada chega ao servidor; "Ver o dia no mapa"; logos TAP e LATAM (se Logo.dev ligado); tudo abre offline, campo vira texto livre. Apagar tudo e confirmar zero sobras (7 pessoas reais intactas).

## Detalhes técnicos
- Ligar conexão gerenciada `google_maps` (std_01kwwctdjse7mbz3ktwzpmmppg) ao projeto.
- Migration `0023_lugares.sql` (aditiva): `lodging` + `place_id`, `site`, `tz`; `reservation` + `place_id`, `site`. Atualizar `roteiro_viagem` para expor lat/lng/place_id (para o mapa do dia), sem remover colunas.
- `src/lib/lugares.functions.ts` com `requireSupabaseAuth`: `autocompletar` (Places New `places:autocomplete`, field mask mínimo, sessionToken, locationBias pelas cidades da viagem), `detalhesLugar` (Place Details com o mesmo token; campos id, displayName, formattedAddress, addressComponents, location, websiteUri) + Time Zone API na mesma chamada. Tratamento de 403 com mensagem clara.
- `src/components/CampoLugar.tsx` (dropdown próprio, debounce, `navigator.onLine`).
- `src/lib/mapas.ts` (links Google/Apple, rota com waypoints, geolocalização local) e `src/components/AbrirMapa.tsx`.
- `src/lib/logos.ts` (mapa IATA→domínio, URL do logo) + `Logo.tsx`; incluir URLs em `offline.ts`.
- Arquivos alterados: FormHotel, FormReserva, trip.$id.item.$tipo.$itemId, trip.$id.index, data.ts, offline.ts, roadmap.md.
