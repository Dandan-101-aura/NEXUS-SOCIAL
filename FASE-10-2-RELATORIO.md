# FASE 10.2 — Pré-publicação responsável

## Escopo e resultados

A árvore de trabalho estava limpa antes do início. A linha de base de
`npm run test:all`, registrada antes das alterações, foi **60/60**: 41 testes
unitários/de integração e 19 E2E. Não foram adicionadas dependências nem
alteradas regras de negócio, dados persistidos ou chaves de armazenamento.

Resultado final: **64 testes** — 41 unitários/de integração e 23 E2E, sem
falhas. Os quatro E2E novos cobrem a guarda local, a tela “Sobre os dados”, a
classificação/medição de contraste dos Heros e o contraste do dock, dos toasts
e do diálogo de importação. O teste móvel existente foi ajustado somente para
verificar o dock visível com quatro links e o menu lateral inerte.

| Verificação                             | Resultado                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run test:all` antes das alterações | 41 unitários/de integração + 19 E2E = 60/60                                                       |
| `npm run test:all` final                | 41 unitários/de integração + 23 E2E = 64/64                                                       |
| `npm run lint`                          | Aprovado                                                                                          |
| `npm run format:check`                  | Aprovado                                                                                          |
| Guarda E2E                              | Nove rotas; nenhuma requisição/referência externa ou cookie                                       |
| Axe                                     | 32 estados da matriz existente e quatro combinações da tela nova; zero violações serious/critical |

O axe registrou um item `color-contrast` como incompleto na matriz existente,
que requer análise visual de fundos compostos. Esse item foi verificado pelas
medições abaixo. Nenhum resultado é declaração ou garantia de conformidade
legal ou de acessibilidade.

## A. Inventário de imagens e créditos

Há cinco imagens em `assets/`; nenhuma foi removida. A autoria, a licença e a
URL de origem não puderam ser confirmadas no código ou nos metadados
disponíveis. O inventário público completo está em
[assets/CREDITOS.md](./assets/CREDITOS.md); os campos não verificáveis foram
mantidos como `[A PREENCHER PELO AUTOR]` e a origem de geração por IA como
“desconhecido”.

| Arquivo                                          | Uso localizado                                                    | Legenda/alternativa                               |
| ------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------- |
| `background-light.jpg`                           | Fundo decorativo do tema claro, via CSS em `style.css`            | Fundo CSS decorativo, sem informação essencial    |
| `background-dark.jpg`                            | Fundo decorativo do tema escuro, via CSS em `style.css`           | Fundo CSS decorativo, sem informação essencial    |
| `banner-solidariedade.jpg`                       | Fundo do Hero do painel, referenciado em `index.html`             | `.welcome-photo-credit`: **“Imagem ilustrativa”** |
| `nexus-social-logo.jpg`                          | Logo no cabeçalho público, navegação lateral e topo do aplicativo | `alt="NEXUS SOCIAL"`                              |
| `Logo Nexus Social em Gradiente Tecnológico.png` | Nenhum uso localizado em HTML, CSS ou JavaScript                  | Arquivo mantido; não removido                     |

A legenda da prévia pública, também exibida como `<figcaption>`, é
**“Prévia ilustrativa do painel · use “Abrir a demonstração” para interagir”**.
Não há crédito de autor/fonte visível nas imagens. O lema “A ajuda certa. No
momento certo.” aparece como texto na apresentação pública e no aplicativo; não
depende do logotipo.

As imagens HTML têm texto alternativo. O eventual avatar fotográfico das
histórias recebe `alt` descritivo; os avatares atuais são iniciais com nome
acessível. Os SVGs de ícone recebem `aria-hidden="true"`. As imagens de fundo
CSS são decorativas.

## B. Conteúdo fictício, promessas e alterações de texto

### Revisão do conteúdo visível

- **Hero do painel:** agora se identifica como demonstração local, descreve
  pedidos fictícios e oferece “Cadastrar pedido de exemplo”. Não afirma
  conectar pessoas a uma operação real ou garantir ajuda.
- **Citação em destaque (`.pull-quote`):** o texto permanece
  **“Ninguém precisa pedir ajuda sozinho.”**. A própria interface exibe o rótulo
  **“Conteúdo fictício de demonstração”** e a legenda
  **“Frase ilustrativa, não é depoimento”**.
- **Comunidade/histórias:** o título é “Histórias fictícias de exemplo” e a
  nota visível informa que histórias, citações e personagens não representam
  pessoas reais. Os exemplos atuais incluem Marta S., Seu Antônio e Camila R.;
  suas falas são ilustrações, não depoimentos:
  - “Levei duas sacolas e voltei com a certeza de que o bairro cuida de si
    mesmo.”
  - “Ninguém aqui pergunta quem você é. Só pergunta do que você precisa.”
  - “Pedi com vergonha e recebi com carinho. Foi assim que voltei a respirar.”
- **Indicadores:** o rótulo visível “Conteúdo fictício de demonstração” precede
  a explicação de que as contagens são solicitações por estado atual, não
  pessoas atendidas nem total histórico de eventos.
- **Hero da apresentação pública:** o título é “A ajuda certa. No momento
  certo.” e o texto diz “Explore pedidos fictícios: cadastre uma solicitação,
  alterne entre três perfis simulados e acompanhe as alterações no histórico
  local.”. A nota visível é “Este projeto é uma demonstração local. Não
  organiza doações reais nem confirma entregas físicas.”. A prévia dos três
  perfis recebe o rótulo “Conteúdo fictício de demonstração”.
- **Notas de demonstração:** a apresentação e o painel informam que são uma
  demonstração local e que não há backend/autenticação real ou confirmação
  física de entregas.
- **README:** agora explicita a natureza fictícia, o aviso de não inserir dados
  pessoais reais, a persistência apenas no navegador e a ausência de envio a
  servidores, cookies, analytics e recursos de terceiros.

### Alterações de texto da interface

| Local                       | Antes                                                                                                                                                                                                  | Depois                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nota da prévia pública      | “Perfis simulados · dados locais e fictícios”                                                                                                                                                          | “Conteúdo fictício de demonstração”                                                                                                                                                                                                                     |
| Kicker do Hero do painel    | “AÇÃO SOCIAL & SOLIDARIEDADE”                                                                                                                                                                          | “DEMONSTRAÇÃO LOCAL”                                                                                                                                                                                                                                    |
| Descrição do Hero do painel | “Conectando quem precisa de alimentos e itens essenciais a voluntários dispostos a fazer a diferença na comunidade.”                                                                                   | “Explore a interface com pedidos fictícios de alimentos e itens básicos, sem representar uma operação real.”                                                                                                                                            |
| Ação do Hero do painel      | “Pedir ajuda”                                                                                                                                                                                          | “Cadastrar pedido de exemplo”                                                                                                                                                                                                                           |
| Destaque lateral do Hero    | “Comunidade Ativa” / “Solidariedade direta, transparente e local”                                                                                                                                      | “Conteúdo fictício de demonstração” / “Dados fictícios neste navegador”                                                                                                                                                                                 |
| Legenda da citação          | “Princípio da plataforma”                                                                                                                                                                              | “Frase ilustrativa, não é depoimento”; também foi acrescentado o rótulo visível “Conteúdo fictício de demonstração”                                                                                                                                     |
| Nota dos indicadores        | “Os indicadores mostram a quantidade de solicitações em cada status atual; não representam o total histórico de eventos. Conclusões declaradas e recebimentos confirmados são contados separadamente.” | “Conteúdo fictício de demonstração. Indicadores locais mostram a quantidade de solicitações em cada status atual, não pessoas atendidas nem o total histórico de eventos. Conclusões declaradas e recebimentos confirmados são contados separadamente.” |
| Título da comunidade        | “Histórias de impacto”                                                                                                                                                                                 | “Histórias fictícias de exemplo”                                                                                                                                                                                                                        |
| Nota da comunidade          | “Histórias fictícias, escritas para esta demonstração. Nomes e frases não pertencem a pessoas reais.”                                                                                                  | “Conteúdo fictício de demonstração. As histórias, citações e personagens abaixo não representam pessoas reais.”                                                                                                                                         |
| Formulário                  | Sem aviso específico de demonstração junto aos campos                                                                                                                                                  | “Demonstração: não informe dados pessoais reais. Os dados ficam apenas neste navegador.”                                                                                                                                                                |
| Exemplos carregáveis        | “Os exemplos também são acrescentados sem substituir registros.”                                                                                                                                       | “Conteúdo fictício de demonstração. Os exemplos também são acrescentados sem substituir registros.”                                                                                                                                                     |

### Alterações de documentação

| Arquivo/seção            | Antes                                                                                                                                                                                                                                                           | Depois                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRODUCT.md`, Stack      | “A única dependência externa de runtime são as fontes do Google Fonts.”                                                                                                                                                                                         | “As fontes são arquivos locais em `assets/fonts/`; não há requisições da aplicação a serviços de terceiros.”                                                                                                                                                                                                            |
| `PRODUCT.md`, propósito  | “O NEXUS SOCIAL é uma demonstração local de uma rede de apoio comunitário para organizar solicitações fictícias de alimentos e itens básicos, acompanhar o atendimento e consultar o histórico de cada pedido. Seu slogan é ‘A ajuda certa. No momento certo.’” | “O NEXUS SOCIAL é uma demonstração local, sem fins comerciais, de uma rede de apoio comunitário para organizar solicitações fictícias de alimentos e itens básicos, acompanhar o atendimento e consultar o histórico de cada pedido. Não representa uma operação real. Seu slogan é ‘A ajuda certa. No momento certo.’” |
| `PRODUCT.md`, restrições | Sem descrição da tela nem inventário de créditos.                                                                                                                                                                                                               | Acrescenta: “A tela `#/sobre-dados` descreve o armazenamento local, como apagar os dados e os placeholders de autoria/contato.” e “`assets/CREDITOS.md` registra os ativos visuais e fontes; dados de origem e licença não verificados permanecem para preenchimento do autor.”                                         |
| `README.md`, tecnologia  | “Não há frameworks, bibliotecas visuais, serviços externos, backend ou dependências de execução.”                                                                                                                                                               | “Não há frameworks, bibliotecas visuais, serviços externos, backend ou dependências de execução. As fontes usadas pela interface são arquivos locais em `assets/fonts/`.”                                                                                                                                               |
| `README.md`, histórias   | “Histórias de impacto fictícias no painel, identificadas como conteúdo de demonstração e sem depoimentos de pessoas reais.”                                                                                                                                     | “Histórias e citações fictícias no painel, identificadas como conteúdo de demonstração e sem depoimentos de pessoas reais.”                                                                                                                                                                                             |
| `README.md`, rotas       | A lista não continha `#/sobre-dados`.                                                                                                                                                                                                                           | Inclui a nova rota e o módulo de tela correspondente na estrutura.                                                                                                                                                                                                                                                      |
| `README.md`, privacidade | Seção inexistente.                                                                                                                                                                                                                                              | Nova seção “Privacidade, conteúdo e licenças” resume os dados locais, o aviso de demonstração, os créditos e a tela informativa.                                                                                                                                                                                        |

