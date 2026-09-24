# Link do WhatsApp no formato do projeto Lita

## Objetivo
Trocar o formato do link do WhatsApp no Evoque para o mesmo usado no projeto "Lita Performance em Vendas": `https://api.whatsapp.com/send?phone=<numero>&text=<mensagem>`. Ao tocar, a pessoa escolhe abrir no WhatsApp Web ou no aplicativo, já com o número de destino e o texto prontos.

## Mudança
- Em `src/lib/links.ts`, a função que monta o link passa de `https://wa.me/<fone>?text=...` para `https://api.whatsapp.com/send?phone=<fone>&text=...` (com `encodeURIComponent` no texto, como já é hoje).
- Isso vale automaticamente para todos os lugares que usam essa função: Convidar (envio em sequência e "Copiar link"), "Lembrar" na lista de Pessoas, "Pedir correção" e "Pedir novo" na ficha.
- Nada mais muda: mensagens, fluxos e telas continuam iguais.

## Teste
- Em viewport de celular, com uma pessoa descartável: Convidar abre o novo formato de link com número e texto; "Lembrar" e "Pedir novo" idem. Apagar a pessoa de teste depois.
- Publicar ao final.
