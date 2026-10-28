import { setIcon } from "./icons.js";

// Esta chave guarda só a preferência de tema; os dados das solicitações ficam em storage.js.
const THEME_KEY = "nexusSocial.theme";
const MODES = Object.freeze(["system", "light", "dark"]);
const MODE_LABELS = Object.freeze({
  system: "automático",
  light: "claro",
  dark: "escuro",
});
const MODE_ICONS = Object.freeze({
  system: "monitor",
  light: "sun",
  dark: "moon",
});
const META_COLORS = Object.freeze({ light: "#f8fafc", dark: "#020617" });

export function getStoredMode() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return MODES.includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

function storeMode(mode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // Sem armazenamento disponível: o tema vale só para esta visita.
  }
}

export function resolveTheme(mode) {
  if (mode === "light" || mode === "dark") {
    return mode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(mode, animate) {
  const root = document.documentElement;
  const resolved = resolveTheme(mode);
  if (animate) {
    root.classList.add("theme-transition");
    setTimeout(() => root.classList.remove("theme-transition"), 400);
  }
  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;
  document
    .querySelector("#theme-color-meta")
    ?.setAttribute("content", META_COLORS[resolved]);
}

export function initTheme(button) {
  let mode = getStoredMode();

  const refreshButton = () => {
    const label = `Tema ${MODE_LABELS[mode]}. Clique para alternar.`;
    button.setAttribute("aria-label", label);
    button.title = label;
    setIcon(button.querySelector("[data-icon]"), MODE_ICONS[mode]);
  };

  applyTheme(mode, false);
  refreshButton();

  button.addEventListener("click", () => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    storeMode(mode);
    applyTheme(mode, true);
    refreshButton();
  });

  // No modo automático, acompanha mudanças do sistema operacional em tempo real.
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (mode === "system") {
        applyTheme(mode, true);
      }
    });
}