O texto integral acrescentado na nova seção do README é:

> O NEXUS SOCIAL é uma demonstração local, sem fins comerciais; os pedidos,
> perfis, histórias e exemplos são fictícios. Não informe dados pessoais reais
> no formulário. Os dados permanecem neste navegador, em `nexusSocial.requests`
> e `nexusSocial.theme`, além de cópias locais de importação (até três) e
> eventuais cópias de migração. A aplicação não envia esses dados a servidores,
> não usa cookies ou analytics e não carrega scripts, fontes ou outros recursos
> de terceiros; as fontes disponíveis são arquivos locais do projeto. Backups
> exportados são baixados para o dispositivo de quem os exporta.
>
> Use **Sobre os dados** no rodapé ou abra `#/sobre-dados` para consultar o que
> fica no navegador e como apagar os dados, limpando os dados deste site nas
> configurações do navegador. O inventário de origem, autoria e licença das
> imagens e fontes está em [assets/CREDITOS.md](./assets/CREDITOS.md);
> informações não verificáveis foram deixadas como pendência para o autor. Não
> há afirmação de conformidade legal. O texto informativo da tela não substitui
> orientação jurídica.

A tela nova acrescenta textos sobre armazenamento e limpeza, autoria/contato
como `[NOME DO AUTOR]` e `[CONTATO]`, e a frase “Este texto é informativo e
não substitui orientação jurídica.”. Foram acrescentados links “Sobre os
dados” aos rodapés público e do aplicativo.

