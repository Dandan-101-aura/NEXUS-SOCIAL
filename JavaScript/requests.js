import { loadRequests, updateRequest } from "./storage.js";

export const REQUEST_CATEGORIES = Object.freeze([
  "Alimentos não perecíveis",
  "Produtos de higiene",
  "Roupas",
  "Itens básicos de uso cotidiano",
]);

export const REQUEST_URGENCY_OPTIONS = Object.freeze([
  Object.freeze({ value: "baixa", label: "Baixa" }),
  Object.freeze({ value: "media", label: "Média" }),
  Object.freeze({ value: "alta", label: "Alta" }),
]);
export const REQUEST_URGENCIES = Object.freeze(
  REQUEST_URGENCY_OPTIONS.map((option) => option.value),
);
export const REQUEST_STATUSES = Object.freeze([
  "aberto",
  "em_atendimento",
  "conclusao_declarada",
  "recebimento_confirmado",
  "cancelado",
  "suspenso_para_revisao",
]);
export const REQUEST_INITIAL_STATUS = "aberto";
export const DEMO_PROFILES = Object.freeze({
  requester: Object.freeze({
    id: "solicitante-demo",
    role: "solicitante",
    label: "Solicitante de demonstração",
  }),
  volunteer: Object.freeze({
    id: "voluntario-demo",
    role: "voluntario",
    label: "Voluntário de demonstração",
  }),
  moderator: Object.freeze({
    id: "moderador-demo",
    role: "moderador",
    label: "Moderador de demonstração",
  }),
});
export const ALLOWED_TRANSITIONS = Object.freeze({
  aberto: Object.freeze([
    "em_atendimento",
    "cancelado",
    "suspenso_para_revisao",
  ]),
  em_atendimento: Object.freeze([
    "aberto",
    "conclusao_declarada",
    "cancelado",
    "suspenso_para_revisao",
  ]),
  conclusao_declarada: Object.freeze([
    "recebimento_confirmado",
    "suspenso_para_revisao",
  ]),
  recebimento_confirmado: Object.freeze(["suspenso_para_revisao"]),
  cancelado: Object.freeze(["aberto"]),
  suspenso_para_revisao: Object.freeze(["aberto", "cancelado"]),
});
export const REQUEST_UNIT_OPTIONS = Object.freeze([
  Object.freeze({ value: "unidades", label: "Unidades" }),
  Object.freeze({ value: "kg", label: "Quilogramas (kg)" }),
  Object.freeze({ value: "g", label: "Gramas (g)" }),
  Object.freeze({ value: "litros", label: "Litros" }),
  Object.freeze({ value: "pacotes", label: "Pacotes" }),
  Object.freeze({ value: "caixas", label: "Caixas" }),
  Object.freeze({ value: "pares", label: "Pares" }),
  Object.freeze({ value: "peças", label: "Peças" }),
]);
export const REQUEST_UNITS = Object.freeze(
  REQUEST_UNIT_OPTIONS.map((option) => option.value),
);
export const REQUEST_CATEGORY_OPTIONS = Object.freeze(
  REQUEST_CATEGORIES.map((category) =>
    Object.freeze({ value: category, label: category }),
  ),
);

export const REQUEST_LIMITS = Object.freeze({
  title: Object.freeze({ min: 4, max: 100 }),
  description: Object.freeze({ min: 10, max: 1000 }),
  region: Object.freeze({ min: 2, max: 80 }),
  quantity: Object.freeze({ min: 0.01, max: 1_000_000 }),
});

const REQUIRED_TEXT_FIELDS = Object.freeze([
  ["title", "Título"],
  ["description", "Descrição"],
  ["region", "Região aproximada"],
]);

function characterCount(value) {
  return [...value].length;
}

function makeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `req-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// Converte a quantidade digitada em número. Aceita o formato brasileiro
// ("2,5" e "1.234,5") e o formato com ponto ("2.5"). Qualquer outra coisa vira NaN.
export function parseQuantity(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return Number.NaN;
  }
  const text = value.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    return Number(text.replace(/\./g, "").replace(",", "."));
  }
  if (/^\d+(,\d+)?$/.test(text)) {
    return Number(text.replace(",", "."));
  }
  if (/^\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }
  return Number.NaN;
}

export function validateRequestInput(input) {
  const errors = {};
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const values = {
    title: typeof source.title === "string" ? source.title.trim() : "",
    description:
      typeof source.description === "string" ? source.description.trim() : "",
    category: typeof source.category === "string" ? source.category : "",
    quantity: parseQuantity(source.quantity),
    unit: typeof source.unit === "string" ? source.unit : "",
    region: typeof source.region === "string" ? source.region.trim() : "",
    declaredUrgency:
      typeof source.declaredUrgency === "string" ? source.declaredUrgency : "",
  };

  for (const [field, label] of REQUIRED_TEXT_FIELDS) {
    if (!values[field]) {
      errors[field] = `${label} é obrigatório.`;
    }
  }

  for (const field of ["title", "description", "region"]) {
    if (
      values[field] &&
      characterCount(values[field]) > REQUEST_LIMITS[field].max
    ) {
      errors[field] =
        `${field === "title" ? "O título" : field === "description" ? "A descrição" : "A região"} deve ter no máximo ${REQUEST_LIMITS[field].max} caracteres.`;
    } else if (
      values[field] &&
      characterCount(values[field]) < REQUEST_LIMITS[field].min
    ) {
      errors[field] =
        `${field === "title" ? "O título" : field === "description" ? "A descrição" : "A região"} deve ter pelo menos ${REQUEST_LIMITS[field].min} caracteres.`;
    }
  }

  if (!REQUEST_CATEGORIES.includes(values.category)) {
    errors.category = "Selecione uma categoria permitida.";
  }

  if (!Number.isFinite(values.quantity)) {
    errors.quantity = "Informe uma quantidade numérica válida.";
  } else if (values.quantity <= 0) {
    errors.quantity = "A quantidade deve ser maior que zero.";
  } else if (values.quantity < REQUEST_LIMITS.quantity.min) {
    errors.quantity = `A quantidade mínima é ${REQUEST_LIMITS.quantity.min}.`;
  } else if (values.quantity > REQUEST_LIMITS.quantity.max) {
    errors.quantity = `A quantidade máxima é ${REQUEST_LIMITS.quantity.max}.`;
  }

  if (!REQUEST_UNITS.includes(values.unit)) {
    errors.unit = "Selecione uma unidade de medida permitida.";
  }

  if (!REQUEST_URGENCIES.includes(values.declaredUrgency)) {
    errors.declaredUrgency = "Selecione uma urgência permitida.";
  }

  if (
    values.region &&
    /\b(?:rua|r\.|avenida|av\.|travessa|tv\.|alameda|rodovia|estrada)\b[^,\n]{0,80}(?:,\s*|\s+n[ºo°.]?\s*)\d{1,6}\b/i.test(
      values.region,
    )
  ) {
    errors.region =
      "Informe apenas bairro ou município, sem rua e número de endereço.";
  }

  return { isValid: Object.keys(errors).length === 0, errors, values };
}

function makeUniqueId(existingRequests) {
  const existingIds = new Set(existingRequests.map((request) => request.id));
  let id = makeId();
  while (existingIds.has(id)) {
    id = makeId();
  }
  return id;
}

export function createRequest(
  input,
  existingRequests = [],
  profile = DEMO_PROFILES.requester,
) {
  const validation = validateRequestInput(input);
  if (!validation.isValid) {
    const error = new Error("Os dados da solicitação são inválidos.");
    error.validationErrors = validation.errors;
    throw error;
  }
  assertProfile(profile, ["solicitante", "moderador"]);

  const now = new Date().toISOString();
  const requestId = makeUniqueId(existingRequests);
  const request = {
    id: requestId,
    ...validation.values,
    requesterId: profile.id,
    status: REQUEST_INITIAL_STATUS,
    createdAt: now,
    updatedAt: now,
    assignedVolunteerId: null,
    completedAt: null,
    receiptConfirmedAt: null,
    history: [],
  };
  appendHistory(request, {
    actionType: "solicitacao_criada",
    profile,
    description: "Solicitação cadastrada.",
    previousStatus: null,
    newStatus: request.status,
    timestamp: now,
  });
  return request;
}

function assertProfile(profile, allowedRoles) {
  if (
    !profile ||
    !Object.values(DEMO_PROFILES).some(
      (known) => known.id === profile.id && known.role === profile.role,
    )
  ) {
    throw new Error("Selecione um perfil de demonstração válido.");
  }
  if (!allowedRoles.includes(profile.role)) {
    throw new Error(
      "O perfil de demonstração selecionado não pode executar esta ação.",
    );
  }
}

function appendHistory(
  request,
  {
    actionType,
    profile,
    description,
    previousStatus = request.status,
    newStatus = request.status,
    reason = null,
    timestamp = new Date().toISOString(),
  },
) {
  request.history = [
    ...request.history,
    {
      id: makeId(),
      requestId: request.id,
      timestamp,
      previousStatus,
      newStatus,
      actionType,
      role: profile.role,
      actorId: profile.id,
      description,
      reason,
    },
  ];
}

function requireReason(reason, label) {
  if (
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.trim().length > 500
  ) {
    throw new Error(`Informe ${label} com 3 a 500 caracteres.`);
  }
  return reason.trim();
}

function requireTransition(request, nextStatus) {
  if (!ALLOWED_TRANSITIONS[request.status]?.includes(nextStatus)) {
    throw new Error(
      `Transição não permitida: ${request.status} → ${nextStatus}.`,
    );
  }
}

function performOperation(requestId, profile, allowedRoles, operation) {
  assertProfile(profile, allowedRoles);
  if (typeof requestId !== "string" || !requestId.trim()) {
    throw new Error("Identificador de solicitação inválido.");
  }

  return updateRequest(requestId, (current) => {
    const next = { ...current, history: [...current.history] };
    operation(next);
    return next;
  });
}

export function assignVolunteer(requestId, profile) {
  return performOperation(requestId, profile, ["voluntario"], (request) => {
    requireTransition(request, "em_atendimento");
    if (request.assignedVolunteerId !== null) {
      throw new Error("A solicitação já possui um voluntário responsável.");
    }
    const previousStatus = request.status;
    request.status = "em_atendimento";
    request.assignedVolunteerId = profile.id;
    request.updatedAt = new Date().toISOString();
    appendHistory(request, {
      actionType: "voluntario_atribuido",
      profile,
      description: "Voluntário assumiu o atendimento.",
      previousStatus,
      newStatus: request.status,
      timestamp: request.updatedAt,
    });
  });
}

export function withdrawFromRequest(requestId, profile) {
  return performOperation(requestId, profile, ["voluntario"], (request) => {
    requireTransition(request, "aberto");
    if (request.assignedVolunteerId !== profile.id) {
      throw new Error(
        "Somente o voluntário responsável pode desistir deste atendimento.",
      );
    }
    const previousStatus = request.status;
    request.status = "aberto";
    request.assignedVolunteerId = null;
    request.updatedAt = new Date().toISOString();
    appendHistory(request, {
      actionType: "voluntario_desistiu",
      profile,
      description:
        "Voluntário desistiu do atendimento; solicitação voltou a ficar aberta.",
      previousStatus,
      newStatus: request.status,
      timestamp: request.updatedAt,
    });
  });
}

export function declareCompletion(requestId, profile) {
  return performOperation(requestId, profile, ["voluntario"], (request) => {
    requireTransition(request, "conclusao_declarada");
    if (request.assignedVolunteerId !== profile.id) {
      throw new Error(
        "Somente o voluntário responsável pode declarar a conclusão.",
      );
    }
    const previousStatus = request.status;
    request.status = "conclusao_declarada";
    request.completedAt = new Date().toISOString();
    request.updatedAt = request.completedAt;
    appendHistory(request, {
      actionType: "conclusao_declarada",
      profile,
      description:
        "Voluntário declarou o atendimento concluído. O recebimento ainda não foi confirmado.",
      previousStatus,
      newStatus: request.status,
      timestamp: request.updatedAt,
    });
  });
}

export function confirmReceipt(requestId, profile) {
  return performOperation(
    requestId,
    profile,
    ["solicitante", "moderador"],
    (request) => {
      requireTransition(request, "recebimento_confirmado");
      if (
        profile.role === "solicitante" &&
        request.requesterId !== profile.id
      ) {
        throw new Error(
          "Somente o solicitante associado pode confirmar o recebimento na demonstração.",
        );
      }
      if (!request.completedAt) {
        throw new Error(
          "A conclusão precisa ser declarada antes da confirmação.",
        );
      }
      const previousStatus = request.status;
      request.status = "recebimento_confirmado";
      request.receiptConfirmedAt = new Date().toISOString();
      request.updatedAt = request.receiptConfirmedAt;
      appendHistory(request, {
        actionType: "recebimento_confirmado_demo",
        profile,
        description:
          "Recebimento confirmado no contexto da demonstração; nenhuma entrega física foi verificada.",
        previousStatus,
        newStatus: request.status,
        timestamp: request.updatedAt,
      });
    },
  );
}

export function cancelRequest(requestId, profile, reason) {
  const cancellationReason = requireReason(
    reason,
    "um motivo para o cancelamento",
  );
  return performOperation(
    requestId,
    profile,
    ["solicitante", "moderador"],
    (request) => {
      requireTransition(request, "cancelado");
      if (
        profile.role === "solicitante" &&
        request.requesterId !== profile.id
      ) {
        throw new Error(
          "Somente o solicitante associado pode cancelar esta solicitação.",
        );
      }
      const previousStatus = request.status;
      request.status = "cancelado";
      request.assignedVolunteerId = null;
      request.updatedAt = new Date().toISOString();
      request.cancellationReason = cancellationReason;
      appendHistory(request, {
        actionType: "solicitacao_cancelada",
        profile,
        description: "Solicitação cancelada.",
        previousStatus,
        newStatus: request.status,
        reason: cancellationReason,
        timestamp: request.updatedAt,
      });
    },
  );
}

export function suspendForReview(requestId, profile, reason) {
  const reviewReason = requireReason(
    reason,
    "uma justificativa para a suspensão",
  );
  return performOperation(requestId, profile, ["moderador"], (request) => {
    requireTransition(request, "suspenso_para_revisao");
    const previousStatus = request.status;
    if (request.assignedVolunteerId !== null) {
      request.suspendedVolunteerId = request.assignedVolunteerId;
      request.assignedVolunteerId = null;
    }
    request.status = "suspenso_para_revisao";
    request.updatedAt = new Date().toISOString();
    request.reviewReason = reviewReason;
    appendHistory(request, {
      actionType: "solicitacao_suspensa",
      profile,
      description: "Solicitação suspensa para revisão.",
      previousStatus,
      newStatus: request.status,
      reason: reviewReason,
      timestamp: request.updatedAt,
    });
  });
}

export function reopenRequest(requestId, profile, reason) {
  const reopeningReason = requireReason(
    reason,
    "uma justificativa para a reabertura",
  );
  return performOperation(requestId, profile, ["moderador"], (request) => {
    requireTransition(request, "aberto");
    const previousStatus = request.status;
    request.status = "aberto";
    request.assignedVolunteerId = null;
    request.updatedAt = new Date().toISOString();
    request.reopeningReason = reopeningReason;
    appendHistory(request, {
      actionType: "solicitacao_reaberta",
      profile,
      description: "Solicitação reaberta explicitamente para uma nova etapa.",
      previousStatus,
      newStatus: request.status,
      reason: reopeningReason,
      timestamp: request.updatedAt,
    });
  });
}

export function getRequestHistory(requestId) {
  if (typeof requestId !== "string" || !requestId.trim()) {
    throw new Error("Identificador de solicitação inválido.");
  }
  const request = loadRequests().find((item) => item.id === requestId);
  if (!request) {
    throw new Error("A solicitação não foi encontrada.");
  }
  return [...request.history].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
}
