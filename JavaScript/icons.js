// Ícones SVG vetoriais (traço de 24x24). Todo o conteúdo abaixo é fixo e escrito
// por nós; nenhum texto vindo do usuário entra nestas strings, então é seguro usar innerHTML aqui.
const ICON_PATHS = Object.freeze({
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  list: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6"/>',
  "plus-circle": '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  "file-text":
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor:
    '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  "check-circle":
    '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  alert:
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart:
    '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  sparkles:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15v4M17 17h4"/>',
  "circle-dot":
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  "shield-check":
    '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  "x-circle": '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  "pause-circle": '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  "map-pin":
    '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  basket:
    '<path d="M4 10h16l-1.6 9.2a1 1 0 0 1-1 .8H6.6a1 1 0 0 1-1-.8z"/><path d="m8 10 3-6M16 10l-3-6M9 14v3M12 14v3M15 14v3"/>',
  shirt: '<path d="M8 3 3 6l2.5 4L8 9v12h8V9l2.5 1L21 6l-5-3a4 4 0 0 1-8 0z"/>',
  droplet:
    '<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/><path d="M9.5 14a2.6 2.6 0 0 0 2 2.4"/>',
  quote:
    '<path d="M7 17c-2 0-3-1.2-3-3.2C4 10.5 6 8 9 7M16 17c-2 0-3-1.2-3-3.2 0-3.3 2-5.8 5-6.8"/>',
});

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// Cria um <svg> decorativo (aria-hidden): o texto ao lado do ícone já explica a ação.
export function createIcon(name, className = "icon") {
  const markup = ICON_PATHS[name];
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", className);
  if (markup) {
    svg.innerHTML = markup;
  }
  return svg;
}

// Troca todo <span data-icon="nome"> do HTML pelo SVG correspondente.
export function hydrateIcons(root = document) {
  for (const slot of root.querySelectorAll("[data-icon]")) {
    slot.replaceChildren(createIcon(slot.dataset.icon));
    slot.setAttribute("aria-hidden", "true");
  }
}

export function setIcon(slot, name) {
  slot.dataset.icon = name;
  slot.replaceChildren(createIcon(name));
}
