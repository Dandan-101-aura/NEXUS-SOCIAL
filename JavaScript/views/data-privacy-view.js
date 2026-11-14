function textElement(tagName, text, className) {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
}

function section(title, paragraphs) {
  const container = document.createElement("section");
  container.append(textElement("h2", title));
  for (const paragraph of paragraphs) {
    container.append(textElement("p", paragraph));
  }
  return container;
}

export function renderDataPrivacyView(container) {
  const heading = document.createElement("div");
  heading.className = "page-heading";
  const headingContent = document.createElement("div");
  headingContent.append(
    textElement("p", "TRANSPARÊNCIA", "eyebrow"),
    textElement("h1", "Sobre os dados", "data-privacy-title"),
    textElement(
      "p",
      "Informações claras sobre esta demonstração e o armazenamento neste navegador.",
      "page-description",
    ),
  );
  const title = headingContent.querySelector("h1");
  title.id = "data-privacy-title";
  title.tabIndex = -1;
  heading.append(headingContent);

  const content = document.createElement("div");
  content.className = "data-privacy-content";
  content.append(
    section("Sobre o projeto", [
      "NEXUS SOCIAL é uma demonstração local, sem fins comerciais, criada para mostrar uma interface de solicitações. Os pedidos, perfis, histórias e exemplos são fictícios e não representam atendimento ou entrega real.",
    ]),
    section("O que pode ficar neste navegador", [
      "A chave nexusSocial.requests guarda os pedidos da demonstração e o histórico associado. A chave nexusSocial.theme guarda a preferência de tema.",
      "A importação pode criar cópias de segurança locais com o prefixo nexusSocial.requests.backup.import.; são mantidas até três cópias de importação. Cópias antigas de migração, com o prefixo nexusSocial.requests.backup.v1., também podem permanecer no navegador.",
    ]),
    section("O que não é enviado", [
      "A aplicação não envia esses dados a servidores e não usa cookies nem analytics. Os scripts e as fontes são servidos pelos arquivos locais do projeto; não há requisições da aplicação a serviços ou origens de terceiros.",
    ]),
    section("Como apagar os dados", [
      "Use as configurações do navegador para limpar os dados deste site. Isso também pode apagar a preferência de tema e as cópias de segurança guardadas localmente.",
      "Os arquivos de backup exportados são baixados e ficam no dispositivo de quem os exportou. A aplicação não os envia; a pessoa pode removê-los pelo gerenciador de arquivos do dispositivo.",
    ]),
    section("Autoria e contato", [
      "Autoria: [NOME DO AUTOR]. Contato: [CONTATO].",
    ]),
    section("Aviso", [
      "Este texto é informativo e não substitui orientação jurídica.",
    ]),
  );

  container.replaceChildren(heading, content);
}
