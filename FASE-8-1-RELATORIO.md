# Relatório da Fase 8.1 — ajustes de consolidação

## Tarefa A — servidor E2E

O servidor anterior usava um `Map` com uma entrada para cada URL e arquivo estático. Foi substituído por resolução dinâmica limitada a `index.html`, `style.css`, `editorial.css`, `JavaScript/` e `assets/`. O caminho é decodificado e resolvido, validado contra a raiz permitida e confirmado por `realpath`; caminhos ocultos, diretórios de teste/dependências/resultados, manifestos de pacote, relatórios e a cópia não utilizada `JavaScript/support.js` não são servidos. Apenas `GET` e `HEAD` são aceitos. O servidor continua restrito a `127.0.0.1` e porta efêmera.

Foram adicionados cinco testes E2E em arquivo separado: criação temporária e remoção de módulo em `JavaScript/views/`, traversal simples/codificado, arquivos privados, métodos HTTP e tipos MIME (incluindo JavaScript e as extensões de imagem requeridas). Os seis cenários E2E anteriores permaneceram intactos.

## Tarefa B — README e inventário

A árvore real foi conferida excluindo `.git/`, `node_modules/` e `test-results/`. A seção “Estrutura” agora inclui os arquivos, subpastas, imagens, relatórios e configuração existentes; não existe pasta `docs/`. O README também registra as histórias fictícias do painel, os novos testes do servidor, os comandos de lint/formatação e a referência ao relatório da Fase 8.

**Discrepâncias README × código encontradas:**

- O painel já exibia histórias de impacto fictícias, mas a lista de funcionalidades não as mencionava; isso foi documentado com a ressalva de que não são depoimentos reais.
- `JavaScript/support.js` existe, mas é uma cópia não importada do harness E2E, não uma funcionalidade de suporte da aplicação. Foi descrita como tal e bloqueada no servidor de teste.
- Não há diretório `docs/`; os relatórios existentes ficam na raiz.

## Tarefa C — linha de base e aditivo

Foi acrescentada ao fim de `FASE-8-RELATORIO.md` a seção **“Esclarecimento (Fase 8.1)”**. O commit disponível marcado Fase 8 contém o snapshot pós-refatoração; o outro snapshot encontrado também não contém o estado pré-Fase 8. Assim, a causa da falha inicial de 0/6 não pode ser verificada pelo histórico. O relatório anterior atribui a falha à lista fixa que não servia módulos importados, mas isso não pode ser confirmado contra o servidor anterior e a atribuição à “linha de base” não é comprovada.

O aditivo registra ainda que, com o painel oculto, os indicadores recebem o valor final diretamente; visível, a animação continua por `requestAnimationFrame` com duração padrão de 700 ms. O teste de cadastro/recarga lê o valor imediatamente, sem temporização ou espera explícita; nesse fluxo, o painel está oculto e a asserção verifica o valor final síncrono.

## Arquivos criados e alterados

**Criados:**

- `tests/e2e/server.test.js`
- `FASE-8-1-RELATORIO.md` (este relatório)

**Alterados:**

- `tests/e2e/support.js`
- `README.md`
- `FASE-8-RELATORIO.md` (somente aditivo)

`git diff --stat` conferido para os arquivos rastreados: `FASE-8-RELATORIO.md` (8 linhas), `README.md` (59 linhas) e `tests/e2e/support.js` (259 linhas alteradas); total **3 arquivos, 200 inserções e 126 remoções**. Os dois arquivos criados aparecem como não rastreados em `git status --short` e, por isso, não são incluídos pelo `git diff --stat` sem staging.

## Validações executadas

- `npm run test:all` — **33 aprovados, 0 reprovados, 0 ignorados**: 22 unitários/de integração e 11 E2E. Os 28 testes anteriores (22 + 6) continuam presentes e aprovados; cinco testes novos foram adicionados.
- `npm run lint` — aprovado.
- `npm run format` — executado.
- `npm run format:check` — aprovado.
- `node --test tests/e2e/app.test.js` — **6 aprovados, 0 reprovados**, execução separada dos cenários E2E anteriores.
- `git diff --check` — aprovado.

Não foram adicionadas dependências. Nenhuma regra de negócio, chave ou formato de `localStorage` foi alterado.

Na primeira checagem, o ESLint não reconheceu `fetch` como global no ambiente configurado, e o Prettier apontou os arquivos novos. O teste passou a usar `node:http` e a formatação foi aplicada; as verificações finais acima passaram.

## Limitações restantes

Não é possível verificar independentemente a causa histórica da falha 0/6 nem reconstruir o estado E2E anterior à Fase 8. A validação E2E continua limitada ao Chromium disponível no ambiente e não representa auditoria completa de segurança ou acessibilidade.