## C. Inventário dos campos do formulário

Todos os campos permanecem obrigatórios conforme a validação e os fluxos
existentes. Não há campos dedicados a nome, telefone, endereço preciso ou
documento. Texto livre e localização aproximada ainda podem receber dados
pessoais por engano; o aviso não impede tecnicamente essa entrada.

| Campo                 | Finalidade na demonstração          | Obrigatório | Tipo de dado e observação                                                      |
| --------------------- | ----------------------------------- | ----------: | ------------------------------------------------------------------------------ |
| Título da solicitação | Identificar o pedido fictício       |         Sim | Texto livre, 4–100 caracteres; pode conter identificação digitada pelo usuário |
| Categoria             | Classificar os itens                |         Sim | Seleção de opções                                                              |
| Descrição             | Descrever os itens necessários      |         Sim | Texto livre, até 1.000 caracteres; não incluir dados pessoais                  |
| Quantidade            | Informar a quantidade de itens      |         Sim | Texto com entrada decimal                                                      |
| Unidade de medida     | Identificar a unidade               |         Sim | Seleção de opções                                                              |
| Região aproximada     | Indicar bairro, município ou região |         Sim | Texto livre, até 80 caracteres; não informar endereço exato                    |
| Urgência declarada    | Registrar a prioridade declarada    |         Sim | Seleção de opções; não comprova necessidade                                    |

