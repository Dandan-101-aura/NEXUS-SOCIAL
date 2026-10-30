# Relatório da Fase 10 — acessibilidade

## Linha de base antes das alterações

`git status --short` não mostrou arquivos modificados ou não rastreados antes do início; o branch estava limpo.

| Momento                     | Comando            | Resultado                                                                   |
| --------------------------- | ------------------ | --------------------------------------------------------------------------- |
| Antes de qualquer alteração | `npm run test:all` | **51 aprovados**, 36 unitários/integração e 15 E2E; 0 falhas e 0 ignorados. |

O histórico da Fase 9 registra 50 testes (36 + 14). A árvore de trabalho limpa já continha um E2E adicional para a página Hero, por isso o valor executado nesta fase foi 51. O teste não foi removido nem alterado para reconciliar essa diferença.

## Diagnóstico do que já existia

- **Landmarks:** a apresentação possui `main`, `header`, `nav` e `footer`; o painel possui `header`, `aside` nomeado, `nav`, `main` e `footer`.
- **Títulos:** cada painel principal tem um `h1`; títulos secundários e títulos de cartões usam níveis inferiores. Os cabeçalhos das páginas não tinham `tabindex="-1"`.
- **Skip links:** havia um link no início da página pública e outro no início do shell do aplicativo, ambos visíveis ao receber foco. O skip link do shell ficava fora de um landmark e era reportado por axe.
- **Formulário:** todos os campos tinham `label`, `aria-describedby` apontando para mensagens de campo e feedback por `aria-invalid`. A validação focava o primeiro campo inválido; não havia resumo de erros com links para os campos.
- **Anúncios:** havia `aria-live="polite"` na região global de toasts, e cada toast usava `role="status"` ou `role="alert"`. Notificações tinham botão de dispensa, pausa ao receber foco/hover e duração padrão de 4,5 s (8 s para erro); não moviam o foco intencionalmente.
- **Dialogs:** ambos eram `<dialog>` nativos, abertos com `showModal()`, com rótulos via `aria-labelledby`; o diálogo de importação também tinha `aria-describedby`. A abertura modal tornava o fundo inerte e o Escape fechava o diálogo; o foco inicial e o retorno do foco à origem eram tratados no código. A contenção de foco por Tab ainda não estava verificada. O teste de teclado desta fase encontrou que Shift+Tab podia levar o foco ao `body` no Chromium, então foi adicionada contenção explícita para os dois dialogs e validada por E2E.
- **Foco de rota:** o roteador atualizava `document.title`, mas levava o foco ao `<main>`, não ao título da tela. A carga inicial não movia o foco.
- **Movimento:** havia regras `prefers-reduced-motion` globais em `style.css` e específicas para cartões/status em `editorial.css`. O contador do painel era animado em JavaScript por `requestAnimationFrame`, sem respeitar essa preferência.
- **Status e urgência:** cartões exibiam rótulos textuais além das cores; a urgência tinha texto “Urgência baixa/média/alta”.
- **Views e armazenamento:** módulos em `JavaScript/views/` não acessam `localStorage`; os testes de importação da Fase 9 já cobriam Escape, cancelamento e foco restaurado e foram mantidos.

### Diálogo de importação — verificação do estado inicial

O componente era um `<dialog>` nativo e possuía rótulo acessível por `aria-labelledby="import-dialog-title"`. `showModal()` ativava o modo modal nativo; o código focava explicitamente o botão de cancelar após abrir e registrava o botão de importação como opener para restaurar o foco ao fechar. A prévia de erro tinha `role="alert"`, além do anúncio da prévia. A verificação de teclado encontrou que o foco podia escapar ao usar Shift+Tab no diálogo de ação no Chromium; a contenção explícita foi então adicionada aos dois dialogs. A validação E2E agora verifica foco inicial, ciclo por Tab/Shift+Tab e retorno ao opener. Os testes existentes de cancelamento de importação por botão e Escape foram preservados.

## Auditoria axe antes das correções

