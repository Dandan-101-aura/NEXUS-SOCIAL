export const REQUEST_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: "aberto", label: "Aberta" }),
  Object.freeze({ value: "em_atendimento", label: "Em atendimento" }),
  Object.freeze({ value: "conclusao_declarada", label: "Conclusão declarada" }),
  Object.freeze({ value: "recebimento_confirmado", label: "Recebimento confirmado" }),
  Object.freeze({ value: "cancelado", label: "Cancelada" }),
  Object.freeze({ value: "suspenso_para_revisao", label: "Suspensa para revisão" }),
]);

export const URGENCY_PRIORITY = Object.freeze({ alta: 0, media: 1, baixa: 2 });

const NON_OPEN_STATUSES = Object.freeze(
  REQUEST_STATUS_OPTIONS.filter(({ value }) => value !== "aberto"),
);

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function compareOldestFirst(a, b) {
  const dateDifference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return dateDifference || a.id.localeCompare(b.id);
}

export function compareNewestFirst(a, b) {
  const dateDifference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return dateDifference || a.id.localeCompare(b.id);
}

export function getFilteredRequests(
  requests,
  { term = "", category = "", status = "", urgency = "" } = {},
) {
  const normalizedTerm = normalizeSearchText(term);
  const matches = requests.filter((request) => {
    const searchableText = [
      request.title,
      request.description,
      request.category,
    ].map(normalizeSearchText);

    return (!normalizedTerm || searchableText.some((field) => field.includes(normalizedTerm)))
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

  for (const { value, label } of NON_OPEN_STATUSES) {
    const statusRequests = matches
      .filter((request) => request.status === value)
      .sort(compareNewestFirst);
    if (statusRequests.length) {
      groupedRequests.push([label, statusRequests]);
    }
  }

  return { matches, groupedRequests };
}
