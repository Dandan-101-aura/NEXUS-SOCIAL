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
  REQUEST_UNIT_OPTIONS,
  REQUEST_URGENCY_OPTIONS,
  suspendForReview,
  validateRequestInput,
  withdrawFromRequest,
} from "./requests.js";
import { loadRequests, saveRequests, STORAGE_KEY, StorageError } from "./storage.js";

const views = [...document.querySelectorAll(".view")];
const navigationLinks = [...document.querySelectorAll(".nav-link[data-view]")];
const navigation = document.querySelector("#site-navigation");
const menuToggle = document.querySelector(".menu-toggle");
const backdrop = document.querySelector(".nav-backdrop");
const announcement = document.querySelector("#navigation-announcement");
const mainContent = document.querySelector("#main-content");
const requestForm = document.querySelector("#request-form");
const formMessage = document.querySelector("#form-message");
const storageMessage = document.querySelector("#storage-message");
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
const actionMessage = document.querySelector("#action-message");
const detailsEmpty = document.querySelector("#details-empty");
const detailsContainer = document.querySelector("#selected-request-details");
const actionDialog = document.querySelector("#action-dialog");
const actionDialogForm = document.querySelector("#action-dialog-form");
const actionDialogTitle = document.querySelector("#action-dialog-title");
const actionDialogDescription = document.querySelector("#action-dialog-description");
const actionReasonField = document.querySelector("#action-reason-field");
const actionReason = document.querySelector("#action-reason");
const actionReasonError = document.querySelector("#action-reason-error");
let selectedRequestId = null;
let pendingAction = null;
let requests = [];
let isSubmitting = false;

const STATUS_LABELS = Object.freeze({
  aberto: "Aberta",
  em_atendimento: "Em atendimento",
  conclusao_declarada: "Conclusão declarada",
  recebimento_confirmado: "Recebimento confirmado (demonstração)",
  cancelado: "Cancelada",
  suspenso_para_revisao: "Suspensa para revisão",
});

