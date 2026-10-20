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

## Estrutura

```text
index.html      Estrutura semântica e áreas de navegação
style.css       Identidade visual, acessibilidade e responsividade
script.js       Navegação, eventos, renderização e integração dos módulos
storage.js      Persistência, validação, versão do esquema e migração
requests.js     Modelo, validação de entrada e regras de negócio
dashboard.js    Indicadores e seleção das solicitações recentes
README.md       Documentação do projeto
```

## Executar localmente

Os módulos ES devem ser servidos por HTTP; abrir `index.html` diretamente como arquivo (`file://`) não é suportado.

1. Abra a pasta do projeto no VS Code.
2. Instale ou habilite uma extensão de servidor local, como Live Server.
3. Abra `index.html` usando o comando **Open with Live Server** da extensão.
4. A aplicação será servida no navegador em um endereço local.

O projeto não exige instalação de pacotes nem configuração de backend.

## Persistência local

As solicitações são armazenadas na chave `nexusSocial.requests` como um envelope JSON com `schemaVersion: 2` e a coleção `requests`. A migração de dados do esquema 1 cria uma cópia de segurança com o prefixo `nexusSocial.requests.backup.v1.` antes de gravar o novo esquema.

Na primeira abertura sem dados, a aplicação inicializa uma coleção vazia. Ela não carrega nem restaura registros demonstrativos automaticamente. Falhas de leitura, dados corrompidos, versões incompatíveis e falhas de gravação são informadas; dados inválidos ou incompatíveis não são sobrescritos silenciosamente.

Os dados pertencem somente ao armazenamento local deste navegador e podem ser modificados ou apagados pelo usuário. Não existe sincronização entre navegadores ou dispositivos.

O MVP não inclui restauração de dados demonstrativos nem dados iniciais fictícios. Uma abertura sem dados começa com uma coleção vazia; não há ação de restauração que possa substituir solicitações existentes.

## Estados e regras

| Estado | Significado demonstrativo |
| --- | --- |
| `aberto` | Disponível para atendimento |
| `em_atendimento` | Atribuído ao perfil de voluntário |
| `conclusao_declarada` | Conclusão declarada pelo voluntário |
| `recebimento_confirmado` | Recebimento confirmado na demonstração, sem verificação física |
| `cancelado` | Cancelado e indisponível para nova atribuição |
| `suspenso_para_revisao` | Temporariamente indisponível para revisão |

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

- Testes automatizados reproduzíveis para validações, armazenamento e transições.
- Melhorias adicionais de navegação assistiva e avaliação contínua de acessibilidade.
- Exportação/importação local com confirmação explícita e cópia de segurança.
- Pesquisa e indicadores adicionais definidos com critérios transparentes.
- Caso o projeto evolua para operação real, avaliação de requisitos de privacidade, segurança, governança e infraestrutura antes de qualquer implementação de backend.

Esses itens são possibilidades futuras, não funcionalidades incluídas no MVP.

## Validação

Não há suíte automatizada versionada no projeto. Nesta revisão, a sintaxe dos módulos foi verificada com `node --check`, e os fluxos de cadastro, armazenamento, consulta, transições, indicadores, navegação e responsividade foram exercitados manualmente no navegador, incluindo simulações de falha de quota e dados corrompidos. Os dados usados nos testes foram temporários e removidos ao final.
