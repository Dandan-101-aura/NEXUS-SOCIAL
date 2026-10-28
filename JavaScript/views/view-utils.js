import { DEMO_PROFILES } from "../requests.js";
import { createCategoryBanner } from "../categories.js";
import { createIcon } from "../icons.js";

export const STATUS_LABELS = Object.freeze({
  aberto: "Aberta",
  em_atendimento: "Em atendimento",
  conclusao_declarada: "Conclusão declarada",
  recebimento_confirmado: "Recebimento confirmado (demonstração)",
  cancelado: "Cancelada",
  suspenso_para_revisao: "Suspensa para revisão",
});

export const ROLE_LABELS = Object.freeze({
  solicitante: "Solicitante",
  voluntario: "Voluntário",
  moderador: "Moderador",
});

export const ACTION_LABELS = Object.freeze({
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

export const URGENCY_LABELS = Object.freeze({
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
});

const quantityFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export function actorLabel(actorId) {
  return (
    Object.values(DEMO_PROFILES).find((profile) => profile.id === actorId)
      ?.label ?? actorId
  );
}

export function shortId(id) {
  return id.slice(0, 8).toUpperCase();
}

export function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function populateSelect(select, options) {
  const placeholder = select.options[0];
  select.replaceChildren(placeholder);
  for (const item of options) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  }
}

export function appendDetail(container, label, value) {
  const detail = document.createElement("p");
  detail.className = "request-detail";
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  detail.append(strong, document.createTextNode(value));
  container.append(detail);
}

export function makeChip(text, iconName, extraClass = "") {
  const chip = document.createElement("span");
  chip.className = `chip ${extraClass}`.trim();
  if (iconName) {
    chip.append(createIcon(iconName));
  }
  chip.append(document.createTextNode(text));
  return chip;
}

export function makeButton(
  label,
  action,
  requestId,
  style = "button-secondary",
) {
  const button = document.createElement("button");
  button.className = `button ${style}`;
  button.type = "button";
  button.dataset.action = action;
  button.dataset.requestId = requestId;
  button.textContent = label;
  return button;
}

export function getActionOptions(request, profile) {
  const options = [];
  const add = (action, label, style = "button-secondary") =>
    options.push({ action, label, style });

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
    if (
      profile.role === "voluntario" &&
      request.assignedVolunteerId === profile.id
    ) {
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
  } else if (
    request.status === "recebimento_confirmado" &&
    profile.role === "moderador"
  ) {
    add("suspend", "Suspender para revisão");
  } else if (
    request.status === "cancelado" ||
    request.status === "suspenso_para_revisao"
  ) {
    if (profile.role === "moderador") {
      add("reopen", "Reabrir solicitação", "button-primary");
      if (request.status === "suspenso_para_revisao") {
        add("cancel", "Cancelar solicitação");
      }
    }
  }

  return options;
}

export function createRequestCard(
  request,
  { profile, withDetailsButton = false, headingLevel = 2, index = 0 } = {},
) {
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
    makeChip(
      `Urgência ${URGENCY_LABELS[request.declaredUrgency].toLowerCase()}`,
      null,
      `urgency-pill urgency-${request.declaredUrgency}`,
    ),
  );

  const details = document.createElement("div");
  details.className = "request-details";
  appendDetail(details, "Criada em", formatDate(request.createdAt));
  appendDetail(
    details,
    "Voluntário responsável",
    request.assignedVolunteerId
      ? actorLabel(request.assignedVolunteerId)
      : "Sem voluntário ativo",
  );
  if (request.cancellationReason) {
    appendDetail(details, "Motivo do cancelamento", request.cancellationReason);
  }
  if (request.reviewReason) {
    appendDetail(details, "Justificativa da revisão", request.reviewReason);
  }
  if (request.completedAt) {
    appendDetail(
      details,
      "Conclusão declarada em",
      formatDate(request.completedAt),
    );
  }
  if (request.receiptConfirmedAt) {
    appendDetail(
      details,
      "Última confirmação registrada na demonstração",
      formatDate(request.receiptConfirmedAt),
    );
  }

  const actions = document.createElement("div");
  actions.className = "request-actions";
  for (const option of getActionOptions(request, profile)) {
    actions.append(
      makeButton(option.label, option.action, request.id, option.style),
    );
  }
  if (withDetailsButton) {
    actions.append(makeButton("Ver detalhes", "details", request.id));
  }

  const urgencyBar = document.createElement("div");
  urgencyBar.className = `urgency-bar urgency-bar-${request.declaredUrgency}`;
  card.append(
    createCategoryBanner(request.category),
    heading,
    identifier,
    description,
    meta,
    details,
    actions,
    urgencyBar,
  );
  return card;
}

export function createSummaryCard(request, index, actionLabel) {
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
  actions.append(makeButton(actionLabel, "details", request.id));
  card.append(
    createCategoryBanner(request.category),
    heading,
    identifier,
    actions,
  );
  return card;
}
