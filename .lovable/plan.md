# Landing aprovada Evoque Viagens / Evoque Travels

## Objetivo
Integrar integralmente o site aprovado ao projeto atual, sem publicar, sem alterar DNS, banco, autenticação, PWA, caches, MCP/OAuth ou fluxos do aplicativo.

## Implementação
1. **Acervo visual e fontes**
   - Guardar as duas fotografias editoriais originais no acervo do projeto e gerar versões WebP otimizadas para a página.
   - Incorporar localmente as fontes Outfit, Inter e Playfair Display fornecidas no pacote, sem dependência externa.
   - Manter as capturas `desktop.png` e `celular.png` apenas como referência visual.

2. **Camada pública isolada**
   - Criar componentes React próprios da landing para cabeçalho, menu móvel, rodapé, troca PT/EN, tema claro/escuro, FAQ, modelos fictícios e cópia do endereço MCP.
   - Portar todo o conteúdo dos dez HTML aprovados, sem resumir ou reescrever: início, privacidade, termos, contato e conexão do assistente, em PT e EN.
   - Isolar cores, tipografia, espaçamentos e tema em uma folha de estilos exclusiva, sem afetar as telas do app.

3. **Rotas e separação de host**
   - Manter `/` como landing somente em `evoque.global`/`www`, e como conta do usuário nos hosts do app.
   - Adicionar as rotas públicas `/en`, `/privacidade`, `/termos`, `/contato`, `/conectar-assistente` e equivalentes em inglês.
   - Adicionar `/landing-preview` como revisão pública PT com `noindex`; nesse ambiente, links de início, seções e idioma permanecem dentro do marketing.
   - Liberar do login apenas essa lista fechada de rotas de marketing. Todas as rotas de dados continuam protegidas.
   - Ajustar o redirecionamento por host para que as páginas de marketing permaneçam em `evoque.global`, enquanto rotas do app continuem indo para `app.evoque.global`.

4. **Metadados e conteúdo aprovado**
   - Definir título, descrição, Open Graph, Twitter, canonical e hreflang específicos por idioma e página.
   - Manter `noindex` na rota de revisão e nas minutas de termos/privacidade; demais páginas apontam para os endereços finais aprovados.
   - Preservar CTAs para `https://app.evoque.global`, contato exclusivo por e-mail, links Evoque, textos “em breve”, legendas de dados fictícios e o fluxo MCP aprovado.

5. **Validação**
   - Conferir tipos e o build automático do projeto.
   - Revisar as onze rotas em desktop, tablet e celular: conteúdo, imagens, menu, FAQ, idioma, tema, cópia, foco, links, ausência de sobreposição e rolagem horizontal.
   - Confirmar que `/` no host do app continua exibindo a conta e que nenhuma rota privada foi liberada.
   - Atualizar o roadmap e informar arquivos, rotas, revisão/commit atual e endereço da prévia. Nada será publicado.

## Detalhes técnicos
- TanStack Start continuará como roteador e estrutura da aplicação.
- Os HTML/CSS/JS do pacote serão convertidos para componentes e estilos locais; documentos internos do ZIP não serão servidos.
- O componente antigo de landing será substituído sem copiar sua rotina de desregistrar service worker ou limpar caches.
- As fotografias finais serão servidas pelo acervo CDN do projeto; os originais enviados permanecem preservados fora da versão otimizada.