Título, descrição e região são os pontos de maior risco de entrada acidental de
identificação. Foram mantidos obrigatórios para preservar as validações e o
fluxo já cobertos pelos testes; a regra do formulário continua pedindo apenas
região aproximada e não é uma garantia contra todo dado identificável.

## D. Tela “Sobre os dados”

A rota `#/sobre-dados` fica acessível pelos rodapés público e do aplicativo e
não foi adicionada ao dock. A tela informa que o projeto é uma demonstração
local, sem fins comerciais e com dados fictícios; descreve as chaves
`nexusSocial.requests` e `nexusSocial.theme`, cópias de importação
`nexusSocial.requests.backup.import.*` (retenção de três) e possíveis cópias de
migração `nexusSocial.requests.backup.v1.*`; explica como limpar os dados do
site e que backups exportados ficam no dispositivo. Inclui os placeholders de
autoria/contato e o aviso informativo jurídico.

A tela tem `h1` focável ao navegar, título de documento, suporte aos temas claro
e escuro e conteúdo renderizado por `JavaScript/views/data-privacy-view.js`,
sem acesso direto ao `localStorage`.

## E. Recursos externos e fontes

As únicas referências de terceiros encontradas antes da remoção eram os links
Google Fonts em `index.html` (linhas da versão anterior):

| Arquivo e linhas anteriores | Recurso removido                                            |
| --------------------------- | ----------------------------------------------------------- |
| `index.html:29`             | `preconnect` para `https://fonts.googleapis.com`            |
| `index.html:30`             | `preconnect` para `https://fonts.gstatic.com`               |
| `index.html:31–34`          | Folha Google Fonts para Inter, Plus Jakarta Sans e Fraunces |

As três referências foram removidas e substituídas pela folha local
`assets/fonts/fonts.css`. A busca atual em HTML, CSS e JavaScript encontrou
somente o namespace SVG `http://www.w3.org/2000/svg` e endereços de loopback do
servidor E2E; nenhum deles é uma requisição de terceiro do aplicativo. Não foi
encontrado manifesto com referências externas, `@import` externo, `url(http…)`
ou recurso remoto.

