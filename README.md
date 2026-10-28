# NEXUS SOCIAL

**A ajuda certa. No momento certo.**

NEXUS SOCIAL é uma demonstração local para organizar solicitações fictícias de alimentos e itens básicos, acompanhar atendimentos simulados e visualizar alterações registradas em cada solicitação.

## Objetivo e problema abordado

O projeto demonstra como solicitações podem ser cadastradas, consultadas, priorizadas por critérios declarados e acompanhadas por estados e histórico. Ele busca tornar esse fluxo demonstrativo organizado e compreensível, sem representar uma operação real de doações.

## Público-alvo

O MVP destina-se a demonstrações, avaliação de interface e aprendizagem sobre fluxos de solicitações e estados. Solicitantes, voluntários e moderadores são perfis simulados; não representam pessoas ou organizações reais.

## Tecnologias

- HTML5.
- CSS3, incluindo layout responsivo.
- JavaScript puro com módulos ES.
- `localStorage` para persistência neste navegador.

Não há frameworks, bibliotecas visuais, serviços externos, backend ou dependências de execução.
Playwright, ESLint e Prettier são dependências somente de desenvolvimento; o site não depende delas para funcionar.

## Funcionalidades

- Navegação entre painel, solicitações, cadastro, detalhes e histórico sem recarregar a aplicação.
- Cadastro de solicitações de alimentos não perecíveis, produtos de higiene, roupas e itens básicos de uso cotidiano.
- Validação de campos, quantidade, categoria, unidade, urgência e região aproximada.
- Pesquisa por título, descrição ou categoria, com filtros combináveis por categoria, status e urgência.
- Priorização das solicitações abertas por urgência declarada e, em seguida, pela data mais antiga.
- Indicadores de solicitações em cada status atual e lista de solicitações recentes.
- Perfis demonstrativos de solicitante, voluntário e moderador, com ações compatíveis com as transições permitidas.
- Histórico local das ações e datas relevantes.
- Renderização de texto fornecido pelo usuário como texto, sem interpretá-lo como HTML.
- Mensagens de erro, sucesso, estados vazios e apresentação responsiva.
- Histórias de impacto fictícias no painel, identificadas como conteúdo de demonstração e sem depoimentos de pessoas reais.
- Tema claro, escuro ou automático (segue o sistema), com alternância suave e preferência salva neste navegador.
- Notificações flutuantes (toasts) que não empurram o conteúdo.
- Rotas por hash: `#/painel`, `#/solicitacoes`, `#/cadastrar`, `#/historico` e `#/solicitacao/<id>` (link direto para os detalhes); o botão voltar do navegador funciona entre as telas.
- Quantidade aceita vírgula ou ponto decimal (`2,5` ou `2.5`).
- Contador de caracteres na descrição e validação de cada campo ao sair dele.
- Exportação das solicitações em arquivo JSON e carga opcional de exemplos fictícios (veja "Persistência local").

## Estrutura

```text
.gitattributes  Normalização de finais de linha LF
.gitignore      Exclusão de dependências e resultados E2E gerados
.prettierignore Exclusões do formatador
.vscode/
  settings.json Configuração legada de testes Python no VS Code, não usada pelo projeto JS
assets/
  banner-solidariedade.jpg       Imagem de banner
  Logo Nexus Social em Gradiente Tecnológico.png  Logo em PNG
  nexus-social-logo.jpg          Logo em JPEG
editorial.css   Estilos visuais complementares para cartões e seções editoriais
eslint.config.js Configuração flat do ESLint
index.html      Estrutura semântica e áreas de navegação
style.css       Identidade visual, temas claro/escuro, acessibilidade e responsividade
JavaScript/
  application.js Inicialização, roteamento e composição das telas
  backup.js      Exportação JSON e criação de solicitações de exemplo
  categories.js  Apresentação e identidade visual das categorias
  community.js  Renderização das histórias fictícias do painel
  dashboard.js  Indicadores e seleção das solicitações recentes
  demo-data.js  Dados fictícios opcionais
  icons.js      Criação e hidratação de ícones SVG
  queries.js    Consultas puras de pesquisa, filtros e ordenação
  requests.js   Modelo, validação de entrada e regras de negócio
  router.js     Navegação por hash
  script.js     Ponto de entrada mínimo da aplicação
  storage.js    Persistência, validação, versão do esquema e migração
  support.js    Cópia não utilizada do harness E2E; não importada pela aplicação ou pela suíte atual
  theme.js      Preferência de tema
  toast.js      Notificações da interface
  views/
    panel-view.js        Renderização e eventos do painel
    requests-view.js     Renderização e eventos da lista de solicitações
    request-form-view.js Validação e eventos do formulário de cadastro
    details-view.js      Renderização e eventos dos detalhes
    history-view.js      Renderização e eventos do histórico
    view-utils.js        Elementos e formatação compartilhados com texto seguro
tests/
  support.js               Armazenamento isolado e dados reutilizáveis
  requests.test.js         Testes das validações e regras de negócio
  storage.test.js          Testes de persistência e migração
  queries-dashboard.test.js Testes das consultas e indicadores
  e2e/
    support.js             Servidor local, navegador e helpers E2E
    app.test.js            Cenários E2E dos fluxos da interface
    server.test.js         Testes de acesso, segurança e MIME do servidor E2E
FASE-6-RELATORIO.md Registro dos testes e resultados da Fase 6
FASE-7-RELATORIO.md Registro da automação de interface e dos resultados da Fase 7
FASE-8-RELATORIO.md Registro da refatoração e qualidade da Fase 8
FASE-8-1-RELATORIO.md Registro dos ajustes de consolidação da Fase 8.1
package.json    Tipo de módulo ES, scripts e dependências de desenvolvimento
package-lock.json Versões reproduzíveis das dependências de desenvolvimento
README.md       Documentação do projeto
```

