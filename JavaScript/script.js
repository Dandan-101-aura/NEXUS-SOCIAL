import { compareNewestFirst, getRecentRequests, renderDashboard } from "./dashboard.js";
import {
  assignVolunteer,
  cancelRequest,
  confirmReceipt,
  createRequest,
  declareCompletion,
  DEMO_PROFILES,
  reopenRequest,
  REQUEST_CATEGORY_OPTIONS,
  REQUEST_LIMITS,
  REQUEST_UNIT_OPTIONS,
  REQUEST_URGENCY_OPTIONS,
  suspendForReview,
  validateRequestInput,
  withdrawFromRequest,
} from "./requests.js";
import { loadRequests, saveRequests, STORAGE_KEY, StorageError } from "./storage.js";
import { createIcon, hydrateIcons } from "./icons.js";
import { dismissToast, showToast } from "./toast.js";
import { initTheme } from "./theme.js";
import { navigateTo, pathFor, startRouter } from "./router.js";
import { buildSampleRequests, downloadBackup } from "./backup.js";

// ---------------------------------------------------------------------------
// Elementos da página
// ---------------------------------------------------------------------------
const views = [...document.querySelectorAll(".view")];
const navigationLinks = [...document.querySelectorAll(".nav-link[data-view]")];
const detailsNavLink = document.querySelector("#details-nav-link");
const navigation = document.querySelector("#site-navigation");
const menuToggle = document.querySelector(".menu-toggle");
const backdrop = document.querySelector(".nav-backdrop");
const announcement = document.querySelector("#navigation-announcement");
const mainContent = document.querySelector("#main-content");
const requestForm = document.querySelector("#request-form");
const descriptionInput = document.querySelector("#request-description");
const descriptionCounter = document.querySelector("#request-description-counter");
const requestList = document.querySelector("#request-list");
const requestsEmpty = document.querySelector("#requests-empty");
const requestsNoResults = document.querySelector("#requests-no-results");
const requestSearch = document.querySelector("#request-search");
const categoryFilter = document.querySelector("#filter-category");
const statusFilter = document.querySelector("#filter-status");
const urgencyFilter = document.querySelector("#filter-urgency");
const resultsAnnouncement = document.querySelector("#request-results-announcement");
const recentRequestList = document.querySelector("#dashboard-recent-list");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const profileSelect = document.querySelector("#demo-profile");
const detailsEmpty = document.querySelector("#details-empty");
const detailsEmptyTitle = document.querySelector("#details-empty-title");
const detailsEmptyText = document.querySelector("#details-empty-text");
const detailsContainer = document.querySelector("#selected-request-details");
const exportButton = document.querySelector("#export-backup");
const samplesButton = document.querySelector("#load-samples");
const actionDialog = document.querySelector("#action-dialog");
const actionDialogForm = document.querySelector("#action-dialog-form");
const actionDialogTitle = document.querySelector("#action-dialog-title");
const actionDialogDescription = document.querySelector("#action-dialog-description");
const actionDialogConfirm = document.querySelector("#action-dialog-confirm");
const actionDialogError = document.querySelector("#action-dialog-error");
const actionReasonField = document.querySelector("#action-reason-field");
const actionReason = document.querySelector("#action-reason");
const actionReasonError = document.querySelector("#action-reason-error");

let selectedRequestId = null;
let pendingAction = null;
let requests = [];
let isSubmitting = false;

// ---------------------------------------------------------------------------
// Rótulos legíveis (a tela nunca mostra códigos técnicos crus)
// ---------------------------------------------------------------------------
const STATUS_LABELS = Object.freeze({
  aberto: "Aberta",
  em_atendimento: "Em atendimento",
  conclusao_declarada: "Conclusão declarada",
  recebimento_confirmado: "Recebimento confirmado (demonstração)",
  cancelado: "Cancelada",
  suspenso_para_revisao: "Suspensa para revisão",
});

const URGENCY_LABELS = Object.freeze({ baixa: "Baixa", media: "Média", alta: "Alta" });

const ROLE_LABELS = Object.freeze({
  solicitante: "Solicitante",
  voluntario: "Voluntário",
  moderador: "Moderador",
});