Foi adicionada a dependência de desenvolvimento `@axe-core/playwright` e executado o novo teste E2E com as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` e `best-practice`. O teste varreu 32 combinações: apresentação pública, painel, lista, cadastro vazio, cadastro com erros, detalhes com solicitação criada pelo formulário, histórico e diálogo de importação com backup schema 2; tema claro/escuro e viewports 1280×900/360×740. O navegador foi configurado com `prefers-reduced-motion: reduce`.

**Resultado inicial:** 32 execuções de axe; 9 tiveram a violação `serious` `color-contrast` e 25 tiveram a violação `moderate` tagged como `best-practice` `region`. Nenhuma violação `critical` foi observada. Os 5 nós com contraste insuficiente eram:

| Seletor                                                                          | Medição axe | Foreground / fundo    | Critério reportado |
| -------------------------------------------------------------------------------- | ----------: | --------------------- | -----------------: |
| `.is-active > span:nth-child(2)`                                                 |      4,42:1 | `#067b98` / `#e4f7fb` |              4,5:1 |
| `#dashboard-empty > .button-primary[data-navigate="new-request"][type="button"]` |      4,07:1 | `#ffffff` / `#0789a8` |              4,5:1 |
| `.page-heading > .button-primary[data-navigate="new-request"][type="button"]`    |      4,07:1 | `#ffffff` / `#0789a8` |              4,5:1 |
| `#request-submit`                                                                |      4,07:1 | `#ffffff` / `#0789a8` |              4,5:1 |
| `#details-nav-link > span:nth-child(2)`                                          |      4,42:1 | `#067b98` / `#e4f7fb` |              4,5:1 |

As violações de contraste apareceram em 9 scans claros, nos estados em que esses controles estavam renderizados. Não foram observadas violações `minor` nem outras violações `moderate`.

**Best-practice:** `region` — o link `a[href$="#main-content"]` do shell do app não estava contido por landmark. Apareceu nas telas do app; não apareceu na página pública.

### Resultados `incomplete` iniciais

O axe reportou `aria-prohibited-attr` como `incomplete` para `.public-panel-preview`: `aria-label` estava num `div` genérico sem role que o suporte. A decisão é atribuir `role="group"` ao agrupamento identificado, sem criar um landmark redundante.

O axe também reportou `color-contrast` como `incomplete` nos 32 scans, pois não consegue determinar a cor de fundo em gradientes, sobreposições e pseudo-elementos. Foram observados estes alvos:

- O axe agrupou **79 alvos únicos**, em quatro contextos de tema/viewports. Apresentação pública: `.public-how-link`, `#public-title`, `#public-title > em`, `.public-hero-copy > p:nth-child(2)`, `.public-secondary-link`, `.public-demo-note > span:nth-child(2)`, `.public-hero-visual > figcaption`, `#public-flow-title`, `.public-flow-heading > p`, `li:nth-child(1) > h3`, `li:nth-child(1) > p`, `li:nth-child(2) > h3`, `li:nth-child(2) > p`, `li:nth-child(3) > h3`, `li:nth-child(3) > p`, `.public-footer > span:nth-child(1)` e `.public-footer > span:nth-child(2)`.
- Navegação/cabeçalho e painel: `.sidebar-caption`, `a[href$="#/solicitacoes"] > span:nth-child(2)`, `a[href$="#/cadastrar"] > span:nth-child(2)`, `#details-nav-link > span:nth-child(2)`, `a[href$="#/historico"] > span:nth-child(2)`, `.topbar-tagline`, `.profile-control`, `#view-dashboard > .page-heading > div > .eyebrow`, `#dashboard-title`, `#view-dashboard > .page-heading > div > .page-description`, `.welcome-kicker`, `.welcome-copy > h2`, `h2 > em`, `.welcome-copy > p`, `.button-ghost-light`, `.welcome-photo-credit`, `.welcome-tagline-box > p`, `p > strong`, `.pull-quote > blockquote`, `.pull-quote > figcaption`, `#view-dashboard > .section-heading > div > .eyebrow`, `#view-dashboard > .section-heading > div > h2`, `.dashboard-count-note`, `.dashboard-recent > .section-heading > div:nth-child(1) > .eyebrow`, `#recent-requests-title`, `#dashboard-empty > h3`, `#dashboard-empty > p`, `.community > .section-heading > div > .eyebrow`, `#community-title`, `.community-note`, `.data-tools > div:nth-child(1) > .eyebrow`, `#data-tools-title`, `.data-tools-text`, `.site-footer > p`, `a[data-view="dashboard"] > span:nth-child(2)`, `.is-active > span:nth-child(2)`, `.demo-badge` e `.demo-note > span:nth-child(2)`.
- Lista e histórico: `#view-requests > .page-heading > div > .eyebrow`, `#requests-title`, `#view-requests > .page-heading > div > .page-description`, `.priority-note`, `#requests-empty > h2`, `#requests-empty > p`, `#view-new-request > .page-heading > div > .eyebrow`, `#new-request-title`, `#view-new-request > .page-heading > div > .page-description`, `#view-details > .page-heading > div > .eyebrow`, `#details-title`, `#view-details > .page-heading > div > .page-description`, `#view-history > .page-heading > div > .eyebrow`, `#history-title`, `#view-history > .page-heading > div > .page-description` e `.history-disclaimer`.
- Sobreposições/transparências: `.toast-text`, `.toast-error > .toast-text`, `.toast-success > .toast-text`, `#import-dialog-description` e `#import-preview-summary`.
- Pseudo-elementos de textura: `#selected-request-details > .request-card > .card-ribbon.cat-alimentos > .card-ribbon-label` e `.recent-request-card > .card-ribbon.cat-alimentos > .card-ribbon-label`.

