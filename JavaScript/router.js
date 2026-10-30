// Roteamento leve por hash. Endereços:
//   #/inicio   #/painel   #/solicitacoes   #/cadastrar   #/historico
//   #/solicitacao/<id>   (link direto para os detalhes de uma solicitação)
const VIEW_PATHS = Object.freeze({
  home: "inicio",
  dashboard: "painel",
  requests: "solicitacoes",
  "new-request": "cadastrar",
  history: "historico",
});

const PATH_VIEWS = Object.freeze(
  Object.fromEntries(
    Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]),
  ),
);

export function pathFor(view, id = null) {
  if (view === "details") {
    return id ? `#/solicitacao/${encodeURIComponent(id)}` : "#/solicitacao";
  }
  return `#/${VIEW_PATHS[view] ?? VIEW_PATHS.dashboard}`;
}

export function parseHash(hash = window.location.hash) {
  if (!hash || !hash.startsWith("#/")) {
    return { view: "home", id: null };
  }

  const cleaned = hash.replace(/^#\/?/, "").split("?")[0];
  const [first = "", ...rest] = cleaned.split("/");

  if (first === "solicitacao") {
    const rawId = rest.join("/");
    let id = null;
    if (rawId) {
      try {
        id = decodeURIComponent(rawId);
      } catch {
        id = null;
      }
    }
    return { view: "details", id };
  }

  return {
    view: first ? (PATH_VIEWS[first] ?? "dashboard") : "home",
    id: null,
  };
}

export function navigateTo(view, id = null) {
  const target = pathFor(view, id);
  if (window.location.hash === target) {
    // Mesmo endereço: o navegador não dispara "hashchange", então avisamos manualmente.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = target;
}

// handler(route, { initial }) roda na carga da página e a cada mudança de endereço
// (inclusive o botão voltar/avançar do navegador).
export function startRouter(handler) {
  window.addEventListener("hashchange", () => {
    if (!window.location.hash || window.location.hash.startsWith("#/")) {
      handler(parseHash(), { initial: false });
    }
  });
  handler(parseHash(), { initial: true });
}
