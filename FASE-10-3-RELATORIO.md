# FASE 10.3 — Estabilização e integração das mudanças visuais

## Escopo e estado inicial

As alterações visuais pendentes foram preservadas e integradas; nenhum commit,
comando de descarte ou mudança em regras de negócio, formato persistido ou chave
de `localStorage` foi feito.

Estado inicial de `git status --short`:

```text
 M .gitattributes
 M .prettierignore
 M JavaScript/application.js
 M index.html
 M style.css
?? JavaScript/public-hero.js
?? JavaScript/specular-button.js
```

Resultado inicial de `npm run test:all`: 41/41 testes unitários/de integração
passaram; 5/17 E2E passaram e 12 falharam. `npm run lint` apontava globais de
navegador não declarados (`Animation`, `KeyframeEffect` e
`IntersectionObserver`); `npm run format:check` parava no `}` inesperado em
`style.css`, próximo da linha 2100.

| Categoria              |         Inicial |           Final |
| ---------------------- | --------------: | --------------: |
| Unitários e integração |           41/41 |           41/41 |
| E2E                    |            5/17 |           19/19 |
| Total                  | 46/58 aprovados | 60/60 aprovados |

As falhas E2E iniciais eram compatíveis com a nova interface ainda não refletida
nos testes: seletores globais `[data-view]` encontravam links duplicados no dock
e na navegação lateral, e o teste móvel ainda tentava abrir `.menu-toggle`,
ausente na interface atual. A falha de formatação era sintática e também fazia
com que regras responsivas seguintes fossem ignoradas.

## Resíduos e CSS

Não existem `JavaScript\support.js` nem `queries.js` na raiz. Não há referências
ativas de código a esses caminhos ausentes; a asserção de 404 de
`/JavaScript/support.js` em `tests/e2e/server.test.js` foi preservada.
`JavaScript\queries.js` é o módulo atual de consultas e permanece em uso.

O `}` excedente encerrava prematuramente o bloco `@media (max-width: 680px)`,
logo após a regra interna de movimento reduzido do dock. As regras responsivas
seguintes ficavam fora do bloco; a chave de fechamento do arquivo então se
tornava inesperada. A menor correção foi remover apenas esse fechamento:

```css
:root[data-theme="dark"] .mobile-dock {
  box-shadow:
    0 18px 48px rgb(0 0 0 / 42%),
    inset 0 1px 0 rgb(255 255 255 / 12%);
}

@media (prefers-reduced-motion: reduce) {
  .dock-item,
  .dock-item.is-launching {
    animation: none;
    transition: none;
  }
}

.page-heading {
  align-items: flex-start;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}

.page-heading > .button {
  width: 100%;
}

.welcome-card {
  min-height: auto;
  padding: 24px 20px;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
}

.welcome-copy {
  max-width: 100%;
}

.welcome-copy p {
  max-width: 100%;
}
```

A chave que encerra o bloco externo permanece depois das regras móveis; em
seguida, `@media (max-width: 440px)` e os breakpoints seguintes são analisados.
O teste E2E verificou estilos computados: `.demo-badge` fica oculto em 320 e
360 px; o `gap` do topo é `8px` até 360 px. `public.css` e `editorial.css`
também passaram pela análise do Prettier e pelo carregamento E2E.

## ESLint e formatação

Foram adicionados ao conjunto de globais do navegador os símbolos utilizados
pelos módulos e testes (`Animation`, `KeyframeEffect`, `IntersectionObserver`,
`Image` e `NodeFilter`). Nenhuma regra foi desativada e não há
`eslint-disable`.

`npm run format` foi executado após as correções de CSS e ESLint. Arquivos
reformatados no primeiro passe: `index.html`, `JavaScript/specular-button.js`,
`style.css`, `tests/e2e/accessibility.test.js` e `tests/e2e/app.test.js`.
Os passes finais não encontraram outros arquivos para formatar.

## Navegação duplicada e móvel

No desktop, a navegação lateral tem o landmark `Seções`; em larguras de até
680 px, ela fica inerte e o dock `Navegação rápida` aparece com quatro links:
Painel, Solicitações, Cadastrar e Histórico. O dock e o menu lateral têm nomes
acessíveis distintos. Detalhes continuam acessíveis pela ação “Ver detalhes”
de uma solicitação.