const URGENCY_LABELS = Object.freeze({
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
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

function currentProfile() {
  return DEMO_PROFILES[profileSelect.value];
}

function closeMobileNavigation() {
  navigation.classList.remove("is-open");
  backdrop.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir navegação");
  navigation.inert = window.matchMedia("(max-width: 680px)").matches;
}

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

function showView(viewName, moveFocus = true) {
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

  announcement.textContent = targetView.querySelector("h1").textContent;
  closeMobileNavigation();

  if (moveFocus) {
    mainContent.focus();
  }
}

for (const link of navigationLinks) {
  link.addEventListener("click", () => showView(link.dataset.view));
}

for (const button of document.querySelectorAll("[data-navigate]")) {
  button.addEventListener("click", (event) => {
    if (button instanceof HTMLAnchorElement) {
      event.preventDefault();
    }
    showView(button.dataset.navigate);
  });
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

function updateNavigationForViewport() {
  const isMobile = window.matchMedia("(max-width: 680px)").matches;
  navigation.inert = isMobile && !navigation.classList.contains("is-open");
  if (!isMobile) {
    closeMobileNavigation();
  }
}

window.addEventListener("resize", updateNavigationForViewport);
updateNavigationForViewport();

function setNotice(notice, message, type) {
  notice.replaceChildren();
  notice.className = `notice notice-${type}`;
  const icon = document.createElement("span");
  icon.className = "notice-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "success" ? "✓" : type === "error" ? "!" : "i";
  const text = document.createElement("p");
  text.textContent = message;
  notice.append(icon, text);
  notice.hidden = false;
}

function clearFieldErrors() {
  for (const field of requestForm.elements) {
    if (!(field instanceof HTMLElement) || !field.name) {
      continue;
    }
    const error = document.querySelector(`#${field.id}-error`);
    if (error) {
      error.textContent = "";
    }
    field.removeAttribute("aria-invalid");
  }
}

function showFieldErrors(errors) {
  clearFieldErrors();
  for (const [fieldName, message] of Object.entries(errors)) {
    const field = requestForm.elements.namedItem(fieldName);
    const error = field instanceof HTMLElement
      ? document.querySelector(`#${field.id}-error`)
      : null;
    if (field instanceof HTMLElement) {
      field.setAttribute("aria-invalid", "true");
    }
    if (error) {
      error.textContent = message;
    }
  }

  const firstInvalidField = Object.keys(errors)
    .map((name) => requestForm.elements.namedItem(name))
    .find((field) => field instanceof HTMLElement);
  firstInvalidField?.focus();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function appendDetail(container, label, value) {
  const detail = document.createElement("p");
  detail.className = "request-detail";
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  detail.append(strong, document.createTextNode(value));
  container.append(detail);
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

function createRequestCard(request, includeDetailsButton = false) {
  const card = document.createElement("article");
  card.className = "request-card";
  const heading = document.createElement("div");
  heading.className = "request-card-heading";
  const title = document.createElement("h2");
  title.textContent = request.title;
  const status = document.createElement("span");
  status.className = `status-badge status-${request.status}`;
  status.textContent = STATUS_LABELS[request.status] ?? request.status;
  heading.append(title, status);

  const identifier = document.createElement("p");
  identifier.className = "request-id";
  identifier.textContent = `ID: ${request.id}`;
  const description = document.createElement("p");
  description.className = "request-description";
  description.textContent = request.description;
  const details = document.createElement("div");
  details.className = "request-details";
  appendDetail(details, "Categoria", request.category);
  appendDetail(details, "Quantidade", `${request.quantity} ${request.unit}`);
  appendDetail(details, "Região aproximada", request.region);
  appendDetail(details, "Urgência declarada", URGENCY_LABELS[request.declaredUrgency]);
  appendDetail(details, "Criada em", formatDate(request.createdAt));
  appendDetail(
    details,
    "Voluntário responsável",
    request.assignedVolunteerId ?? "Sem voluntário ativo",
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
  actions.dataset.requestId = request.id;
  for (const option of actionOptions(request)) {
    const button = document.createElement("button");
    button.className = `button ${option.style}`;
    button.type = "button";
    button.dataset.action = option.action;
    button.dataset.requestId = request.id;
    button.textContent = option.label;
    actions.append(button);
  }
  if (includeDetailsButton) {
    const detailsButton = document.createElement("button");
    detailsButton.className = "button button-secondary";
    detailsButton.type = "button";
    detailsButton.dataset.action = "details";
    detailsButton.dataset.requestId = request.id;
    detailsButton.textContent = "Ver detalhes";
    actions.append(detailsButton);
  }

  card.append(heading, identifier, description, details, actions);
  return card;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
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
    const searchableText = [
      request.title,
      request.description,
      request.category,
    ].map(normalizeSearchText);

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
      groupedRequests.push([STATUS_FILTER_OPTIONS.find((option) => option.value === currentStatus).label, statusRequests]);
    }
  }

  return { matches, groupedRequests };
}

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
    for (const request of groupRequests) {
      cards.append(createRequestCard(request, true));
    }
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

  for (const request of recentRequests) {
    const card = document.createElement("article");
    card.className = "request-card recent-request-card";
    const heading = document.createElement("div");
    heading.className = "request-card-heading";
    const title = document.createElement("h2");
    title.textContent = request.title;
    const status = document.createElement("span");
    status.className = `status-badge status-${request.status}`;
    status.textContent = STATUS_LABELS[request.status] ?? request.status;
    heading.append(title, status);

    const identifier = document.createElement("p");
    identifier.className = "request-id";
    identifier.textContent = `ID: ${request.id} · ${request.category} · Criada em ${formatDate(request.createdAt)}`;
    const openDetails = document.createElement("button");
    openDetails.className = "button button-secondary";
    openDetails.type = "button";
    openDetails.dataset.action = "details";
    openDetails.dataset.requestId = request.id;
    openDetails.textContent = "Abrir detalhes";
    const actions = document.createElement("div");
    actions.className = "request-actions";
    actions.append(openDetails);
    card.append(heading, identifier, actions);
    recentRequestList.append(card);
  }
}

function renderSelectedRequest() {
  detailsContainer.replaceChildren();
  const selected = requests.find((request) => request.id === selectedRequestId);
  detailsEmpty.hidden = Boolean(selected);
  if (selected) {
    detailsContainer.append(createRequestCard(selected));
  }
}

function renderHistory() {
  historyList.replaceChildren();
  const entries = requests.flatMap((request) => request.history.map((entry) => ({
    ...entry,
    requestId: request.id,
    requestTitle: request.title,
  }))).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  historyEmpty.hidden = entries.length > 0;
  historyList.hidden = entries.length === 0;

  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "history-entry";
    const heading = document.createElement("h2");
    heading.textContent = entry.requestTitle;
    const detail = document.createElement("p");
    detail.textContent = entry.description;
    const previous = entry.previousStatus ? STATUS_LABELS[entry.previousStatus] ?? entry.previousStatus : "—";
    const next = entry.newStatus ? STATUS_LABELS[entry.newStatus] ?? entry.newStatus : "—";
    const statusLine = document.createElement("p");
    statusLine.className = "history-status";
    statusLine.textContent = `Estado: ${previous} → ${next} · Ação: ${entry.actionType}`;
    const metadata = document.createElement("p");
    metadata.className = "request-id";
    metadata.textContent = `${formatDate(entry.timestamp)} · ID: ${entry.requestId} · Perfil: ${entry.role} (${entry.actorId})`;
    const detailsButton = document.createElement("button");
    detailsButton.className = "button button-secondary";
    detailsButton.type = "button";
    detailsButton.dataset.action = "details";
    detailsButton.dataset.requestId = entry.requestId;
    detailsButton.textContent = "Ver solicitação";
    item.append(heading, detail, statusLine, metadata);
    if (entry.reason) {
      const reason = document.createElement("p");
      reason.className = "request-description";
      reason.textContent = `Justificativa: ${entry.reason}`;
      item.append(reason);
    }
    const actions = document.createElement("div");
    actions.className = "request-actions";
    actions.append(detailsButton);
    item.append(actions);
    historyList.append(item);
  }
}

function renderApplication() {
  renderRequestList();
  renderRecentRequests();
  renderSelectedRequest();
  renderHistory();
  renderDashboard(requests);
}

function readFormValues() {
  const formData = new FormData(requestForm);
  return Object.fromEntries(formData.entries());
}

function logUnexpectedError(message, error) {
  if (!(error instanceof StorageError) && !error?.validationErrors) {
    console.error(message, error);
  }
}

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
});