const ACTION_LABELS = Object.freeze({
  solicitacao_criada: "Solicitação cadastrada",
  voluntario_atribuido: "Voluntário assumiu o atendimento",
  voluntario_desistiu: "Voluntário desistiu",
  conclusao_declarada: "Conclusão declarada",
  recebimento_confirmado_demo: "Recebimento confirmado (demonstração)",
  solicitacao_cancelada: "Solicitação cancelada",
  solicitacao_suspensa: "Suspensa para revisão",
  solicitacao_reaberta: "Solicitação reaberta",
  registro_legado_migrado: "Registro migrado do esquema anterior",
});

const STATUS_FILTER_OPTIONS = Object.freeze([
  Object.freeze({ value: "aberto", label: "Aberta" }),
  Object.freeze({ value: "em_atendimento", label: "Em atendimento" }),
  Object.freeze({ value: "conclusao_declarada", label: "Conclusão declarada" }),
  Object.freeze({ value: "recebimento_confirmado", label: "Recebimento confirmado" }),
  Object.freeze({ value: "cancelado", label: "Cancelada" }),
  Object.freeze({ value: "suspenso_para_revisao", label: "Suspensa para revisão" }),
]);

const URGENCY_PRIORITY = Object.freeze({ alta: 0, media: 1, baixa: 2 });
const NON_OPEN_STATUS_ORDER = Object.freeze([
  "em_atendimento",
  "conclusao_declarada",
  "recebimento_confirmado",
  "cancelado",
  "suspenso_para_revisao",
]);

const VIEW_TITLES = Object.freeze({
  dashboard: "Painel principal",
  requests: "Solicitações",
  "new-request": "Cadastrar solicitação",
  details: "Detalhes da solicitação",
  history: "Histórico",
});

const quantityFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function currentProfile() {
  return DEMO_PROFILES[profileSelect.value];
}

function actorLabel(actorId) {
  return Object.values(DEMO_PROFILES).find((profile) => profile.id === actorId)?.label ?? actorId;
}

function shortId(id) {
  return id.slice(0, 8).toUpperCase();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

// ---------------------------------------------------------------------------
// Navegação lateral (mobile)
// ---------------------------------------------------------------------------
function closeMobileNavigation() {
  navigation.classList.remove("is-open");
  backdrop.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir navegação");
  navigation.inert = window.matchMedia("(max-width: 680px)").matches;
}

menuToggle.addEventListener("click", () => {
  const isOpen = navigation.classList.toggle("is-open");
  backdrop.hidden = !isOpen;
  navigation.inert = !isOpen && window.matchMedia("(max-width: 680px)").matches;
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Fechar navegação" : "Abrir navegação");
  if (isOpen) {
    navigationLinks[0].focus();
  }
});

backdrop.addEventListener("click", () => {
  closeMobileNavigation();
  menuToggle.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navigation.classList.contains("is-open")) {
    closeMobileNavigation();
    menuToggle.focus();
  }
});

for (const link of navigationLinks) {
  // Clicar no link da tela atual não muda o endereço, então fechamos o menu aqui também.
  link.addEventListener("click", closeMobileNavigation);
}

function updateNavigationForViewport() {
  const isMobile = window.matchMedia("(max-width: 680px)").matches;
  navigation.inert = isMobile && !navigation.classList.contains("is-open");
  if (!isMobile) {
    closeMobileNavigation();
  }
}

window.addEventListener("resize", updateNavigationForViewport);
updateNavigationForViewport();

// ---------------------------------------------------------------------------
// Selects preenchidos a partir das listas de requests.js
// ---------------------------------------------------------------------------
function populateSelect(select, options) {
  const placeholder = select.options[0];
  select.replaceChildren(placeholder);
  for (const item of options) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  }
}

populateSelect(document.querySelector("#request-category"), REQUEST_CATEGORY_OPTIONS);
populateSelect(document.querySelector("#request-unit"), REQUEST_UNIT_OPTIONS);
populateSelect(document.querySelector("#request-urgency"), REQUEST_URGENCY_OPTIONS);
populateSelect(categoryFilter, REQUEST_CATEGORY_OPTIONS);
populateSelect(statusFilter, STATUS_FILTER_OPTIONS);
populateSelect(urgencyFilter, REQUEST_URGENCY_OPTIONS);

