import {
  ALLOWED_TRANSITIONS,
  createRequest,
  DEMO_PROFILES,
  validateRequestInput,
} from "./requests.js";
import { SCHEMA_VERSION, validateStoredRequest } from "./storage.js";

export const MAX_BACKUP_SIZE_BYTES = 5 * 1024 * 1024;
const REQUEST_IMPORT_KEYS = new Set([
  "id",
  "title",
  "description",
  "category",
  "quantity",
  "unit",
  "region",
  "declaredUrgency",
  "requesterId",
  "status",
  "createdAt",
  "updatedAt",
  "assignedVolunteerId",
  "completedAt",
  "receiptConfirmedAt",
  "suspendedVolunteerId",
  "cancellationReason",
  "reviewReason",
  "reopeningReason",
  "history",
]);
const HISTORY_IMPORT_KEYS = new Set([
  "id",
  "requestId",
  "timestamp",
  "previousStatus",
  "newStatus",
  "actionType",
  "role",
  "actorId",
  "description",
  "reason",
]);

// ---- Exportar backup -------------------------------------------------------

export function buildBackup(requests) {
  return {
    app: "nexus-social",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    requests,
  };
}

export function backupFileName(date = new Date()) {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `nexus-social-backup-${day}.json`;
}

export function downloadBackup(requests) {
  const json = JSON.stringify(buildBackup(requests), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName();
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resultWithError(message) {
  return {
    ok: false,
    erros: [message],
    avisos: [],
    validas: [],
    duplicadas: [],
    invalidas: [],
  };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasConsistentHistory(request) {
  const { history, status } = request;
  const migratedHistory = history.every(
    (event) =>
      event.actionType === "registro_legado_migrado" &&
      event.previousStatus === null &&
      event.newStatus === status,
  );
  if (
    migratedHistory &&
    ["aberto", "em_atendimento", "conclusao_declarada"].includes(status)
  ) {
    return true;
  }

  if (
    history[0].previousStatus !== null ||
    history[0].newStatus !== "aberto" ||
    history[0].actionType !== "solicitacao_criada"
  ) {
    return false;
  }

  let previousStatus = "aberto";
  for (const event of history.slice(1)) {
    if (
      event.previousStatus !== previousStatus ||
      !ALLOWED_TRANSITIONS[previousStatus]?.includes(event.newStatus)
    ) {
      return false;
    }
    previousStatus = event.newStatus;
  }
  return previousStatus === status;
}

function invalidRequestMessage(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return "O registro não é um objeto de solicitação.";
  }
  if (Object.keys(item).some((key) => !REQUEST_IMPORT_KEYS.has(key))) {
    return "O registro contém campos não suportados.";
  }
  if (
    Array.isArray(item.history) &&
    item.history.some(
      (event) =>
        event &&
        typeof event === "object" &&
        Object.keys(event).some((key) => !HISTORY_IMPORT_KEYS.has(key)),
    )
  ) {
    return "O histórico contém campos não suportados.";
  }
  const validation = validateRequestInput(item);
  const validationMessage = Object.values(validation.errors)[0];
  if (validationMessage) {
    return validationMessage;
  }
  if (!validateStoredRequest({ ...item, ...validation.values })) {
    return "Os dados persistidos, o estado ou o histórico são inválidos.";
  }
  if (!hasConsistentHistory(item)) {
    return "O histórico não corresponde às transições permitidas ou ao estado atual.";
  }
  return null;
}

function normalizeImportedRequest(item) {
  const validation = validateRequestInput(item);
  return { ...item, ...validation.values };
}

function addCountWarnings(result) {
  if (result.duplicadas.length) {
    result.avisos.push(
      `${result.duplicadas.length} solicitação(ões) duplicada(s) serão ignoradas.`,
    );
  }
  const conflicts = result.invalidas.filter((item) =>
    item.motivo.startsWith("Conflito de identificador"),
  ).length;
  if (conflicts) {
    result.avisos.push(
      `${conflicts} conflito(s) de identificador não serão importados.`,
    );
  }
}

export function parseBackup(text, existingRequests = []) {
  if (
    typeof text === "string" &&
    new Blob([text]).size > MAX_BACKUP_SIZE_BYTES
  ) {
    return resultWithError(
      `O arquivo excede o limite de ${MAX_BACKUP_SIZE_BYTES / 1024 / 1024} MB.`,
    );
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    return resultWithError("O arquivo de backup está vazio.");
  }

  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    return resultWithError("O arquivo não contém JSON válido.");
  }

  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return resultWithError("O conteúdo deve ser um envelope JSON de backup.");
  }
  if (Object.hasOwn(envelope, "app") && envelope.app !== "nexus-social") {
    return resultWithError("O arquivo não foi exportado pelo NEXUS SOCIAL.");
  }
  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    return resultWithError(
      `Versão de backup incompatível (${String(envelope.schemaVersion)}). A versão suportada é ${SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(envelope.requests)) {
    return resultWithError(
      "O backup não contém uma coleção de solicitações válida.",
    );
  }

  const result = {
    ok: true,
    erros: [],
    avisos: [],
    validas: [],
    duplicadas: [],
    invalidas: [],
  };
  const requestsById = new Map(
    existingRequests.map((request) => [request.id, request]),
  );
  const requestsByTitle = new Map(
    existingRequests.map((request) => [request.title, request]),
  );

  envelope.requests.forEach((item, index) => {
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (typeof item.id !== "string" || !item.id.trim()) &&
      typeof item.title === "string" &&
      requestsByTitle.has(item.title.trim())
    ) {
      result.duplicadas.push({
        indice: index + 1,
        motivo: "Já existe uma solicitação com este título.",
      });
      return;
    }

    const invalidMessage = invalidRequestMessage(item);
    if (invalidMessage) {
      result.invalidas.push({ indice: index + 1, motivo: invalidMessage });
      return;
    }

    const request = normalizeImportedRequest(item);
    const existingIdRequest = requestsById.get(request.id);
    if (existingIdRequest) {
      if (stableSerialize(existingIdRequest) === stableSerialize(request)) {
        result.duplicadas.push({
          indice: index + 1,
          motivo: "Já existe uma solicitação com este identificador.",
        });
      } else {
        result.invalidas.push({
          indice: index + 1,
          motivo:
            "Conflito de identificador: o registro existente é diferente.",
        });
      }
      return;
    }

    if (requestsByTitle.has(request.title)) {
      result.duplicadas.push({
        indice: index + 1,
        motivo: "Já existe uma solicitação com este título.",
      });
      return;
    }

    requestsById.set(request.id, request);
    requestsByTitle.set(request.title, request);
    result.validas.push(request);
  });

  addCountWarnings(result);
  return result;
}

// ---- Dados de exemplo ------------------------------------------------------
// Todos fictícios. Passam pela mesma validação do formulário (createRequest).

const SAMPLE_INPUTS = Object.freeze([
  {
    title: "Alimentos básicos para a semana (exemplo)",
    description:
      "Arroz, feijão, óleo e macarrão para uma família de quatro pessoas. Dado fictício de demonstração.",
    category: "Alimentos não perecíveis",
    quantity: "12,5",
    unit: "kg",
    region: "Bairro Centro",
    declaredUrgency: "alta",
  },
  {
    title: "Kit de higiene pessoal (exemplo)",
    description:
      "Sabonete, creme dental, escovas e papel higiênico. Dado fictício de demonstração.",
    category: "Produtos de higiene",
    quantity: "6",
    unit: "pacotes",
    region: "Zona Norte",
    declaredUrgency: "media",
  },
  {
    title: "Agasalhos infantis (exemplo)",
    description:
      "Casacos e calças de frio para crianças de 4 a 8 anos. Dado fictício de demonstração.",
    category: "Roupas",
    quantity: "8",
    unit: "peças",
    region: "Bairro Jardim",
    declaredUrgency: "baixa",
  },
  {
    title: "Cobertores e utensílios (exemplo)",
    description:
      "Cobertores, panelas e pratos para uma casa recém-organizada. Dado fictício de demonstração.",
    category: "Itens básicos de uso cotidiano",
    quantity: "5",
    unit: "unidades",
    region: "Zona Sul",
    declaredUrgency: "media",
  },
  {
    title: "Leite e itens de café da manhã (exemplo)",
    description:
      "Leite em caixa, biscoitos e achocolatado para o café da manhã. Dado fictício de demonstração.",
    category: "Alimentos não perecíveis",
    quantity: "2,5",
    unit: "litros",
    region: "Bairro Industrial",
    declaredUrgency: "alta",
  },
]);

// Devolve só os exemplos que ainda NÃO existem (comparando pelo título).
// Nunca altera nem remove solicitações existentes: o resultado é apenas "para acrescentar".
export function buildSampleRequests(existingRequests) {
  const existingTitles = new Set(
    existingRequests.map((request) => request.title),
  );
  const missing = SAMPLE_INPUTS.filter(
    (input) => !existingTitles.has(input.title),
  );
  const created = [];

  missing.forEach((input, index) => {
    const request = createRequest(
      input,
      [...existingRequests, ...created],
      DEMO_PROFILES.requester,
    );
    // Escalona as datas (de horas atrás até agora) para a ordenação por antiguidade ficar realista.
    const stamp = new Date(
      Date.now() - (missing.length - index) * 3_600_000,
    ).toISOString();
    request.createdAt = stamp;
    request.updatedAt = stamp;
    request.history[0].timestamp = stamp;
    created.push(request);
  });

  return created;
}
