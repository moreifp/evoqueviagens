# Anexar qualquer arquivo ao documento

## Objetivo
Na tela de documento (novo/editar), permitir anexar qualquer tipo de arquivo (jpg, png, pdf, eml, doc, xls, etc.), não só foto e PDF.

## Mudanças

### 1. `src/components/ArquivoFoto.tsx`
- Nova constante `ACEITA_QUALQUER = "*/*"` (ou lista ampla).
- `aceitavel()`: quando a zona aceita qualquer arquivo, não rejeita por tipo — qualquer arquivo passa.
- `Miniatura`: para arquivos que não são imagem nem PDF, mostra ícone genérico de arquivo (Paperclip/FileText) em vez de tentar `<img>`.
- `previaDe`: para arquivos não-imagem/não-PDF, retorna marcador "arquivo".

### 2. `src/lib/imagem.ts`
- `prepararArquivo`: arquivos que não são imagem nem PDF (eml, doc, xls, zip etc.) passam como estão, com a extensão e o content-type originais — sem tentar comprimir. Hoje isso quebraria com "Não deu para abrir essa imagem."
- Tipo `Ext` vira `string` para aceitar qualquer extensão.

### 3. `src/routes/pessoas.$pid.documentos.novo.tsx`
- O botão "Arquivo ou PDF" passa a aceitar qualquer arquivo (`accept` amplo).
- `receive()`: se o arquivo não for imagem nem PDF, pula a leitura por IA (sem chamada de identify/readDoc/readPassport), mostra o arquivo anexado com ícone e o aviso "Arquivo anexado · preencha os dados" e abre o formulário para preenchimento manual.
- Imagens e PDFs continuam com o fluxo atual de leitura.
- O salvar já grava o arquivo via `prepararArquivo` + `document_attachment` — passa a funcionar para qualquer tipo.

### 4. Detalhe do documento (`src/routes/pessoas.$pid.documentos.$did.tsx`)
- Anexos não-imagem abrem/baixam normalmente; miniatura usa o ícone genérico.

## Fora de escopo
- Nenhuma migração, nenhuma mudança no banco.
- Não muda a leitura por IA (só fotos e PDFs continuam sendo lidos).
- Não publicar.

## Teste
- Anexar um .eml e um .docx num documento novo, salvar, abrir o detalhe e baixar o anexo.
- Conferir que foto e PDF continuam com leitura por IA.