// ---------------------------------------------------------------------------
// Telas e roteamento (o endereço #/... decide qual tela aparece)
// ---------------------------------------------------------------------------
function showView(viewName, moveFocus) {
  const targetView = document.querySelector(`#view-${viewName}`);
  const targetLink = navigationLinks.find((link) => link.dataset.view === viewName);
  if (!targetView || !targetLink) {
    return;
  }

  for (const view of views) {
    const isTarget = view === targetView;
    view.hidden = !isTarget;
    view.classList.toggle("is-visible", isTarget);
  }

  for (const link of navigationLinks) {
    const isCurrent = link === targetLink;
    link.classList.toggle("is-active", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  const title = VIEW_TITLES[viewName];
  announcement.textContent = title;
  document.title = `${title} | NEXUS SOCIAL`;
  closeMobileNavigation();

  if (moveFocus) {
    mainContent.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
}

function handleRoute({ view, id }, { initial }) {
  if (view === "details") {
    selectedRequestId = id ?? selectedRequestId;
    renderSelectedRequest();
  }
  showView(view, !initial);
}

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------
function appendDetail(container, label, value) {
  const detail = document.createElement("p");
  detail.className = "request-detail";
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  detail.append(strong, document.createTextNode(value));
  container.append(detail);
}

function makeChip(text, iconName, extraClass = "") {
  const chip = document.createElement("span");
  chip.className = `chip ${extraClass}`.trim();
  if (iconName) {
    chip.append(createIcon(iconName));
  }
  chip.append(document.createTextNode(text));
  return chip;
}

function makeButton(label, action, requestId, style = "button-secondary") {
  const button = document.createElement("button");
  button.className = `button ${style}`;
  button.type = "button";
  button.dataset.action = action;
  button.dataset.requestId = requestId;
  button.textContent = label;
  return button;
}

function actionOptions(request) {
  const profile = currentProfile();
  const options = [];
  const add = (action, label, style = "button-secondary") => options.push({ action, label, style });
  if (request.status === "aberto") {
    if (profile.role === "voluntario") {
      add("assign", "Assumir atendimento", "button-primary");
    }
    if (profile.role === "solicitante" && request.requesterId === profile.id) {
      add("cancel", "Cancelar solicitação");
    }
    if (profile.role === "moderador") {
      add("cancel", "Cancelar solicitação");
      add("suspend", "Suspender para revisão");
    }
  } else if (request.status === "em_atendimento") {
    if (profile.role === "voluntario" && request.assignedVolunteerId === profile.id) {
      add("withdraw", "Desistir do atendimento");
      add("complete", "Declarar conclusão", "button-primary");
    }
    if (profile.role === "solicitante" && request.requesterId === profile.id) {
      add("cancel", "Cancelar solicitação");
    }
    if (profile.role === "moderador") {
      add("cancel", "Cancelar solicitação");
      add("suspend", "Suspender para revisão");
    }
  } else if (request.status === "conclusao_declarada") {
    if (profile.role === "solicitante" && request.requesterId === profile.id) {
      add("confirm", "Confirmar recebimento (demonstração)", "button-primary");
    }
    if (profile.role === "moderador") {
      add("confirm", "Confirmar recebimento (demonstração)", "button-primary");
      add("suspend", "Suspender para revisão");
    }
  } else if (request.status === "cancelado" || request.status === "suspenso_para_revisao") {
    if (profile.role === "moderador") {
      add("reopen", "Reabrir solicitação", "button-primary");
      if (request.status === "suspenso_para_revisao") {
        add("cancel", "Cancelar solicitação");
      }
    }
  }
  return options;
}

// headingLevel: 2 na tela de detalhes (logo abaixo do <h1>), 3 dentro de listas com <h2>.
function createRequestCard(request, { withDetailsButton = false, headingLevel = 2, index = 0 } = {}) {
  const card = document.createElement("article");
  card.className = "request-card";
  card.dataset.requestId = request.id;
  card.tabIndex = -1;
  card.style.setProperty("--i", String(index));

  const heading = document.createElement("div");
  heading.className = "request-card-heading";
  const title = document.createElement(`h${headingLevel}`);
  title.textContent = request.title;
  const status = document.createElement("span");
  status.className = `status-badge status-${request.status}`;
  status.textContent = STATUS_LABELS[request.status] ?? request.status;
  heading.append(title, status);

  const identifier = document.createElement("p");
  identifier.className = "request-id";
  identifier.textContent = `Protocolo ${shortId(request.id)}`;
  identifier.title = request.id;

  const description = document.createElement("p");
  description.className = "request-description";
  description.textContent = request.description;

  const meta = document.createElement("div");
  meta.className = "request-meta";
  meta.append(
    makeChip(request.category),
    makeChip(`${quantityFormatter.format(request.quantity)} ${request.unit}`),
    makeChip(request.region, "map-pin"),
    makeChip(`Urgência ${URGENCY_LABELS[request.declaredUrgency].toLowerCase()}`, null, `urgency-pill urgency-${request.declaredUrgency}`),
  );

  const details = document.createElement("div");
  details.className = "request-details";
  appendDetail(details, "Criada em", formatDate(request.createdAt));
  appendDetail(
    details,
    "Voluntário responsável",
    request.assignedVolunteerId ? actorLabel(request.assignedVolunteerId) : "Sem voluntário ativo",
  );
  if (request.cancellationReason) {
    appendDetail(details, "Motivo do cancelamento", request.cancellationReason);
  }
  if (request.reviewReason) {
    appendDetail(details, "Justificativa da revisão", request.reviewReason);
  }
  if (request.completedAt) {
    appendDetail(details, "Conclusão declarada em", formatDate(request.completedAt));
  }
  if (request.receiptConfirmedAt) {
    appendDetail(details, "Última confirmação registrada na demonstração", formatDate(request.receiptConfirmedAt));
  }

  const actions = document.createElement("div");
  actions.className = "request-actions";
  for (const option of actionOptions(request)) {
    actions.append(makeButton(option.label, option.action, request.id, option.style));
  }
  if (withDetailsButton) {
    actions.append(makeButton("Ver detalhes", "details", request.id));
  }

  card.append(heading, identifier, description, meta, details, actions);
  return card;
}

// ---------------------------------------------------------------------------
// Pesquisa, filtros e priorização (regras iguais à versão anterior)
// ---------------------------------------------------------------------------
function normalizeSearchText(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function compareOldestFirst(a, b) {
  const dateDifference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return dateDifference || a.id.localeCompare(b.id);
}

function getFilteredRequests() {
  const term = normalizeSearchText(requestSearch.value);
  const category = categoryFilter.value;
  const status = statusFilter.value;
  const urgency = urgencyFilter.value;

  const matches = requests.filter((request) => {
    const searchableText = [request.title, request.description, request.category].map(normalizeSearchText);
    return (!term || searchableText.some((field) => field.includes(term)))
      && (!category || request.category === category)
      && (!status || request.status === status)
      && (!urgency || request.declaredUrgency === urgency);
  });

  const openRequests = matches
    .filter((request) => request.status === "aberto")
    .sort((a, b) => (
      URGENCY_PRIORITY[a.declaredUrgency] - URGENCY_PRIORITY[b.declaredUrgency]
      || compareOldestFirst(a, b)
    ));
  const groupedRequests = [];

  if (openRequests.length) {
    groupedRequests.push(["Solicitações abertas · prioridade declarada", openRequests]);
  }

  for (const currentStatus of NON_OPEN_STATUS_ORDER) {
    const statusRequests = matches
      .filter((request) => request.status === currentStatus)
      .sort(compareNewestFirst);
    if (statusRequests.length) {
      groupedRequests.push([
        STATUS_FILTER_OPTIONS.find((option) => option.value === currentStatus).label,
        statusRequests,
      ]);
    }
  }

  return { matches, groupedRequests };
}

// ---------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------
function renderRequestList() {
  requestList.replaceChildren();
  const { matches, groupedRequests } = getFilteredRequests();
  requestsEmpty.hidden = requests.length > 0;
  requestsNoResults.hidden = requests.length === 0 || matches.length > 0;
  requestList.hidden = matches.length === 0;
  resultsAnnouncement.textContent = `${matches.length} ${matches.length === 1 ? "solicitação encontrada" : "solicitações encontradas"}.`;

  for (const [label, groupRequests] of groupedRequests) {
    const group = document.createElement("section");
    group.className = "request-group";
    const heading = document.createElement("h2");
    heading.className = "request-group-title";
    heading.textContent = label;
    const cards = document.createElement("div");
    cards.className = "request-group-list";
    groupRequests.forEach((request, index) => {
      cards.append(createRequestCard(request, { withDetailsButton: true, headingLevel: 3, index }));
    });
    group.append(heading, cards);
    requestList.append(group);
  }
}

function renderRecentRequests() {
  const emptyState = document.querySelector("#dashboard-empty");
  const recentRequests = getRecentRequests(requests);
  recentRequestList.replaceChildren();
  emptyState.hidden = requests.length > 0;
  recentRequestList.hidden = recentRequests.length === 0;

  recentRequests.forEach((request, index) => {
    const card = document.createElement("article");
    card.className = "request-card recent-request-card";
    card.dataset.requestId = request.id;
    card.tabIndex = -1;
    card.style.setProperty("--i", String(index));

    const heading = document.createElement("div");
    heading.className = "request-card-heading";
    const title = document.createElement("h3");
    title.textContent = request.title;
    const status = document.createElement("span");
    status.className = `status-badge status-${request.status}`;
    status.textContent = STATUS_LABELS[request.status] ?? request.status;
    heading.append(title, status);

    const identifier = document.createElement("p");
    identifier.className = "request-id";
    identifier.textContent = `Protocolo ${shortId(request.id)} · ${request.category} · Criada em ${formatDate(request.createdAt)}`;
    identifier.title = request.id;

    const actions = document.createElement("div");
    actions.className = "request-actions";
    actions.append(makeButton("Abrir detalhes", "details", request.id));
    card.append(heading, identifier, actions);
    recentRequestList.append(card);
  });
}

function renderSelectedRequest() {
  detailsContainer.replaceChildren();
  const selected = requests.find((request) => request.id === selectedRequestId);
  detailsEmpty.hidden = Boolean(selected);

  if (selected) {
    detailsContainer.append(createRequestCard(selected, { headingLevel: 2 }));
  } else if (selectedRequestId) {
    detailsEmptyTitle.textContent = "Solicitação não encontrada";
    detailsEmptyText.textContent = "Não existe uma solicitação com este endereço neste navegador. Ela pode ter sido removida ou criada em outro navegador.";
  } else {
    detailsEmptyTitle.textContent = "Nenhuma solicitação selecionada";
    detailsEmptyText.textContent = "Os detalhes serão exibidos quando houver uma solicitação disponível.";
  }

  // O link "Detalhes" do menu passa a apontar para a solicitação aberta por último.
  detailsNavLink.href = pathFor("details", selectedRequestId);
}

function renderHistory() {
  historyList.replaceChildren();
  const entries = requests
    .flatMap((request) => request.history.map((entry) => ({
      ...entry,
      requestId: request.id,
      requestTitle: request.title,
    })))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  historyEmpty.hidden = entries.length > 0;
  historyList.hidden = entries.length === 0;

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "history-entry";
    item.style.setProperty("--i", String(index));

    const heading = document.createElement("h2");
    heading.textContent = entry.requestTitle;
    const detail = document.createElement("p");
    detail.className = "request-description";
    detail.textContent = entry.description;

    const previous = entry.previousStatus ? STATUS_LABELS[entry.previousStatus] ?? entry.previousStatus : "—";
    const next = entry.newStatus ? STATUS_LABELS[entry.newStatus] ?? entry.newStatus : "—";
    const statusLine = document.createElement("p");
    statusLine.className = "history-status";
    statusLine.textContent = `${ACTION_LABELS[entry.actionType] ?? entry.actionType} · Estado: ${previous} → ${next}`;

    const metadata = document.createElement("p");
    metadata.className = "request-id";
    metadata.textContent = `${formatDate(entry.timestamp)} · ${ROLE_LABELS[entry.role] ?? entry.role} (${actorLabel(entry.actorId)}) · Protocolo ${shortId(entry.requestId)}`;

    item.append(heading, detail, statusLine, metadata);
    if (entry.reason) {
      const reason = document.createElement("p");
      reason.className = "request-description";
      reason.textContent = `Justificativa: ${entry.reason}`;
      item.append(reason);
    }
    const actions = document.createElement("div");
    actions.className = "request-actions";
    actions.append(makeButton("Ver solicitação", "details", entry.requestId));
    item.append(actions);
    historyList.append(item);
  });
}

function renderApplication() {
  renderRequestList();
  renderRecentRequests();
  renderSelectedRequest();
  renderHistory();
  renderDashboard(requests);
}

function logUnexpectedError(message, error) {
  if (!(error instanceof StorageError) && !error?.validationErrors) {
    console.error(message, error);
  }
}

// ---------------------------------------------------------------------------
// Ações das solicitações (diálogo de confirmação)
// ---------------------------------------------------------------------------
const ACTION_DIALOGS = Object.freeze({
  assign: {
    title: "Assumir atendimento",
    description: "A solicitação será atribuída ao perfil de voluntário selecionado.",
    confirmLabel: "Assumir",
  },
  withdraw: {
    title: "Desistir do atendimento",
    description: "Confirma a desistência? A solicitação voltará a ficar aberta para outro atendimento.",
    confirmLabel: "Confirmar desistência",
  },
  complete: {
    title: "Declarar conclusão",
    description: "Isto registra apenas a declaração do voluntário. Não confirma o recebimento nem uma entrega física.",
    confirmLabel: "Declarar conclusão",
  },
  confirm: {
    title: "Confirmar recebimento na demonstração",
    description: "Esta ação é uma confirmação declarada no ambiente de demonstração; o sistema não verifica a entrega física.",
    confirmLabel: "Confirmar na demonstração",
  },
  cancel: {
    title: "Cancelar solicitação",
    description: "A solicitação deixará de aceitar novas atribuições. Informe o motivo para manter o registro da decisão.",
    confirmLabel: "Cancelar solicitação",
    requiresReason: true,
    reasonLabel: "Motivo do cancelamento",
  },
  suspend: {
    title: "Suspender para revisão",
    description: "A solicitação ficará indisponível enquanto é revisada. Uma atribuição ativa será encerrada, mas permanecerá no histórico.",
    confirmLabel: "Suspender",
    requiresReason: true,
    reasonLabel: "Justificativa da revisão",
  },
  reopen: {
    title: "Reabrir solicitação",
    description: "A solicitação voltará ao estado aberto para uma nova etapa. As datas e eventos anteriores serão preservados.",
    confirmLabel: "Reabrir",
    requiresReason: true,
    reasonLabel: "Justificativa da reabertura",
  },
  seed: {
    title: "Carregar dados de exemplo",
    description: "Serão acrescentadas solicitações fictícias de exemplo. Nenhuma solicitação existente será alterada ou removida.",
    confirmLabel: "Adicionar exemplos",
  },
});

function openActionDialog(action, requestId, opener) {
  const configuration = ACTION_DIALOGS[action];
  if (!configuration) {
    return;
  }
  pendingAction = { action, requestId, opener, profile: currentProfile() };
  actionDialogTitle.textContent = configuration.title;
  actionDialogDescription.textContent = configuration.description;
  actionDialogConfirm.textContent = configuration.confirmLabel;
  actionReasonField.hidden = !configuration.requiresReason;
  actionReason.required = Boolean(configuration.requiresReason);
  actionReason.value = "";
  actionReasonError.textContent = "";
  actionReason.removeAttribute("aria-invalid");
  actionDialogError.hidden = true;
  actionDialogError.textContent = "";
  if (configuration.requiresReason) {
    actionReason.labels[0].textContent = configuration.reasonLabel;
  }
  actionDialog.showModal();
}

function executeAction(action, requestId, profile, reason) {
  switch (action) {
    case "assign":
      return assignVolunteer(requestId, profile);
    case "withdraw":
      return withdrawFromRequest(requestId, profile);
    case "complete":
      return declareCompletion(requestId, profile);
    case "confirm":
      return confirmReceipt(requestId, profile);
    case "cancel":
      return cancelRequest(requestId, profile, reason);
    case "suspend":
      return suspendForReview(requestId, profile, reason);
    case "reopen":
      return reopenRequest(requestId, profile, reason);
    default:
      throw new Error("Ação de solicitação desconhecida.");
  }
}

// Depois de renderizar de novo, o botão que abriu o diálogo pode não existir mais.
// Devolvemos o foco para ele ou, se sumiu, para o cartão da solicitação (acessibilidade por teclado).
function restoreFocus({ opener, requestId }) {
  requestAnimationFrame(() => {
    if (opener?.isConnected) {
      opener.focus();
      return;
    }
    const card = requestId
      ? document.querySelector(`.view:not([hidden]) .request-card[data-request-id="${CSS.escape(requestId)}"]`)
      : null;
    (card ?? mainContent).focus({ preventScroll: true });
  });
}

function handleActionClick(event) {
  const button = event.target.closest("button[data-action][data-request-id]");
  if (!button) {
    return;
  }
  if (button.dataset.action === "details") {
    navigateTo("details", button.dataset.requestId);
    return;
  }
  openActionDialog(button.dataset.action, button.dataset.requestId, button);
}

requestList.addEventListener("click", handleActionClick);
detailsContainer.addEventListener("click", handleActionClick);
recentRequestList.addEventListener("click", handleActionClick);
historyList.addEventListener("click", handleActionClick);

for (const button of document.querySelectorAll("[data-navigate]")) {
  button.addEventListener("click", () => navigateTo(button.dataset.navigate));
}

requestSearch.addEventListener("input", renderRequestList);
for (const control of [categoryFilter, statusFilter, urgencyFilter]) {
  control.addEventListener("change", renderRequestList);
}

document.querySelector("#clear-request-filters").addEventListener("click", () => {
  requestSearch.value = "";
  categoryFilter.value = "";
  statusFilter.value = "";
  urgencyFilter.value = "";
  renderRequestList();
  requestSearch.focus();
});

document.querySelector("#action-dialog-cancel").addEventListener("click", () => {
  actionDialog.close();
});

actionDialog.addEventListener("close", () => {
  const closed = pendingAction;
  pendingAction = null;
  if (closed) {
    restoreFocus(closed);
  }
});

function addSampleRequests() {
  const samples = buildSampleRequests(requests);
  if (samples.length === 0) {
    showToast("Os exemplos já estão cadastrados.", "info");
    return;
  }
  requests = saveRequests([...requests, ...samples]);
  renderApplication();
  showToast(`${samples.length} solicitações de exemplo adicionadas.`, "success");
}

actionDialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!pendingAction) {
    return;
  }

  const { action, requestId, profile } = pendingAction;
  const configuration = ACTION_DIALOGS[action];
  const reason = actionReason.value.trim();
  actionDialogError.hidden = true;

  if (configuration.requiresReason && (reason.length < 3 || reason.length > 500)) {
    actionReasonError.textContent = "A justificativa deve ter de 3 a 500 caracteres.";
    actionReason.setAttribute("aria-invalid", "true");
    actionReason.focus();
    return;
  }
  actionReason.removeAttribute("aria-invalid");
  actionReasonError.textContent = "";

  actionDialogConfirm.disabled = true;
  try {
    if (action === "seed") {
      addSampleRequests();
    } else {
      const updatedRequest = executeAction(action, requestId, profile, reason);
      requests = requests.map((request) => (request.id === updatedRequest.id ? updatedRequest : request));
      renderApplication();
      showToast(
        action === "confirm"
          ? "Recebimento registrado somente na demonstração."
          : `${configuration.confirmLabel} — alteração registrada.`,
        "success",
      );
    }
    dismissToast("storage");
    actionDialog.close();
  } catch (error) {
    logUnexpectedError("Falha ao executar ação:", error);
    // O erro aparece DENTRO do diálogo: um aviso fora dele ficaria escondido atrás do fundo escuro.
    actionDialogError.textContent = error.message;
    actionDialogError.hidden = false;
  } finally {
    actionDialogConfirm.disabled = false;
  }
});