Não há uma pasta `docs/` neste estado do repositório; os documentos de fase ficam na raiz.

## Executar localmente

Os módulos ES devem ser servidos por HTTP; abrir `index.html` diretamente como arquivo (`file://`) não é suportado.

1. Abra a pasta do projeto no VS Code.
2. Instale ou habilite uma extensão de servidor local, como Live Server.
3. Abra `index.html` usando o comando **Open with Live Server** da extensão.
4. A aplicação será servida no navegador em um endereço local.

O projeto não exige instalação de pacotes nem configuração de backend.

## Testes automatizados

Requisito para a suíte: Node.js com `node:test`, `node:assert/strict` e `structuredClone` (validado com Node.js 24.21.0).

Instale as dependências de desenvolvimento uma vez:

```powershell
npm install
```

Os testes unitários e de integração continuam disponíveis sem Playwright:

```powershell
npm test
```

A suíte usa somente armazenamento em memória temporário; não abre o navegador pessoal nem acessa o `localStorage` real da aplicação. Cada teste que precisa de persistência instala sua própria instância simulada e a restaura ao terminar.

Os testes E2E usam Playwright com Chromium em modo headless. O executor procura Chrome/Edge instalado no sistema; para escolher outro executável, defina `NEXUS_BROWSER_PATH`. Se não houver navegador de sistema, instale o Chromium gerenciado pelo Playwright:

```powershell
npx playwright install chromium
npm run test:e2e
```

Execute apenas os testes de navegador com:

```powershell
npm run test:e2e
```

Ou execute testes unitários, de integração e de navegador juntos:

```powershell
npm run test:all
```

Verifique regras de qualidade e consistência de formatação com:

```powershell
npm run lint
npm run format:check
```

Para aplicar Prettier aos arquivos suportados do projeto:

```powershell
npm run format
```

O servidor E2E escuta somente em `127.0.0.1` numa porta efêmera e atende arquivos de `index.html`, `style.css`, `editorial.css`, `JavaScript/` e `assets/`, sem lista de módulos individuais. Ele restringe caminhos à raiz permitida, bloqueia arquivos ocultos e áreas de teste/dependências, e aceita somente `GET` e `HEAD`. Cada caso cria um contexto Playwright novo, com `localStorage` isolado e descartado ao fechar; nenhum perfil habitual ou dado persistido do usuário é usado. Em falhas E2E, capturas de tela são gravadas em `test-results/` (diretório ignorado pelo Git); os diagnósticos de console, erros JavaScript, requisições falhas e respostas HTTP de erro aparecem na saída do runner.

Categorias cobertas:

- **Unitários:** validação/cadastro, normalização de pesquisa, filtros combinados, ordenação, priorização e cálculos de indicadores.
- **Integração:** armazenamento versionado, migração com backup, operações de status, histórico e falhas de gravação sem atualização parcial.
- **Regressão:** preservação de dados corrompidos/incompatíveis, separação entre conclusão e recebimento, bloqueio de transições indevidas e ausência de mutação dos dados na consulta.
- **Interface E2E:** inicialização, navegação, formulários e persistência, busca/filtros, transições pelo UI, histórico/detalhes, texto HTML literal, erros de navegador, menu por teclado e larguras 320, 360, 390, 768 e 1280 px.
- **Servidor E2E:** acesso a módulos criados sob demanda, bloqueio de traversal/arquivos privados, métodos HTTP permitidos e MIME JavaScript.

Os testes E2E usam navegador real, mas não equivalem a uma auditoria completa de acessibilidade ou conformidade WCAG. Leitores de tela, contraste abrangente, diferentes motores de navegador e comportamento em dispositivos físicos continuam precisando de verificações manuais. Consulte os relatórios [Fase 6](./FASE-6-RELATORIO.md), [Fase 7](./FASE-7-RELATORIO.md), [Fase 8](./FASE-8-RELATORIO.md) e [Fase 8.1](./FASE-8-1-RELATORIO.md) para resultados e decisões efetivamente registrados.

## Persistência local

