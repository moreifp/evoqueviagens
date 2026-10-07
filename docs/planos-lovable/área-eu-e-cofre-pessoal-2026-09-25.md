# Área “Eu” e cofre pessoal

## Objetivo

Transformar a antiga área de administração de fichas na central dos dados da própria conta, mantendo dependentes, compartilhamento somente leitura, funcionamento offline e o design atual.

## Navegação e estrutura

- Renomear a aba inicial para **Eu**, com ícone de pessoa, mantendo as quatro abas: Eu, Viagens, Restaurantes e Despesas.
- Remover o menu de perfil do topo. Levar **Sair da conta** para o final da tela Eu e retirar a tela separada de perfil da navegação.
- Retirar das telas atuais os links pessoais, pedidos por WhatsApp, aprovação/correção, progresso do wizard e convite do modelo antigo. As tabelas antigas permanecem intactas.
- Manter `/` como a tela Eu para a própria conta. Reutilizar a mesma apresentação em `/pessoas/:pid` para dependentes e pessoas compartilhadas, com volta e bloqueio de edição quando for somente leitura.

## Tela Eu

- Criar o cartão principal em gradiente com foto/iniciais, nome, e-mail, progresso real dos 10 itens e atalhos para pendências.
- Calcular completude para: foto, dados pessoais, passaporte, RG, CNH, visto/autorização, vacina, fidelidade, preferências e emergência.
- Exibir o aviso tocável do documento com vencimento mais próximo em até seis meses.
- Organizar a página em Documentos, Fidelidade, Família, Mais sobre você e Quem vê seus dados.
- Criar formulários simples e pré-preenchidos para dados pessoais, preferências e emergência, salvando apenas alterações.
- Dependentes abrem a mesma experiência, com seus próprios documentos, fidelidade e preferências.

## Documentos e anexos

- Criar uma tela individual de documento com foto principal, zoom em tela cheia, campos copiáveis, número mascarado/revelável, datas, anexos e resumo de compartilhamento.
- Criar a tabela `document_attachment` para vários anexos por documento, com dono derivado da pessoa/documento, soft delete e acesso pelo bloco **Documentos**. Migrar cada `arquivo_path` existente para um anexo principal sem apagar a coluna antiga.
- Preservar a política atual da foto de rosto como **Cadastro básico**; anexos de documentos nunca serão liberados por esse bloco.
- Adicionar, abrir/baixar e apagar anexos; manter os arquivos no bucket privado.
- Manter Novo documento sem apagar o anterior e soft delete com Desfazer.

## Adicionar documento

- Criar uma experiência dedicada com câmera, galeria, arquivo/PDF, arrastar e colar no computador.
- Ampliar a leitura atual para primeiro identificar o tipo e depois extrair os campos aplicáveis. A leitura apenas pré-preenche; o usuário sempre revisa e confirma antes de salvar.
- Exibir estado de leitura, miniatura, opção de trocar a foto, campos editáveis e botão de salvar com o tipo detectado.
- PDFs podem ser anexados; quando não houver imagem utilizável para leitura, o formulário continua manualmente.

## Fidelidade

- Criar lista completa com filtros Todos, Aéreas, Hotéis e Outros, agrupada por tipo.
- Criar tela do programa com número completo, copiar, categoria, titular, site opcional, foto do cartão e ações de edição/exclusão.
- Acrescentar campos opcionais de URL e titular ao programa e usar anexos próprios para a foto do cartão, sem misturá-la com documentos compartilháveis.

## Cofre zero-knowledge

- Criar `vault_meta` e `vault_item` com GRANTs e RLS exclusiva do proprietário (`account_id = auth.uid()`), sem qualquer chamada a `can_view` e sem acesso por compartilhamento ou dependentes.
- Cifrar login e senha no navegador com AES-GCM 256. Derivar a chave da senha do cofre usando PBKDF2-SHA256 com 600.000 iterações e salt aleatório por conta.
- Guardar no servidor somente ciphertext, IVs, salt e um verificador cifrado; a senha do cofre e a chave nunca serão enviadas.
- Manter ciphertext e metadados necessários no armazenamento offline do aparelho. A chave ficará apenas em memória, será removida ao sair/ocultar o app e após cinco minutos; senhas reveladas voltam a esconder em 30 segundos.
- Oferecer desbloqueio por senha em todos os navegadores. Ativar Face ID/biometria somente quando WebAuthn PRF estiver realmente disponível; sem PRF, mostrar a alternativa por senha, sem fingir proteção biométrica.
- Exibir claramente que não existe recuperação da senha do cofre e que o cofre nunca é compartilhado.

## Quem vê seus dados

- Substituir a tela atual por **Quem vê seus dados**, com segmentos **Eu compartilho** e **Comigo (N)**.
- Mostrar pedidos pendentes no topo, com blocos pedidos e ações Recusar e Escolher e aceitar.
- Mostrar cada acesso concedido com pessoa, data, chips de blocos/viagens e ações Mudar e Revogar.
- Na aba Comigo, abrir a mesma tela Eu da outra pessoa em modo somente leitura e mostrar apenas os blocos autorizados.
- Manter todos os blocos marcados por padrão ao aceitar convite e destacar que senhas do cofre nunca são compartilhadas.

## Migração e compatibilidade

- Fazer apenas mudanças aditivas no banco e preservar dados reais existentes.
- Converter os arquivos únicos atuais em anexos sem duplicar uploads nem quebrar leitores antigos durante a transição.
- Atualizar tipos e consultas para que cache e fila offline continuem funcionando; aumentar a versão do cache persistido para evitar misturar formatos antigos e novos.
- Manter as regras já corrigidas de compartilhamento: só o dono muda blocos/viagens, anexos respeitam o bloco correto e viagens seguem seleção explícita.

## Testes e validação

- Criar contas e pessoas descartáveis e validar: ficha inicialmente 0%; passaporte por foto; cartão e anexos; novo programa; criação/desbloqueio do cofre; edição offline.
- Confirmar no banco que não existe senha ou chave em texto puro, apenas ciphertext/IV/salt/verificador.
- Compartilhar somente Fidelidade e confirmar que o destinatário vê número/categoria, mas não consegue ler `vault_item`, nem diretamente pela API.
- Confirmar que anexos de documento exigem Documentos, dependentes usam dados próprios e pessoas compartilhadas ficam somente leitura.
- Testar desktop e viewport móvel, incluindo câmera, galeria/arquivo, zoom, copiar, filtros, bloqueio automático e modo avião.
- Executar verificação de segurança, corrigir achados relevantes, apagar contas/linhas/arquivos de teste e publicar.

## Diferenças previstas

- **Face ID:** depende de suporte real a WebAuthn PRF no navegador/aparelho. Onde não houver suporte, o desbloqueio será pela senha do cofre, conforme o requisito de fallback.
- **PDF e leitura automática:** PDFs serão aceitos como anexos; a extração automática ocorrerá quando houver imagem legível. PDFs não convertíveis no navegador seguirão para conferência manual, sem adivinhar dados.