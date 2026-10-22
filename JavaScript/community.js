import { createIcon } from "./icons.js";

// HISTÓRIAS FICTÍCIAS DE DEMONSTRAÇÃO.
// Os nomes e frases abaixo foram escritos para ilustrar o layout. Não são depoimentos
// de pessoas reais, e a tela avisa isso ao visitante.
//
// Quando houver histórias verdadeiras, com autorização por escrito de cada pessoa,
// troque este array e informe o caminho da foto em "photo" (ex.: "./assets/marta.jpg").
// Sem "photo", o avatar mostra as iniciais.
const STORIES = Object.freeze([
  Object.freeze({
    name: "Marta S.",
    role: "Voluntária",
    place: "Bairro Centro",
    tone: "emerald",
    quote: "Levei duas sacolas e voltei com a certeza de que o bairro cuida de si mesmo.",
    photo: null,
  }),
  Object.freeze({
    name: "Seu Antônio",
    role: "Voluntário",
    place: "Zona Norte",
    tone: "amber",
    quote: "Ninguém aqui pergunta quem você é. Só pergunta do que você precisa.",
    photo: null,
  }),
  Object.freeze({
    name: "Camila R.",
    role: "Solicitante",
    place: "Zona Sul",
    tone: "clay",
    quote: "Pedi com vergonha e recebi com carinho. Foi assim que voltei a respirar.",
    photo: null,
  }),
]);

function initials(name) {
  const parts = name.replace(/\./g, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase();
}

function createAvatar(story) {
  const avatar = document.createElement("span");
  avatar.className = `story-avatar tone-${story.tone}`;

  if (story.photo) {
    const image = document.createElement("img");
    image.src = story.photo;
    image.alt = `Foto de ${story.name}`;
    image.loading = "lazy";
    image.width = 56;
    image.height = 56;
    avatar.append(image);
  } else {
    avatar.textContent = initials(story.name);
    avatar.setAttribute("role", "img");
    avatar.setAttribute("aria-label", `Avatar ilustrativo de ${story.name}`);
  }
  return avatar;
}

export function renderCommunityStories(container) {
  if (!container) {
    return;
  }
  container.replaceChildren();

  for (const story of STORIES) {
    const card = document.createElement("figure");
    card.className = "story-card";

    const mark = document.createElement("span");
    mark.className = "story-mark";
    mark.append(createIcon("quote"));

    const quote = document.createElement("blockquote");
    quote.className = "story-quote";
    quote.textContent = story.quote;

    const caption = document.createElement("figcaption");
    caption.className = "story-author";

    const who = document.createElement("span");
    who.className = "story-who";
    const name = document.createElement("strong");
    name.textContent = story.name;
    const role = document.createElement("span");
    role.textContent = `${story.role} · ${story.place}`;
    who.append(name, role);

    caption.append(createAvatar(story), who);
    card.append(mark, quote, caption);
    container.append(card);
  }
}