| Teste/superfície                                                                                                           | Locator antigo                              | Locator novo                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `tests/e2e/support.js` — helper usado pelos fluxos de navegação em `app.test.js` e `accessibility.test.js`                 | `page.locator('[data-view="..."]')` global  | `getByRole("navigation", { name: "Seções" ou "Navegação rápida" }).locator('[data-view="..."]')` |
| `app.test.js` — navegação entre telas principais                                                                           | `[data-view="${view}"]` global              | `clickPrimaryNavLink`, com escopo no landmark visível                                            |
| `app.test.js` — validação/cadastro, pesquisa/filtros, fluxo de atendimento, cancelamento/suspensão e exportação/importação | `[data-view="..."]` global                  | `clickPrimaryNavLink`, com escopo no landmark visível                                            |
| `app.test.js` — navegação móvel e teclado                                                                                  | `.menu-toggle` e `[data-view="..."]` global | Verificação de ausência do botão obsoleto; navegação rápida nomeada e testes de teclado do dock  |
| `accessibility.test.js` — matriz axe                                                                                       | `[data-view="${view}"]` global              | Landmark nomeado de acordo com o viewport, depois locator local                                  |
| `accessibility.test.js` / `app.test.js` — novos testes do dock                                                             | Não aplicável                               | Locator já escopado em `Navegação rápida`                                                        |

As asserções existentes foram mantidas. Foram acrescentados testes para cada rota
do dock, `aria-current`, foco no título após navegação, ativação por Tab/Enter e
nomes distintos dos landmarks. A espera do foco foi sincronizada com a conclusão
da navegação por hash, sem retirar a asserção.

O botão `.menu-toggle` não foi renomeado: não faz parte da interface atual. O
teste móvel cobre o dock por teclado, acesso às telas principais, rótulos de
formulário, perfil, tema, importação e exportação, detalhes, e ausência de
rolagem horizontal em 320, 360, 390, 768 e 1280 px.

## Axe e efeitos visuais

A matriz final executou 32 combinações de tela/tema/viewport, com movimento
reduzido: página pública e painel, solicitações, cadastro vazio/com erros,
detalhes, histórico e diálogo de importação; temas claro e escuro; 1280×900 e
360×740. O dock está presente nas varreduras móveis.

| Execução                                  | Varreduras | Violações | `incomplete`                                |
| ----------------------------------------- | ---------: | --------: | ------------------------------------------- |
| Primeira matriz após corrigir os locators |         32 |         0 | `color-contrast`, agrupado por áreas abaixo |
| Final                                     |         32 |         0 | `color-contrast`, agrupado por áreas abaixo |

Não houve violações serious/critical nem outras violações reportadas. O axe
marcou `color-contrast` como incompleto nas áreas abaixo; esses casos exigem
avaliação visual e não foram tratados como violações confirmadas:

- Apresentação pública: links, título, texto, prévia, fluxo e rodapé sobre
  gradientes/superfícies.
- Hero do painel e navegação rápida: texto sobre imagem, vidro translúcido e
  superfícies de cartões.
- Aplicação: navegação lateral, cabeçalho, badges, estados, cartões e categorias.
- Formulários, histórico e diálogos: campos, mensagens, avisos e toasts.

`public-hero.js` respeita `prefers-reduced-motion`, verifica suporte a
`Animation`/`KeyframeEffect` e mantém um estado estático como fallback; verifica
`IntersectionObserver` antes de usá-lo. O efeito especular usa apenas eventos de
ponteiro local e sua transição CSS é removida sob movimento reduzido. Nenhum
módulo novo move o foco ou faz requisições externas; o ciclo decorativo está
oculto da árvore acessível. Os links de fontes Google já existentes no HTML não
foram introduzidos nesta fase.

## Contraste medido em captura de tela

O teste torna o texto transparente, captura a tela e calcula a menor razão entre
a cor do texto e os pixels amostrados nas caixas do texto. Na tela móvel do
painel, a captura é feita após rolar o conteúdo para que o dock fixo não cubra o
texto medido. Para texto grande foi usado o limite de 3:1; para texto normal,
4,5:1. Os resultados abaixo são os menores por área, tema e viewport:

| Área                 | Tema   | Viewport | Menor contraste | Alvo de menor contraste | Limite aplicável |
| -------------------- | ------ | -------: | --------------: | ----------------------- | ---------------: |
| Apresentação pública | Claro  | 1280×900 |          3,61:1 | ênfase do título        |              3:1 |
| Apresentação pública | Escuro | 1280×900 |          5,95:1 | legenda da prévia       |            4,5:1 |
| Hero do painel       | Claro  | 1280×900 |          6,06:1 | botão claro             |            4,5:1 |
| Hero do painel       | Escuro | 1280×900 |          6,06:1 | botão claro             |            4,5:1 |
| Apresentação pública | Claro  |  360×740 |          3,32:1 | ênfase do título        |              3:1 |
| Apresentação pública | Escuro |  360×740 |          6,37:1 | link secundário         |            4,5:1 |
| Hero do painel       | Claro  |  360×740 |          6,06:1 | botão claro             |            4,5:1 |
| Hero do painel       | Escuro |  360×740 |          6,06:1 | botão claro             |            4,5:1 |

As amostras abaixo dos limites foram corrigidas: foi reforçado o fundo escuro
atrás do texto do Hero, e o aviso secundário da apresentação pública recebeu
uma superfície com borda.
Após os ajustes, nenhuma das amostras ficou abaixo dos limites usados pelo
teste. Isso é uma medição automatizada específica, não uma garantia de
conformidade.

## Auditoria de dependências

| Pacote instalado              | Gravidade            | Desenvolvimento? | Correção indicada                                                                               |
| ----------------------------- | -------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `minimatch@10.2.6`            | Moderate             | Sim              | `npm audit` só oferece correção por `npm audit fix --force`, com atualização breaking de ESLint |
| `@eslint/config-array@0.23.5` | Moderate (na cadeia) | Sim              | Atualização forçada transitiva                                                                  |
| `eslint@10.13.0`              | Moderate (na cadeia) | Sim              | Atualização forçada, indicada como ESLint 9.39.5                                                |

`npm audit` reportou 3 vulnerabilidades moderate. `npm audit --omit=dev`
reportou 0 vulnerabilidades. Nenhuma variação de `npm audit fix` foi executada.

### Risco aceito (somente desenvolvimento)

`minimatch` → `@eslint/config-array` → `eslint`. O risco fica restrito às
dependências de desenvolvimento de lint e não é distribuído nem executado pelo
site. A correção oferecida exige atualização forçada e mudança breaking; por
isso, foi registrada sem alterar dependências nesta fase.

## Documentação e imagens

A seção “Estrutura” do README foi atualizada com `public.css`, `public-hero.js`,
`specular-button.js`, `PRODUCT.md`, imagens de fundo e navegação rápida. O
`PRODUCT.md` também descreve o dock móvel e os acessos que permanecem
disponíveis.

Imagens de fundo novas — **origem não registrada**:

- `assets/background-dark.jpg`
- `assets/background-light.jpg`

## Resultados finais e pendências

| Comando                | Resultado                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run test:all`     | Passou: 41/41 unitários/de integração e 19/19 E2E; 60 testes no total |
| `npm run lint`         | Passou                                                                |
| `npm run format:check` | Passou                                                                |
| `npm audit`            | 3 moderate, somente desenvolvimento                                   |
| `npm audit --omit=dev` | 0 vulnerabilidades                                                    |

Pendência registrada: a cadeia de dependências de desenvolvimento indicada pelo
`npm audit` permanece sem atualização forçada. Não foram feitos commits.

## Conferência final do working tree

Resultado final de `git status --short`:

```text
 M .gitattributes
 M .prettierignore
 M JavaScript/application.js
 M PRODUCT.md
 M README.md
 M editorial.css
 M eslint.config.js
 M index.html
 M public.css
 M style.css
 M tests/e2e/accessibility.test.js
 M tests/e2e/app.test.js
 M tests/e2e/support.js
?? FASE-10-3-RELATORIO.md
?? JavaScript/public-hero.js
?? JavaScript/specular-button.js
```

`git diff --stat`: 11 arquivos rastreados, 826 inserções e 166 remoções.
`.gitattributes` e `.prettierignore` permanecem no status inicial, mas não
aparecem no diff estatístico; o relatório e os dois módulos novos são não
rastreados e, portanto, também não entram nesse diff. Os arquivos não rastreados
declarados são exatamente os entregáveis novos; os demais itens do diff são as
alterações de integração, testes, documentação e CSS descritas acima.
