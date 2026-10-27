# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

HTML5, CSS3 e JavaScript puro com módulos ES, sem framework e sem etapa de build. Os dados ficam no `localStorage`. A aplicação precisa ser servida por HTTP; não funciona abrindo o arquivo diretamente. `node:test` e Playwright são usados apenas no desenvolvimento. A única dependência externa de runtime são as fontes do Google Fonts. Destino de publicação ainda não definido; GitHub Pages e Vercel são opções sugeridas para hospedagem estática.

## Users

O público real do projeto são pessoas que avaliam a interface, fazem demonstrações ou querem aprender sobre fluxos de estados. A demonstração oferece três perfis simulados, nenhum representando pessoas reais:

- **Solicitante:** cadastra pedidos de alimentos e itens básicos, cancela os próprios pedidos e confirma o recebimento.
- **Voluntário:** consulta pedidos abertos por prioridade, assume ou abandona atendimentos e declara a conclusão.
- **Moderador:** suspende pedidos para revisão, cancela, reabre e confirma recebimentos.

## Product Purpose

O NEXUS SOCIAL é uma demonstração local de uma rede de apoio comunitário para organizar solicitações fictícias de alimentos e itens básicos, acompanhar o atendimento e consultar o histórico de cada pedido. Seu slogan é “A ajuda certa. No momento certo.”

Permite cadastrar e pesquisar pedidos por texto, categoria, status e urgência; acompanhar o ciclo do pedido; consultar indicadores por status e o histórico local de ações; exportar um backup JSON; e carregar exemplos fictícios.

## Positioning

A transparência é o diferencial do produto: cada ação gera um evento em um histórico que não é reescrito; a conclusão declarada pelo voluntário e a confirmação de recebimento pelo solicitante são etapas separadas; e a urgência declarada não é apresentada como prova de necessidade.

## Operating Context

A experiência é web adaptativa para celular, tablet e desktop. Em telas pequenas, o menu lateral vira uma gaveta. O uso é local, sem autenticação real. A publicação não tem destino definido; por ser estática, a aplicação pode ser hospedada em serviços de hospedagem estática. Os avisos de demonstração devem permanecer visíveis se houver publicação.

## Capabilities and Constraints

- Preservar em `requests.js` as transições permitidas, a exigência de justificativa para cancelar, suspender e reabrir pedidos, e a ordenação por urgência seguida da data mais antiga.
- Preservar em `storage.js` a versão do esquema e a migração com backup; dados inválidos nunca devem ser sobrescritos.
- Tratar texto fornecido pelo usuário sempre como texto, nunca como HTML.
- O formulário deve bloquear endereços exatos e pedir apenas bairro ou município.
- A urgência é declarada pelo solicitante e não comprova necessidade.
- Os dados são locais e não constituem auditoria; a interface não verifica entregas físicas.
- A demonstração não deve ser usada para uma operação real de doações.
- É necessário um servidor HTTP simples para executar a aplicação.
- O destino de publicação continua em aberto. GitHub Pages ou Vercel são sugestões, não decisões confirmadas.

## Brand Commitments

- Nome: NEXUS SOCIAL.
- Slogan: “A ajuda certa. No momento certo.”
- Usar a logo fornecida em `assets/nexus-social-logo.jpg` e manter azul, turquesa e verde como cores de identidade.
- Manter em destaque as limitações da demonstração: não há autenticação real, verificação de entrega física nem auditoria dos dados locais; o produto não serve para uma operação real de doações.

## Evidence on Hand

A logo fornecida está em `assets/nexus-social-logo.jpg`. Os pedidos e exemplos são fictícios. Não há pessoas reais representadas. Não foram fornecidos depoimentos, métricas, parcerias ou evidências de impacto; não inventar esses elementos.

## Product Principles

- Registrar cada ação como um evento de histórico que não é reescrito.
- Separar a conclusão declarada da confirmação de recebimento.
- Apresentar urgência como declaração, não como comprovação de necessidade.
- Deixar claras as limitações e a natureza demonstrativa do produto.
- Coletar apenas a localização aproximada necessária, preservando a privacidade.

## Accessibility & Inclusion

Preservar navegação por teclado, gerenciamento de foco, compatibilidade com leitores de tela e suporte a movimento reduzido.