Decisão para cada grupo: os pares de cor serão calculados a partir dos valores computados das variáveis reais nos dois temas; o contraste do Hero com imagem/gradiente, transparência de glass e textura será inspecionado manualmente no CSS, pois o axe não determina um único fundo nesses casos. Sobreposições de toast/modal serão verificadas pela inspeção do stacking e pela medição do texto sobre a superfície opaca do componente. Nenhum resultado `incomplete` será tratado como aprovação automática.

## Correções e resultados finais

### Correções realizadas

- **Landmarks e navegação:** o skip link do app foi colocado no início do shell, fora do menu móvel inerte, em uma navegação nomeada. Assim, é o primeiro foco da aplicação também em viewport pequeno e continua dentro de um landmark. O primeiro skip link da apresentação pública foi mantido.
- **Rotas e títulos:** mudanças de rota focam o `h1` da tela e atualizam `document.title`; a carga inicial não desloca o foco. O roteador ignora hashes de âncora que não sejam rotas, para o skip link não enviar o usuário à tela inicial.
- **Formulário:** o resumo de erros relaciona os sete campos inválidos por links, recebe foco após envio inválido e leva ao campo correspondente sem mudar a rota. Cada campo mantém seu `label`, `aria-describedby` e `aria-invalid`.
- **Toasts:** a região global deixou de impor `aria-live` sobre todos os anúncios. Cada toast anuncia sucesso com `polite` e erro com `assertive`; o foco não é movido e o botão de dispensar foi mantido.
- **Diálogos:** ambos explicitam `aria-modal`, têm rótulo acessível, foco inicial e restauração ao opener. Foi adicionada contenção explícita por Tab/Shift+Tab nos dois `<dialog>`; os testes verificam o ciclo, o fechamento por Escape e o retorno do foco. Os testes de cancelamento da Fase 9 foram preservados.
- **Cores:** as variáveis `--border-strong` foram escurecidas no tema claro (`#64748b`) e clareadas no escuro (`#527589`) para contornos de controles. Os textos das etiquetas de alimentos e roupas foram escurecidos para `#06758f` e `#066b88`. A tabela de medições está abaixo.
- **Itens que já estavam corretos:** landmarks principais, um `h1` por tela, labels de campos, estados e urgências em texto e um indicador de foco já existiam. Não foram duplicados; o contorno de foco foi reforçado e controles menores foram elevados a pelo menos 44px onde aplicável. As regras CSS para movimento reduzido também já existiam; o contador animado do painel agora respeita `prefers-reduced-motion`.
- **Tamanho/layout:** foi acrescentado E2E a 320 CSS px com `font-size: 200%` e movimento reduzido; a aplicação não apresentou rolagem horizontal nesse estado. O teste também mede menu, tema, perfil e importação, e o teste de navegação legado cobre 320, 360, 390, 768 e 1280px. Isso simula ampliação de texto/layout, não o zoom real do navegador.
- **Estrutura de documento:** o título principal público e os títulos das telas têm foco programático; o painel de apresentação identificado agora usa `role="group"` em vez de `aria-label` num `div` genérico.