function openActionDialog(action, requestId) {
  const configuration = ACTION_DIALOGS[action];
  if (!configuration) {
    return;
  }
  pendingAction = { action, requestId, profile: currentProfile() };
  actionDialogTitle.textContent = configuration.title;
  actionDialogDescription.textContent = configuration.description;
  actionDialog.querySelector("#action-dialog-confirm").textContent = configuration.confirmLabel;
  actionReasonField.hidden = !configuration.requiresReason;
  actionReason.required = Boolean(configuration.requiresReason);
  actionReason.value = "";
  actionReasonError.textContent = "";
  actionReason.removeAttribute("aria-invalid");
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

function handleActionClick(event) {
  const button = event.target.closest("button[data-action][data-request-id]");
  if (!button) {
    return;
  }
  if (button.dataset.action === "details") {
    selectedRequestId = button.dataset.requestId;
    renderSelectedRequest();
    showView("details");
    return;
  }
  actionMessage.hidden = true;
  openActionDialog(button.dataset.action, button.dataset.requestId);
}

requestList.addEventListener("click", handleActionClick);
detailsContainer.addEventListener("click", handleActionClick);
recentRequestList.addEventListener("click", handleActionClick);
historyList.addEventListener("click", handleActionClick);

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
  pendingAction = null;
  actionDialog.close();
});