| Arquivo local                              | Declaração                                                             | Licença/origem           |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------ |
| `fonts/inter-normal-400.woff2`             | Inter normal variável, pesos 400–700; `font-display: swap`             | [A PREENCHER PELO AUTOR] |
| `fonts/plus-jakarta-sans-normal-600.woff2` | Plus Jakarta Sans normal variável, pesos 600–800; `font-display: swap` | [A PREENCHER PELO AUTOR] |
| `fonts/fraunces-normal-500.woff2`          | Fraunces normal variável, pesos 500–700; `font-display: swap`          | [A PREENCHER PELO AUTOR] |
| `fonts/fraunces-italic-500.woff2`          | Fraunces itálica, peso 500; `font-display: swap`                       | [A PREENCHER PELO AUTOR] |

Os três nomes com peso no sufixo `400`, `600` e `500` são arquivos variáveis
que atendem aos intervalos acima; o nome reflete somente o primeiro peso. Não
foram baixadas fontes. A autoria/licença precisa ser verificada pelo autor.

## F. Verificações visuais, acessibilidade e guarda

### Visual e axe

A apresentação pública e a tela `#/sobre-dados` foram verificadas em ambos os
temas, em `1280x900` e `360x740`. As fontes locais carregaram, o texto não teve
corte visual e não houve rolagem horizontal. O Hero público usa `76,8px` no
desktop e `46,4px` no celular; o `h1` de “Sobre os dados” usa `43,2px` e
`30,4px`, respectivamente. Capturas visuais foram feitas nos temas claro e
escuro.

A matriz existente cobriu 32 combinações de estado, tema e viewport; a tela
nova foi examinada nas quatro combinações. O axe encontrou zero violações no
relatório e zero violações serious/critical. Um resultado incompleto de
contraste em imagem/fundo composto foi complementado pela medição em pixels
abaixo. Isso não constitui garantia de conformidade.

### Guarda automatizada

O E2E novo percorre nove rotas, incluindo a apresentação sem hash e
`#/sobre-dados`. Em cada rota, confirma que `document.cookie` está vazio,
intercepta requisições para origens diferentes da origem local e verifica
`script`, `link`, `iframe` e `img` (incluindo `srcset`) sem referências
externas. Resultado: **nenhuma requisição externa, referência externa ou
cookie**.

### Contraste — Heros e apresentação pública

A classificação usa tamanho e peso computados: texto grande a partir de 24px,
ou a partir de 18,66px com peso 700 ou maior; os demais são texto normal. A
medição amostrou os fundos efetivamente renderizados em claro/escuro e nos dois
viewports. As colunas de contraste registram o menor resultado entre os
viewports de cada tema.

| Área/alvo                                    | Tamanho computado (desktop/celular) e peso | Classe |   Claro |  Escuro |
| -------------------------------------------- | -----------------------------------------: | ------ | ------: | ------: |
| Apresentação — `.public-how-link`            |                               14,4px / 600 | Normal | 15,15:1 | 14,61:1 |
| Apresentação — `.public-nav .button-primary` |                         13,6/13,12px / 600 | Normal |  6,06:1 |  7,69:1 |
| Apresentação — `#public-title`               |                          76,8/46,4px / 600 | Grande | 11,72:1 | 15,16:1 |
| Apresentação — `#public-title em`            |                          76,8/46,4px / 500 | Grande |  4,56:1 |  7,31:1 |
| Apresentação — parágrafo do Hero             |                           17,28/16px / 400 | Normal |  5,01:1 |  8,13:1 |
| Apresentação — botão principal do Hero       |                               13,6px / 600 | Normal |  6,06:1 |  7,69:1 |
| Apresentação — `.public-secondary-link`      |                               14,4px / 600 | Normal | 14,21:1 |  5,76:1 |
| Apresentação — nota de demonstração          |                              13,28px / 400 | Normal |  7,58:1 |  8,56:1 |
| Apresentação — legenda da prévia             |                              12,16px / 400 | Normal |  5,06:1 |  4,83:1 |
| Hero do painel — `.welcome-kicker`           |                              11,52px / 800 | Normal |  9,79:1 |  9,79:1 |
| Hero do painel — título                      |                          54,4/33,6px / 600 | Grande | 18,77:1 | 18,81:1 |
| Hero do painel — título em itálico           |                          54,4/33,6px / 500 | Grande | 13,00:1 | 13,04:1 |
| Hero do painel — descrição                   |                               15,2px / 400 | Normal | 17,52:1 | 17,70:1 |
| Hero do painel — botão claro                 |                               13,6px / 600 | Normal |  6,06:1 |  6,06:1 |
| Hero do painel — botão contornado            |                               13,6px / 600 | Normal | 12,74:1 | 13,08:1 |
| Hero do painel — crédito da foto             |                              11,52px / 400 | Normal |  6,47:1 |  6,56:1 |
| Hero do painel — etiqueta do destaque        |                               12,8px / 400 | Normal | 17,15:1 | 17,38:1 |

