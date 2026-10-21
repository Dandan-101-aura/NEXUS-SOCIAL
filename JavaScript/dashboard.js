import { createIcon } from "./icons.js";

const STATUS_LABELS = Object.freeze({
  aberto: "Solicitações abertas",
  em_atendimento: "Atendimentos em andamento",
  conclusao_declarada: "Conclusões declaradas",
  recebimento_confirmado: "Recebimentos confirmados",
  cancelado: "Solicitações canceladas",
  suspenso_para_revisao: "Suspensas para revisão",
});

const STATUS_ICONS = Object.freeze({
  aberto: "circle-dot",
  em_atendimento: "clock",
  conclusao_declarada: "check-circle",
  recebimento_confirmado: "shield-check",
  cancelado: "x-circle",
  suspenso_para_revisao: "pause-circle",
});

const STATUS_ORDER = Object.freeze(Object.keys(STATUS_LABELS));

export function compareNewestFirst(a, b) {
  const dateDifference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return dateDifference || a.id.localeCompare(b.id);
}

export function renderDashboard(requests) {
  const container = document.querySelector("#dashboard-stats");
  const totals = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));

  for (const request of requests) {
    if (Object.hasOwn(totals, request.status)) {
      totals[request.status] += 1;
    }
  }

  container.replaceChildren();
  for (const status of STATUS_ORDER) {
    const card = document.createElement("article");
    card.className = `stat-card stat-${status}`;
    const iconWrap = document.createElement("span");
    iconWrap.className = "stat-icon";
    iconWrap.append(createIcon(STATUS_ICONS[status]));
    const heading = document.createElement("h3");
    heading.textContent = STATUS_LABELS[status];
    const count = document.createElement("p");
    count.className = "stat-value";
    count.textContent = String(totals[status]);
    card.append(iconWrap, heading, count);
    container.append(card);
  }

  return totals;
}

export function getRecentRequests(requests, limit = 5) {
  return [...requests].sort(compareNewestFirst).slice(0, limit);
}
