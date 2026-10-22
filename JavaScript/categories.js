import { createIcon } from "./icons.js";

// Cada categoria de requests.js ganha uma "identidade visual" própria.
// A chave (key) vira a classe CSS "cat-<key>" em editorial.css, onde ficam as cores.
// Isto é só apresentação: nenhuma regra de negócio depende deste arquivo.
const CATEGORY_THEMES = Object.freeze({
  "Alimentos não perecíveis": Object.freeze({ key: "alimentos", label: "Alimentação", icon: "basket" }),
  "Produtos de higiene": Object.freeze({ key: "higiene", label: "Higiene", icon: "droplet" }),
  Roupas: Object.freeze({ key: "roupas", label: "Roupas", icon: "shirt" }),
  "Itens básicos de uso cotidiano": Object.freeze({ key: "abrigo", label: "Abrigo e lar", icon: "home" }),
});

const FALLBACK_THEME = Object.freeze({ key: "abrigo", label: "Solicitação", icon: "home" });

export function getCategoryTheme(category) {
  return CATEGORY_THEMES[category] ?? FALLBACK_THEME;
}

// Faixa decorativa no topo do cartão. O texto do rótulo vem do mapa acima,
// nunca do usuário; por isso é seguro usar textContent sem preocupação extra.
export function createCategoryBanner(category) {
  const theme = getCategoryTheme(category);
  const banner = document.createElement("div");
  banner.className = `card-ribbon cat-${theme.key}`;

  const icon = document.createElement("span");
  icon.className = "card-ribbon-icon";
  icon.append(createIcon(theme.icon));

  const label = document.createElement("span");
  label.className = "card-ribbon-label";
  label.textContent = theme.label;

  banner.append(icon, label);
  return banner;
}
