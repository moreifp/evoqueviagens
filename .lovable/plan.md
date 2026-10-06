# Proteger o envio de fotos ao Drive

## Resposta
As fotos vão para o **Google Drive do Fausto**, não para o Drive de quem está usando o app. A conexão do Drive é uma só, a conta que fez a ligação. Por isso o aviso faz sentido: hoje qualquer pessoa com login poderia mandar arquivos para uma pasta do Drive do Fausto, porque o envio da foto não confere quem está pedindo.

A criação da pasta já confere isso (só o organizador da viagem pode criar). Falta fazer a mesma conferência no envio da foto.

## O que muda
- O envio da foto passa a pedir também a viagem. O servidor confere se quem está enviando é o organizador dessa viagem.
- O servidor também confere se a pasta de destino é mesmo a pasta dessa viagem (pelo nome e pelo tipo "pasta" no Drive). Qualquer outra pasta é recusada.
- Para o organizador, nada muda na tela. Os botões e o passo a passo continuam iguais.

## Detalhes técnicos
- `src/lib/drive.functions.ts` › `fotoDrive`: o input ganha `tripId: uuid`. O servidor lê `trip.nome,owner_id` via `context.supabase` e recusa se `owner_id !== userId`. Depois faz `GET files/{pastaId}?fields=name,mimeType,trashed` e exige uma pasta não apagada com o nome sanitizado da viagem (a mesma regra de `pastaDrive`, extraída para uma função comum).
- `src/routes/trip.$id.fotos.tsx`: passa `tripId: id` na chamada `mandarFoto`.
- Depois de pronto, marcar o aviso `lov_finding_2903639e087118b1` como corrigido. Não publicar sem pedido. O ponto de volta é o commit atual, informado antes da mudança.