Uma execução intermediária encontrou duas regressões: espaços em branco no `textContent` dos títulos e o skip link dentro do menu móvel inerte. Os títulos foram mantidos como texto sem whitespace adicional e o skip link foi movido para fora do menu; os testes originais passaram sem alteração.

### Medições de contraste por script

Um script Node executado no repositório leu as declarações `:root`/tema escuro de `style.css` e `editorial.css`, aplicou as sobreposições na ordem das folhas e calculou a luminância relativa conforme a fórmula WCAG. Para cores `rgb(... / alpha)`, o cálculo compôs o token sobre a superfície declarada. Valores arredondados a duas casas. A tabela mede pares token/superfície; não é uma medição pixel a pixel dos fundos com imagens.

| Par medido (texto ou componente / fundo)     |   Claro |  Escuro | Referência usada                                                                         |
| -------------------------------------------- | ------: | ------: | ---------------------------------------------------------------------------------------- |
| Texto principal / página                     | 16,52:1 | 16,66:1 | `--text` / `--bg`                                                                        |
| Texto principal / superfície                 | 17,85:1 | 15,16:1 | `--text` / `--surface`                                                                   |
| Texto secundário / página                    |  7,01:1 |  9,41:1 | `--muted` / `--bg`                                                                       |
| Texto secundário / superfície                |  7,58:1 |  8,56:1 | `--muted` / `--surface`                                                                  |
| Botão primário normal                        |  5,32:1 |  7,69:1 | `--on-primary` / `--primary`                                                             |
| Botão primário hover                         |  6,06:1 | 10,44:1 | `--on-primary` / `--primary-hover`                                                       |
| Link primário / fundo suave                  |  4,93:1 |  7,30:1 | `--primary-text` / `--primary-soft` composto sobre `--surface-2`                         |
| Indicador de foco / página                   |  6,74:1 | 12,01:1 | `--ring` / `--bg`                                                                        |
| Indicador de foco / superfície               |  7,28:1 | 10,93:1 | `--ring` / `--surface`                                                                   |
| Indicador de foco / superfície secundária    |  6,65:1 |  9,49:1 | `--ring` / `--surface-2`                                                                 |
| Contorno de controle / página                |  4,40:1 |  3,88:1 | `--border-strong` / `--bg`                                                               |
| Contorno de controle / superfície            |  4,76:1 |  3,53:1 | `--border-strong` / `--surface`                                                          |
| Contorno de controle / superfície secundária |  4,34:1 |  3,06:1 | `--border-strong` / `--surface-2`                                                        |
| Status aberto                                |  5,21:1 |  9,09:1 | foreground/background do status; no escuro, fundo translúcido composto sobre `--surface` |
| Status em atendimento                        |  4,84:1 |  9,79:1 | tokens de aviso                                                                          |
| Status cancelado/suspenso                    |  5,72:1 |  8,24:1 | tokens de perigo                                                                         |
| Status conclusão/recebimento                 |  6,16:1 |  8,06:1 | tokens informativos                                                                      |
| Categoria alimentos                          |  4,81:1 |  9,18:1 | foreground/background da faixa                                                           |
| Categoria roupas                             |  5,41:1 |  8,63:1 | foreground/background da faixa                                                           |
| Categoria higiene                            |  4,57:1 |  8,63:1 | foreground/background da faixa                                                           |
| Categoria abrigo                             |  6,62:1 |  9,27:1 | foreground/background da faixa                                                           |