Todos os alvos ficaram acima do limite usado na medição: 4,5:1 para texto
normal e 3:1 para texto grande.

### Contraste — dock, toasts e diálogo

Medição em `360x740`, nos temas claro e escuro. Cada rótulo do dock foi
amostrado no topo, meio e fim da rolagem. As razões abaixo são os mínimos entre
as três posições. Todos os alvos são texto normal pelo tamanho/peso computados.

| Alvo                       | Tamanho/peso | Posições         |   Claro |  Escuro |
| -------------------------- | -----------: | ---------------- | ------: | ------: |
| Dock — Painel              | 11,2px / 650 | Topo, meio e fim | 14,77:1 | 11,19:1 |
| Dock — Solicitações        | 11,2px / 650 | Topo, meio e fim | 14,74:1 | 11,19:1 |
| Dock — Cadastrar           | 11,2px / 650 | Topo, meio e fim | 14,77:1 | 11,23:1 |
| Dock — Histórico           | 11,2px / 650 | Topo, meio e fim | 17,85:1 | 15,16:1 |
| Toast de erro              | 13,6px / 500 | `360x740`        | 17,07:1 | 14,03:1 |
| Toast de sucesso           | 13,6px / 500 | `360x740`        | 16,96:1 | 12,10:1 |
| Diálogo — título           | 19,2px / 600 | `360x740`        | 17,85:1 | 15,16:1 |
| Diálogo — descrição        |   14px / 400 | `360x740`        |  7,58:1 |  8,56:1 |
| Diálogo — resumo da prévia |   15px / 650 | `360x740`        | 17,85:1 | 15,16:1 |
| Diálogo — cancelar         | 13,6px / 600 | `360x740`        | 17,85:1 | 15,16:1 |
| Diálogo — confirmar        | 13,6px / 600 | `360x740`        |  5,32:1 |  7,69:1 |

Nenhum alvo medido ficou abaixo de 4,5:1. Os valores são medições desta
interface e destes cenários, não garantia de conformidade.

## Pendências para o autor

- Preencher em `assets/CREDITOS.md` a autoria/fonte, licença e URL de origem de
  cada imagem e fonte.
- Informar, após confirmação, se cada imagem ou fonte foi gerada por IA.
- Revisar a origem e a permissão de uso da citação e dos exemplos fictícios
  antes de eventual publicação, mesmo com seus rótulos visíveis.
- Substituir `[NOME DO AUTOR]` e `[CONTATO]` na tela de dados.
- Manter o aviso de demonstração e o pedido para não inserir dados reais caso
  o projeto seja publicado.

## Arquivos da fase

Arquivos alterados: `index.html`, `style.css`, `editorial.css`, `public.css`,
`assets/fonts/fonts.css`, `JavaScript/application.js`, `JavaScript/router.js`,
`README.md`, `PRODUCT.md`, `tests/e2e/app.test.js` e `tests/e2e/support.js`.

Arquivos criados: `JavaScript/views/data-privacy-view.js`,
`assets/CREDITOS.md`, `tests/e2e/publication.test.js` e
`FASE-10-2-RELATORIO.md`.

Arquivos removidos: nenhum.