actionDialog.addEventListener("close", () => {
  pendingAction = null;
});

actionDialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!pendingAction) {
    return;
  }

  const configuration = ACTION_DIALOGS[pendingAction.action];
  const reason = actionReason.value.trim();
  if (configuration.requiresReason && (reason.length < 3 || reason.length > 500)) {
    actionReasonError.textContent = "A justificativa deve ter de 3 a 500 caracteres.";
    actionReason.setAttribute("aria-invalid", "true");
    actionReason.focus();
    return;
  }
  actionReason.removeAttribute("aria-invalid");

  const submitButton = actionDialog.querySelector("#action-dialog-confirm");
  submitButton.disabled = true;
  try {
    const updatedRequest = executeAction(
      pendingAction.action,
      pendingAction.requestId,
      pendingAction.profile,
      reason,
    );
    requests = requests.map((request) => (
      request.id === updatedRequest.id ? updatedRequest : request
    ));
    renderApplication();
    const successText = pendingAction.action === "confirm"
      ? "Recebimento registrado somente na demonstração."
      : `${configuration.confirmLabel} — alteração registrada.`;
    setNotice(actionMessage, successText, "success");
    storageMessage.hidden = true;
    actionDialog.close();
  } catch (error) {
    logUnexpectedError("Falha ao executar ação da solicitação:", error);
    actionReasonError.textContent = configuration.requiresReason ? error.message : "";
    if (!configuration.requiresReason) {
      setNotice(actionMessage, error.message, "error");
    }
  } finally {
    submitButton.disabled = false;
  }
});

profileSelect.addEventListener("change", () => {
  requestForm.querySelector("#request-submit").disabled = currentProfile().role === "voluntario";
  formMessage.hidden = true;
  actionMessage.hidden = true;
  renderApplication();
});

function initialize() {
  try {
    requests = loadRequests();
  } catch (error) {
    logUnexpectedError("Falha ao inicializar os dados locais:", error);
    requests = error instanceof StorageError ? error.validRequests ?? [] : [];
    setNotice(storageMessage, error.message, "error");
  }

  renderApplication();
}

requestForm.addEventListener("input", () => {
  clearFieldErrors();
  formMessage.hidden = true;
});

requestForm.addEventListener("change", () => {
  clearFieldErrors();
});

requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isSubmitting) {
    return;
  }
  if (!["solicitante", "moderador"].includes(currentProfile().role)) {
    setNotice(formMessage, "O cadastro está disponível apenas aos perfis de solicitante ou moderador da demonstração.", "error");
    return;
  }

  clearFieldErrors();
  const validation = validateRequestInput(readFormValues());
  if (!validation.isValid) {
    showFieldErrors(validation.errors);
    setNotice(formMessage, "Revise os campos destacados antes de salvar.", "error");
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
    setNotice(formMessage, "Solicitação cadastrada e salva neste navegador.", "success");
    storageMessage.hidden = true;
  } catch (error) {
    logUnexpectedError("Falha ao cadastrar a solicitação:", error);
    if (error.validationErrors) {
      showFieldErrors(error.validationErrors);
      setNotice(formMessage, "Revise os campos destacados antes de salvar.", "error");
    } else {
      setNotice(formMessage, error.message, "error");
    }
  } finally {
    isSubmitting = false;
    submitButton.disabled = false;
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) {
    return;
  }

  try {
    requests = loadRequests();
    storageMessage.hidden = true;
    renderApplication();
  } catch (error) {
    logUnexpectedError("Falha ao atualizar dados locais de outra aba:", error);
    if (error instanceof StorageError && error.validRequests) {
      requests = error.validRequests;
    }
    setNotice(storageMessage, error.message, "error");
    renderApplication();
  }
});

initialize();