As medições de texto normal da tabela estão acima de 4,5:1 e as medições de contorno/foco acima de 3:1. Contornos gerais `--border` são separadores decorativos, não o único meio de identificar um controle. Controles desabilitados são inativos; não foram usados como critério de aprovação. A tabela não implica conformidade WCAG da aplicação.

### Resultado final axe

O teste usa as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` e `best-practice`, com `prefers-reduced-motion: reduce`. Cada célula representa um scan independente; todas as 32 células tiveram **zero violações**, inclusive `serious`, `critical`, `moderate`, `minor` e `best-practice`.

| Tela/estado                                      | Claro 1280×900 | Escuro 1280×900 | Claro 360×740 | Escuro 360×740 |
| ------------------------------------------------ | -------------: | --------------: | ------------: | -------------: |
| Apresentação pública                             |              0 |               0 |             0 |              0 |
| Painel                                           |              0 |               0 |             0 |              0 |
| Lista de solicitações                            |              0 |               0 |             0 |              0 |
| Cadastro vazio                                   |              0 |               0 |             0 |              0 |
| Cadastro com erros visíveis                      |              0 |               0 |             0 |              0 |
| Detalhes com solicitação criada pelo formulário  |              0 |               0 |             0 |              0 |
| Histórico                                        |              0 |               0 |             0 |              0 |
| Diálogo de importação com backup schema 2 válido |              0 |               0 |             0 |              0 |

**`incomplete`:** permaneceu somente `color-contrast`, com impacto informado pelo axe como `serious`, em cada um dos 32 scans; são itens não avaliados automaticamente, não violações confirmadas. O relatório agregado contou 76 seletores únicos. `aria-prohibited-attr` deixou de aparecer após a correção do grupo semântico. O best-practice `region` do skip link também deixou de aparecer.

Os 76 alvos finais foram inspecionados por grupo:

- Apresentação pública e gradientes: `.public-how-link`, `#public-title`, `#public-title > em`, `.public-hero-copy > p:nth-child(2)`, `.public-secondary-link`, `.public-demo-note > span:nth-child(2)`, `.public-hero-visual > figcaption`, `#public-flow-title`, `.public-flow-heading > p`, `li:nth-child(1) > h3`, `li:nth-child(1) > p`, `li:nth-child(2) > h3`, `li:nth-child(2) > p`, `li:nth-child(3) > h3`, `li:nth-child(3) > p`, `.public-footer > span:nth-child(1)`, `.public-footer > span:nth-child(2)`.
- Navegação, painel e Hero com fundo-art: `.sidebar-caption`, `a[href$="#/solicitacoes"] > span:nth-child(2)`, `a[href$="#/cadastrar"] > span:nth-child(2)`, `#details-nav-link > span:nth-child(2)`, `a[href$="#/historico"] > span:nth-child(2)`, `.topbar-tagline`, `.profile-label`, `#view-dashboard > .page-heading > div > .eyebrow`, `#dashboard-title`, `#view-dashboard > .page-heading > div > .page-description`, `.welcome-kicker`, `.welcome-copy > h2`, `h2 > em`, `.welcome-copy > p`, `.button-ghost-light`, `.welcome-photo-credit`, `.welcome-tagline-box > p`, `p > strong`, `.pull-quote > blockquote`, `.pull-quote > figcaption`, `#view-dashboard > .section-heading > div > .eyebrow`, `#view-dashboard > .section-heading > div > h2`, `.dashboard-count-note`, `.dashboard-recent > .section-heading > div:nth-child(1) > .eyebrow`, `#recent-requests-title`, `#dashboard-empty > h3`, `#dashboard-empty > p`, `.community > .section-heading > div > .eyebrow`, `#community-title`, `.community-note`, `.data-tools > div:nth-child(1) > .eyebrow`, `#data-tools-title`, `.data-tools-text`, `.site-footer > p`, `a[data-view="dashboard"] > span:nth-child(2)`, `.is-active > span:nth-child(2)`, `.demo-badge`, `.demo-note > span:nth-child(2)`.
- Telas de solicitações e histórico: `#view-requests > .page-heading > div > .eyebrow`, `#requests-title`, `#view-requests > .page-heading > div > .page-description`, `.priority-note`, `#requests-empty > h2`, `#requests-empty > p`, `#view-new-request > .page-heading > div > .eyebrow`, `#new-request-title`, `#view-new-request > .page-heading > div > .page-description`, `#view-details > .page-heading > div > .eyebrow`, `#details-title`, `#view-details > .page-heading > div > .page-description`, `#view-history > .page-heading > div > .eyebrow`, `#history-title`, `#view-history > .page-heading > div > .page-description`, `.history-disclaimer`.
- Texturas e sobreposições: `#selected-request-details > .request-card > .card-ribbon.cat-alimentos > .card-ribbon-label`, `.toast-error > .toast-text`, `.toast-success > .toast-text`, `#import-dialog-description`, `#import-preview-summary`.

