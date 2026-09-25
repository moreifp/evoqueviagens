# Calendário inteligente na viagem

## Problema
Em "Nova viagem" (e "Editar viagem"), Início e Fim são campos de data independentes: dá para escolher fim antes do início (ex.: início 09/02/2027, fim 09/09/2026) e datas no passado, sem nenhum aviso.

## O que muda (só `src/routes/nova-viagem.tsx`)

1. **Fim acompanha o início**: ao escolher o início, se o fim estiver vazio ou for anterior/igual ao início, o fim vira automaticamente início + 1 dia. Se o fim já for posterior, não mexe.
2. **Sem passado em viagem nova**: o campo Início ganha `min` = hoje (data local do aparelho). Na edição de uma viagem existente, o passado continua permitido (a viagem pode já ter acontecido).
3. **Fim nunca antes do início**: o campo Fim ganha `min` = início + 1 dia (quando o início estiver preenchido), então o seletor do aparelho já bloqueia datas inválidas.
4. **Trava final no salvar**: se mesmo assim fim ≤ início (navegador sem suporte a `min`), mostra aviso "O fim precisa ser depois do início" e não salva.
5. Mesma lógica vale para os três modos da tela: nova, duplicar e editar.

## Fora de escopo
- Nada de migration, nada de banco, nada de publicação.
- Outros formulários (voo, hotel, reserva) já validam as próprias datas; não serão tocados.

## Teste
Na prévia: criar viagem com início 09/02/2027 → fim vira 10/02/2027 sozinho; tentar fim anterior → bloqueado; editar viagem passada → continua permitindo; salvar normalmente.