samplesButton.addEventListener("click", () => openActionDialog("seed", null, samplesButton));

exportButton.addEventListener("click", () => {
  if (requests.length === 0) {
    showToast("Ainda não há solicitações para exportar.", "info");
    return;
  }
  try {
    downloadBackup(requests);
    showToast(`Backup com ${requests.length} solicitação(ões) baixado.`, "success");
  } catch (error) {
    logUnexpectedError("Falha ao exportar o backup:", error);
    showToast("Não foi possível gerar o arquivo de backup.", "error");
  }
});

profileSelect.addEventListener("change", () => {
  requestForm.querySelector("#request-submit").disabled = currentProfile().role === "voluntario";
  renderApplication();
});

// ---------------------------------------------------------------------------
// Formulário: contador de caracteres e validação ao sair do campo (blur)
// ---------------------------------------------------------------------------
function errorElementFor(field) {
  return document.querySelector(`#${field.id}-error`);
}

function clearFieldError(field) {
  const error = errorElementFor(field);
  if (error) {
    error.textContent = "";
  }
  field.removeAttribute("aria-invalid");
}

function setFieldError(field, message) {
  const error = errorElementFor(field);
  if (error) {
    error.textContent = message;
  }
  field.setAttribute("aria-invalid", "true");
}

function clearFieldErrors() {
  for (const field of requestForm.elements) {
    if (field instanceof HTMLElement && field.name) {
      clearFieldError(field);
    }
  }
}