As solicitações são armazenadas na chave `nexusSocial.requests` como um envelope JSON com `schemaVersion: 2` e a coleção `requests`. A migração de dados do esquema 1 cria uma cópia de segurança com o prefixo `nexusSocial.requests.backup.v1.` antes de gravar o novo esquema.

Na primeira abertura sem dados, a aplicação inicializa uma coleção vazia. Ela não carrega nem restaura registros demonstrativos automaticamente. Falhas de leitura, dados corrompidos, versões incompatíveis e falhas de gravação são informadas; dados inválidos ou incompatíveis não são sobrescritos silenciosamente.

Os dados pertencem somente ao armazenamento local deste navegador e podem ser modificados ou apagados pelo usuário. Não existe sincronização entre navegadores ou dispositivos.

Uma abertura sem dados continua começando com uma coleção vazia. Dois botões no painel principal trabalham com os dados locais:

- **Exportar backup (JSON):** baixa uma cópia das solicitações. Não há importação nesta versão.
- **Carregar exemplos:** após confirmação, **acrescenta** solicitações fictícias que ainda não existem (comparadas pelo título). Nunca altera, substitui nem remove solicitações existentes; os exemplos passam pela mesma validação e gravação do cadastro comum.

O tema escolhido fica na chave separada `nexusSocial.theme`.

## Estados e regras

| Estado                   | Significado demonstrativo                                      |
| ------------------------ | -------------------------------------------------------------- |
| `aberto`                 | Disponível para atendimento                                    |
| `em_atendimento`         | Atribuído ao perfil de voluntário                              |
| `conclusao_declarada`    | Conclusão declarada pelo voluntário                            |
| `recebimento_confirmado` | Recebimento confirmado na demonstração, sem verificação física |
| `cancelado`              | Cancelado e indisponível para nova atribuição                  |
| `suspenso_para_revisao`  | Temporariamente indisponível para revisão                      |

As transições são centralizadas em `requests.js` e verificadas também pelo armazenamento. A atribuição exige estado aberto; desistência válida devolve ao estado aberto; conclusão não confirma automaticamente recebimento. Cancelamento, suspensão e reabertura exigem justificativa. A reabertura preserva os eventos anteriores e as datas históricas.

O seletor de perfil aplica regras de demonstração na interface e nas funções de negócio, mas não é autenticação nem autorização segura: usuários podem alterar o perfil ou o conteúdo do `localStorage`.

## Priorização

As solicitações abertas são ordenadas por urgência declarada, na ordem **alta, média, baixa**. Solicitações com a mesma urgência são ordenadas pela data de criação mais antiga; o identificador desempata datas iguais. Os demais status são apresentados em grupos separados.

A urgência é informada pelo solicitante, não tem comprovação independente e não determina quem merece receber ajuda. A ordenação não é uma avaliação objetiva da necessidade.

## Histórico e indicadores

O histórico é gerado pelas operações de negócio e preservado nas atualizações. É local e pode ser alterado pelo usuário; não constitui uma auditoria inviolável.

Os seis indicadores contam solicitações pelo **status atual**. Conclusão declarada e recebimento confirmado são categorias separadas. Uma solicitação cancelada não é contada como concluída, e eventos antigos de uma solicitação reaberta não são somados aos indicadores atuais.

## Limitações

Esta versão não possui:

- Backend, banco de dados remoto ou sincronização.
- Autenticação real ou autorização segura.
- Coordenação confiável entre perfis, usuários ou dispositivos.
- Verificação física de entrega ou confirmação independente de recebimento.
- Garantia de integridade ou imutabilidade dos dados e do histórico.
- Operação, suporte ou validação para atendimento de pessoas reais.

Não use este MVP para organizar uma operação real de doações ou tomar decisões sobre acesso à ajuda.

## Próximas versões possíveis

- Ampliar gradualmente a cobertura E2E para outros motores de navegador e cenários de acessibilidade.
- Melhorias adicionais de navegação assistiva e avaliação contínua de acessibilidade.
- Exportação/importação local com confirmação explícita e cópia de segurança.
- Pesquisa e indicadores adicionais definidos com critérios transparentes.
- Caso o projeto evolua para operação real, avaliação de requisitos de privacidade, segurança, governança e infraestrutura antes de qualquer implementação de backend.

Esses itens são possibilidades futuras, não funcionalidades incluídas no MVP.

## Validação

A suíte unitária e de integração em `tests/` pode ser executada com `npm test`; os fluxos de interface automatizados podem ser executados com `npm run test:e2e`. `npm run lint` e `npm run format:check` verificam, respectivamente, as regras estáticas e o padrão Prettier; `npm run format` aplica a formatação. Essas verificações não substituem uma auditoria completa de acessibilidade nem testes em todos os navegadores e dispositivos. Consulte os relatórios [Fase 6](./FASE-6-RELATORIO.md), [Fase 7](./FASE-7-RELATORIO.md), [Fase 8](./FASE-8-RELATORIO.md) e [Fase 8.1](./FASE-8-1-RELATORIO.md) para resultados efetivamente executados e limitações.
