import {
  ACTION_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  actorLabel,
  formatDate,
  makeButton,
  shortId,
} from "./view-utils.js";

const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");

export function renderHistoryView(requests) {
  historyList.replaceChildren();
  const entries = requests
    .flatMap((request) =>
      request.history.map((entry) => ({
        ...entry,
        requestId: request.id,
        requestTitle: request.title,
      })),
    )
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

    const previous = entry.previousStatus
      ? (STATUS_LABELS[entry.previousStatus] ?? entry.previousStatus)
      : "—";
    const next = entry.newStatus
      ? (STATUS_LABELS[entry.newStatus] ?? entry.newStatus)
      : "—";
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

export function bindHistoryView(onAction) {
  historyList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-request-id]");
    if (button) {
      onAction(button);
    }
  });
}