function showFieldErrors(errors) {
  clearFieldErrors();
  for (const [fieldName, message] of Object.entries(errors)) {
    const field = requestForm.elements.namedItem(fieldName);
    if (field instanceof HTMLElement) {
      setFieldError(field, message);
    }
  }
  Object.keys(errors)
    .map((name) => requestForm.elements.namedItem(name))
    .find((field) => field instanceof HTMLElement)
    ?.focus();
}

function readFormValues() {
  return Object.fromEntries(new FormData(requestForm).entries());
}

function updateDescriptionCounter() {
  const length = [...descriptionInput.value].length;
  const max = REQUEST_LIMITS.description.max;
  descriptionCounter.textContent = `${length} / ${max}`;
  descriptionCounter.classList.toggle("is-warning", length >= max * 0.9 && length < max);
  descriptionCounter.classList.toggle("is-limit", length >= max);
}

function validateSingleField(field) {
  if (!(field instanceof HTMLElement) || !field.name || !requestForm.contains(field)) {
    return;
  }
  // Não mostra erro em campo que o usuário apenas atravessou com Tab sem digitar nada.
  if (field.dataset.touched !== "true" && !field.value) {
    return;
  }
  const message = validateRequestInput(readFormValues()).errors[field.name];
  if (message) {
    setFieldError(field, message);
  } else {
    clearFieldError(field);
  }
}