Decisões para esses alvos: os textos sobre fundos sólidos (superfícies de cartões, painel de prévia e estados/status) foram comparados às variáveis efetivamente aplicadas, conforme a tabela. O Hero usa texto claro sobre camadas de gradiente escurecidas; a faixa de categoria usa tokens de foreground/background medidos, enquanto sua textura é decorativa e o nome permanece textual. A apresentação pública e partes do app também ficam sobre imagem de fundo, glass translúcido ou gradientes: o CSS e as cores/alpha foram inspecionados, mas o axe não consegue determinar a cor composta pixel a pixel. Esses casos permanecem dependentes da inspeção visual manual descrita no roteiro; não foram tratados como aprovação automática nem como garantia de contraste.

### Testes, decisões e pendências

| Comando/momento                                  | Unitários + integração | E2E | Total | Resultado              |
| ------------------------------------------------ | ---------------------: | --: | ----: | ---------------------- |
| Antes de qualquer alteração (`npm run test:all`) |                     36 |  15 |    51 | 51 aprovados; 0 falhas |
| Após A–D, antes de E (`npm run test:all`)        |                     36 |  17 |    53 | 53 aprovados; 0 falhas |
| Final, após E (`npm run test:all`)               |                     41 |  17 |    58 | 58 aprovados; 0 falhas |

Os 5 novos testes unitários/de integração cobrem retenção dos três backups válidos mais recentes, colisão de timestamps, preservação de backups v1 e da chave de tema, preservação de chaves malformadas, nenhuma limpeza após falha de gravação e importação já gravada apesar de falha de limpeza. As 2 adições E2E cobrem a matriz axe e foco/diálogos/layout. O teste extra do Hero já existia no estado inicial.

`npm run lint`: aprovado. `npm run format:check`: aprovado. Nenhum teste existente foi removido, desabilitado ou enfraquecido. A importação continua exigindo confirmação e permanece aditiva; formato/schema e chaves existentes foram preservados.

**Verificações manuais — cada item continua “não executado”:**

- NVDA com Firefox/Chrome, landmarks, títulos, anúncios, formulário, toasts e diálogos — **não executado**.
- Navegação somente por teclado em todas as telas, incluindo ciclos de Tab/Shift+Tab, Escape e retorno do foco — **não executado manualmente** (há cobertura automatizada parcial).
- Zoom real do navegador a 200%, em 320 CSS px, em todos os estados e nos dois temas — **não executado** (o E2E ampliou o tamanho-base do texto, não o zoom do navegador).

O roteiro está em `docs/ROTEIRO-ACESSIBILIDADE-MANUAL.md`. Nenhum resultado automatizado foi usado para declarar conformidade WCAG.

### Tarefa E — retenção de backups de importação

Após A–D aprovadas, a importação passou a reter no máximo três backups válidos `nexusSocial.requests.backup.import.` mais recentes. Timestamp é validado e ordenado por data/hora e sufixo de colisão; entradas malformadas são ignoradas e preservadas. A limpeza roda apenas depois de a coleção importada ter sido gravada; se a limpeza falhar, um aviso discreto é enviado ao console e a importação bem-sucedida não é revertida. Backups `nexusSocial.requests.backup.v1.`, `nexusSocial.requests` e `nexusSocial.theme` não entram na limpeza.

O README documenta a política e o limite de espaço do `localStorage` como motivo da retenção. Os testes finais passaram após essa alteração.
