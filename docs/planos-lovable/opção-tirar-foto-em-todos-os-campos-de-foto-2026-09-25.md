# Opção "Tirar foto" em todos os campos de foto

## Objetivo
Todo campo de foto (foto de rosto em "Você", passaporte, vistos, vacinas, extras, "Trocar foto" na ficha admin) passa a oferecer **Tirar foto** usando a câmera do Mac/computador ou do telefone, além das opções atuais (galeria, arquivo, arrastar/colar).

## Como vai funcionar

### No telefone (iPhone/Android)
- O seletor nativo já oferece "Tirar foto" ao tocar no campo — mantido como está.

### No computador (Mac/desktop)
- Novo botão **"Tirar foto"** (ícone de câmera com rótulo) ao lado do campo de foto.
- Ao tocar, abre um painel inline (não modal bloqueante) com:
  - Pré-visualização ao vivo da câmera (via `getUserMedia`, pede permissão do navegador).
  - Botão grande **"Capturar"** (≥56 px) e **"Cancelar"**.
  - Se houver mais de uma câmera, seletor simples de câmera.
- A foto capturada entra no mesmo fluxo das outras fontes: prévia, leitura automática (MRZ/OCR) quando aplicável, nada salvo antes de "Salvar".
- Se o navegador negar permissão ou não houver câmera: aviso em pt-BR "Não consegui acessar a câmera. Você pode escolher uma foto da galeria." e o painel fecha.

## Detalhes técnicos
- Novo componente `TirarFoto` em `src/components/ArquivoFoto.tsx` (ou arquivo próprio): usa `navigator.mediaDevices.getUserMedia({ video: true })`, captura via `<canvas>` em JPEG, libera a câmera ao fechar/capturar.
- Componente reutilizado em todos os pontos que hoje usam `ZonaArquivo`: `FichaPartes.tsx` (documentos, foto "Você", "Trocar foto"), `c.$token.tsx` (passos do participante), ficha admin.
- Sem `capture` no input (mantido — iOS continua com menu nativo).
- Sem novas dependências; `getUserMedia` é API do navegador.
- Textos PT/EN conforme o idioma da tela.

## Teste
- Viewport desktop: abrir ficha admin de pessoa descartável, "Tirar foto" no passaporte, capturar, conferir prévia e OCR; apagar a descartável depois. Não tocar em dados reais.
- Publicar em evoqueviagens.lovable.app.