requestForm.addEventListener("input", (event) => {
  const field = event.target;
  if (!(field instanceof HTMLElement) || !field.name) {
    return;
  }
  field.dataset.touched = "true";
  clearFieldError(field);
  if (field === descriptionInput) {
    updateDescriptionCounter();
  }
});

requestForm.addEventListener("change", (event) => {
  const field = event.target;
  if (field instanceof HTMLElement && field.name) {
    field.dataset.touched = "true";
    validateSingleField(field);
  }
});

requestForm.addEventListener("focusout", (event) => validateSingleField(event.target));

requestForm.addEventListener("reset", () => {
  // O reset do navegador acontece depois do evento; esperamos para ler o estado final.
  setTimeout(() => {
    for (const field of requestForm.elements) {
      if (field instanceof HTMLElement) {
        delete field.dataset.touched;
      }
    }
    updateDescriptionCounter();
  }, 0);
});

requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isSubmitting) {
    return;
  }
  if (!["solicitante", "moderador"].includes(currentProfile().role)) {
    showToast("O cadastro está disponível apenas aos perfis de solicitante ou moderador da demonstração.", "error");
    return;
  }

  clearFieldErrors();
  const validation = validateRequestInput(readFormValues());
  if (!validation.isValid) {
    showFieldErrors(validation.errors);
    showToast("Revise os campos destacados antes de salvar.", "error");
    return;
  }

  isSubmitting = true;
  const submitButton = requestForm.querySelector("#request-submit");
  submitButton.disabled = true;

  try {
    const request = createRequest(validation.values, requests, currentProfile());
    requests = saveRequests([...requests, request]);
    renderApplication();
    requestForm.reset();
    clearFieldErrors();
    showToast("Solicitação cadastrada e salva neste navegador.", "success");
    dismissToast("storage");
  } catch (error) {
    logUnexpectedError("Falha ao cadastrar a solicitação:", error);
    if (error.validationErrors) {
      showFieldErrors(error.validationErrors);
      showToast("Revise os campos destacados antes de salvar.", "error");
    } else {
      showToast(error.message, "error");
    }
  } finally {
    isSubmitting = false;
    submitButton.disabled = currentProfile().role === "voluntario";
  }
});

// ---------------------------------------------------------------------------
// Dados locais: carga inicial e sincronização entre abas
// ---------------------------------------------------------------------------
function showStorageError(error) {
  showToast(error.message, "error", { key: "storage", duration: 0 });
}

function initialize() {
  try {
    requests = loadRequests();
  } catch (error) {
    logUnexpectedError("Falha ao inicializar os dados locais:", error);
    requests = error instanceof StorageError ? error.validRequests ?? [] : [];
    showStorageError(error);
  }
  renderApplication();
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) {
    return;
  }
  try {
    requests = loadRequests();
    dismissToast("storage");
  } catch (error) {
    logUnexpectedError("Falha ao atualizar dados locais de outra aba:", error);
    if (error instanceof StorageError && error.validRequests) {
      requests = error.validRequests;
    }
    showStorageError(error);
  }
  renderApplication();
});

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
hydrateIcons();
initTheme(document.querySelector("#theme-toggle"));
updateDescriptionCounter();
initialize();
startRouter(handleRoute);
