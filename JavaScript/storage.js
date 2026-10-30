import {
  ALLOWED_TRANSITIONS,
  REQUEST_CATEGORIES,
  REQUEST_LIMITS,
  REQUEST_STATUSES,
  REQUEST_UNITS,
  REQUEST_URGENCIES,
  validateRequestInput,
} from "./requests.js";

// nexusSocial.requests stores the versioned collection; migration backups use nexusSocial.requests.backup.v1.<timestamp>.
export const STORAGE_KEY = "nexusSocial.requests";
export const SCHEMA_VERSION = 2;
const MAX_IMPORT_BACKUPS = 3;

export class StorageError extends Error {
  constructor(message, code, cause) {
    super(message, { cause });
    this.name = "StorageError";
    this.code = code;
    this.validRequests = undefined;
  }
}

function getStorage() {
  try {
    const storage = globalThis.localStorage;
    if (
      !storage ||
      typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function"
    ) {
      throw new Error("A API de armazenamento local não está disponível.");
    }
    return storage;
  } catch (error) {
    throw new StorageError(
      "O armazenamento local está indisponível neste navegador.",
      "unavailable",
      error,
    );
  }
}

function isIsoDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export function validateStoredRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return false;
  }

  const isString = (value) =>
    typeof value === "string" && value.trim().length > 0;
  const isNullableIsoDate = (value) => value === null || isIsoDate(value);
  const validInput = validateRequestInput(request);

  const allowedStatuses = REQUEST_STATUSES.includes(request.status);

  return (
    validInput.isValid &&
    [...request.title].length <= REQUEST_LIMITS.title.max &&
    [...request.description].length <= REQUEST_LIMITS.description.max &&
    [...request.region].length <= REQUEST_LIMITS.region.max &&
    isString(request.id) &&
    isString(request.title) &&
    isString(request.description) &&
    REQUEST_CATEGORIES.includes(request.category) &&
    typeof request.quantity === "number" &&
    Number.isFinite(request.quantity) &&
    request.quantity > 0 &&
    REQUEST_UNITS.includes(request.unit) &&
    isString(request.region) &&
    REQUEST_URGENCIES.includes(request.declaredUrgency) &&
    allowedStatuses &&
    isString(request.requesterId) &&
    (request.status === "em_atendimento"
      ? isString(request.assignedVolunteerId)
      : request.assignedVolunteerId === null ||
        (["conclusao_declarada", "recebimento_confirmado"].includes(
          request.status,
        ) &&
          isString(request.assignedVolunteerId))) &&
    (request.suspendedVolunteerId === undefined ||
      request.suspendedVolunteerId === null ||
      isString(request.suspendedVolunteerId)) &&
    isIsoDate(request.createdAt) &&
    isIsoDate(request.updatedAt) &&
    isNullableIsoDate(request.completedAt) &&
    isNullableIsoDate(request.receiptConfirmedAt) &&
    (request.cancellationReason === undefined ||
      (typeof request.cancellationReason === "string" &&
        request.cancellationReason.trim().length >= 3 &&
        request.cancellationReason.length <= 500)) &&
    (request.reviewReason === undefined ||
      (typeof request.reviewReason === "string" &&
        request.reviewReason.trim().length >= 3 &&
        request.reviewReason.length <= 500)) &&
    (request.reopeningReason === undefined ||
      (typeof request.reopeningReason === "string" &&
        request.reopeningReason.trim().length >= 3 &&
        request.reopeningReason.length <= 500)) &&
    (request.status !== "cancelado" ||
      typeof request.cancellationReason === "string") &&
    (request.status !== "suspenso_para_revisao" ||
      typeof request.reviewReason === "string") &&
    (request.status !== "recebimento_confirmado" ||
      isIsoDate(request.receiptConfirmedAt)) &&
    Array.isArray(request.history) &&
    request.history.length > 0 &&
    request.history.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        isString(entry.id) &&
        entry.requestId === request.id &&
        isIsoDate(entry.timestamp) &&
        (entry.previousStatus === null ||
          REQUEST_STATUSES.includes(entry.previousStatus)) &&
        (entry.newStatus === null ||
          REQUEST_STATUSES.includes(entry.newStatus)) &&
        isString(entry.actionType) &&
        ["solicitante", "voluntario", "moderador"].includes(entry.role) &&
        isString(entry.actorId) &&
        isString(entry.description) &&
        (entry.reason === null || typeof entry.reason === "string"),
    )
  );
}

const LEGACY_STATUS = Object.freeze({
  aberto: "aberto",
  atribuido: "em_atendimento",
  concluido: "conclusao_declarada",
});

function makeBackupKey(storage) {
  const base = `${STORAGE_KEY}.backup.v1.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  let key = base;
  let suffix = 1;
  while (storage.getItem(key) !== null) {
    key = `${base}.${suffix}`;
    suffix += 1;
  }
  return key;
}

function migrateLegacyEnvelope(storage, serialized, legacy) {
  if (
    !legacy ||
    legacy.schemaVersion !== 1 ||
    !Array.isArray(legacy.requests)
  ) {
    throw new StorageError(
      `Os dados usam uma versão de esquema incompatível (${String(legacy?.schemaVersion)}). O conteúdo original foi preservado.`,
      "incompatible",
    );
  }

  if (
    !legacy.requests.every(
      (request) =>
        request &&
        typeof request === "object" &&
        ["aberto", "atribuido", "concluido"].includes(request.status),
    )
  ) {
    throw new StorageError(
      "Os dados antigos contêm registros que não podem ser migrados com segurança. O original foi preservado.",
      "incompatible",
    );
  }

  const backupKey = makeBackupKey(storage);
  try {
    storage.setItem(backupKey, serialized);
  } catch (error) {
    throw new StorageError(
      "Não foi possível criar uma cópia de segurança dos dados antigos. A migração foi cancelada.",
      error?.name === "QuotaExceededError" ? "quota-exceeded" : "backup-failed",
      error,
    );
  }

  const requests = legacy.requests.map((request) => {
    let migratedStatus = LEGACY_STATUS[request.status];
    if (migratedStatus === "em_atendimento" && !request.assignedVolunteerId) {
      migratedStatus = "aberto";
    }
    const requesterId =
      typeof request.requesterId === "string"
        ? request.requesterId
        : "solicitante-demo";
    const history = Array.isArray(request.history)
      ? request.history.map((entry) => ({
          id: entry.id,
          requestId: request.id,
          timestamp: entry.timestamp,
          previousStatus: null,
          newStatus: migratedStatus,
          actionType: "registro_legado_migrado",
          role: "solicitante",
          actorId: requesterId,
          description: entry.description,
          reason: null,
        }))
      : [];
    if (history.length === 0) {
      history.push({
        id: `migration-${request.id}`,
        requestId: request.id,
        timestamp: request.updatedAt,
        previousStatus: null,
        newStatus: migratedStatus,
        actionType: "registro_legado_migrado",
        role: "solicitante",
        actorId: requesterId,
        description:
          "Registro migrado do esquema anterior; a sequência histórica completa não estava disponível.",
        reason: null,
      });
    }

    return {
      ...request,
      status: migratedStatus,
      requesterId,
      assignedVolunteerId: [
        "em_atendimento",
        "conclusao_declarada",
        "recebimento_confirmado",
      ].includes(migratedStatus)
        ? request.assignedVolunteerId
        : null,
      completedAt:
        migratedStatus === "conclusao_declarada"
          ? (request.completedAt ?? null)
          : null,
      receiptConfirmedAt: null,
      history,
    };
  });

  if (!requests.every(validateStoredRequest)) {
    throw new StorageError(
      `A cópia de segurança foi criada em "${backupKey}", mas há dados antigos inválidos. O original foi preservado sem migração.`,
      "migration-invalid",
    );
  }

  writeEnvelope(storage, requests);
  return requests;
}

function validateEnvelope(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new StorageError(
      "Os dados locais estão corrompidos. O conteúdo original foi preservado e não será sobrescrito.",
      "corrupt",
    );
  }

  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw new StorageError(
      `Os dados usam uma versão de esquema incompatível (${String(raw.schemaVersion)}). O conteúdo original foi preservado.`,
      "incompatible",
    );
  }

  if (!Array.isArray(raw.requests)) {
    throw new StorageError(
      "A coleção local está corrompida. O conteúdo original foi preservado e não será sobrescrito.",
      "corrupt",
    );
  }

  const validRequests = raw.requests.filter(validateStoredRequest);
  if (validRequests.length !== raw.requests.length) {
    const error = new StorageError(
      "Há registros inválidos no armazenamento local. Os registros válidos foram mantidos para consulta; o conteúdo original não será sobrescrito.",
      "corrupt",
    );
    error.validRequests = validRequests;
    throw error;
  }

  const ids = validRequests.map((request) => request.id);
  if (new Set(ids).size !== ids.length) {
    const error = new StorageError(
      "Há identificadores duplicados no armazenamento local. O conteúdo original foi preservado.",
      "corrupt",
    );
    error.validRequests = validRequests;
    throw error;
  }

  return validRequests;
}

function readStoredRequests(storage) {
  let serialized;
  try {
    serialized = storage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new StorageError(
      "Não foi possível ler o armazenamento local.",
      "read-failed",
      error,
    );
  }

  if (serialized === null) {
    return null;
  }

  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch (error) {
    throw new StorageError(
      "Os dados locais não puderam ser lidos. O conteúdo original foi preservado e não será sobrescrito.",
      "corrupt",
      error,
    );
  }

  if (envelope?.schemaVersion === 1) {
    return migrateLegacyEnvelope(storage, serialized, envelope);
  }

  return validateEnvelope(envelope);
}

function writeEnvelope(storage, requests) {
  const envelope = { schemaVersion: SCHEMA_VERSION, requests };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch (error) {
    const quotaExceeded = error?.name === "QuotaExceededError";
    throw new StorageError(
      quotaExceeded
        ? "O armazenamento local está cheio. Libere espaço e tente novamente."
        : "Não foi possível salvar os dados no armazenamento local.",
      quotaExceeded ? "quota-exceeded" : "write-failed",
      error,
    );
  }
}

export function loadRequests() {
  const storage = getStorage();
  const requests = readStoredRequests(storage);
  if (requests !== null) {
    return requests;
  }

  writeEnvelope(storage, []);
  return [];
}

export function saveRequests(requests) {
  if (!Array.isArray(requests) || !requests.every(validateStoredRequest)) {
    throw new StorageError(
      "Não foi possível salvar: a coleção contém registros inválidos.",
      "invalid-data",
    );
  }

  const incomingIds = requests.map((request) => request.id);
  if (new Set(incomingIds).size !== incomingIds.length) {
    throw new StorageError(
      "Não foi possível salvar: há identificadores duplicados.",
      "invalid-data",
    );
  }

  const storage = getStorage();
  const existingRequests = readStoredRequests(storage) ?? [];
  const existingById = new Map(
    existingRequests.map((request) => [request.id, request]),
  );
  for (const request of requests) {
    const existing = existingById.get(request.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(request)) {
      throw new StorageError(
        "Uma gravação de cadastro não pode substituir uma solicitação existente. Use uma operação de negócio para atualizar o registro.",
        "update-requires-operation",
      );
    }
  }

  const merged = new Map(
    existingRequests.map((request) => [request.id, request]),
  );
  for (const request of requests) {
    merged.set(request.id, request);
  }

  const savedRequests = [...merged.values()];
  writeEnvelope(storage, savedRequests);
  return savedRequests;
}

export function updateRequest(requestId, update) {
  if (typeof update !== "function") {
    throw new TypeError("A atualização deve ser uma função.");
  }

  const requests = loadRequests();
  const index = requests.findIndex((request) => request.id === requestId);
  if (index === -1) {
    throw new StorageError("A solicitação não foi encontrada.", "not-found");
  }

  const currentRequest = requests[index];
  const preservedHistory = JSON.stringify(currentRequest.history);
  const updatedRequest = update(currentRequest);
  if (
    !Array.isArray(updatedRequest?.history) ||
    updatedRequest.history.length <= currentRequest.history.length ||
    JSON.stringify(
      updatedRequest.history.slice(0, currentRequest.history.length),
    ) !== preservedHistory
  ) {
    throw new StorageError(
      "Toda atualização deve acrescentar um evento sem alterar o histórico anterior.",
      "history-must-append",
    );
  }
  const lastEvent = updatedRequest.history.at(-1);
  if (
    updatedRequest.status === currentRequest.status ||
    !ALLOWED_TRANSITIONS[currentRequest.status]?.includes(
      updatedRequest.status,
    ) ||
    lastEvent.previousStatus !== currentRequest.status ||
    lastEvent.newStatus !== updatedRequest.status
  ) {
    throw new StorageError(
      "A atualização não corresponde a uma transição de estado permitida.",
      "invalid-transition",
    );
  }
  const updatedRequests = requests.map((request, currentIndex) =>
    currentIndex === index ? updatedRequest : request,
  );
  if (!updatedRequests.every(validateStoredRequest)) {
    throw new StorageError(
      "A atualização produziria um registro inválido.",
      "invalid-data",
    );
  }

  writeEnvelope(getStorage(), updatedRequests);
  return updatedRequest;
}

export function serializeCollection() {
  const storage = getStorage();
  let serialized;
  try {
    serialized = storage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new StorageError(
      "Não foi possível ler o armazenamento local.",
      "read-failed",
      error,
    );
  }

  if (serialized === null) {
    return JSON.stringify(
      { schemaVersion: SCHEMA_VERSION, requests: [] },
      null,
      2,
    );
  }

  try {
    return JSON.stringify(JSON.parse(serialized), null, 2);
  } catch (error) {
    throw new StorageError(
      "Os dados locais não puderam ser exportados porque estão corrompidos. O original foi preservado.",
      "corrupt",
      error,
    );
  }
}

function makeCurrentBackupKey(storage) {
  const base = `${STORAGE_KEY}.backup.v2.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  let key = base;
  let suffix = 1;
  while (storage.getItem(key) !== null) {
    key = `${base}.${suffix}`;
    suffix += 1;
  }
  return key;
}

function makeImportBackupKey(storage) {
  const isoTimestamp = new Date().toISOString();
  const timestamp = isoTimestamp.replace(/[:.]/g, "-");
  const milliseconds = Date.parse(isoTimestamp);
  const base = `${STORAGE_KEY}.backup.import.${timestamp}`;
  let maxSequence = -1;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key !== "string" || !key.startsWith(base)) {
      continue;
    }

    const parsed = getImportBackupTimestamp(key);
    if (parsed?.milliseconds === milliseconds) {
      maxSequence = Math.max(maxSequence, parsed.sequence);
    }
  }
  if (maxSequence >= Number.MAX_SAFE_INTEGER) {
    throw new Error(
      "Não há sequência segura disponível para a cópia de importação.",
    );
  }
  return maxSequence < 0 ? base : `${base}.${maxSequence + 1}`;
}

function getImportBackupTimestamp(key) {
  const match = key.match(
    /^nexusSocial\.requests\.backup\.import\.(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z(?:\.([1-9]\d*))?$/,
  );
  if (!match) {
    return null;
  }

  const timestamp = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  const milliseconds = Date.parse(timestamp);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== timestamp
  ) {
    return null;
  }

  const sequence = Number(match[6] ?? 0);
  if (!Number.isSafeInteger(sequence)) {
    return null;
  }

  return { milliseconds, sequence };
}

function pruneImportBackups(storage) {
  const prefix = `${STORAGE_KEY}.backup.import.`;
  const backups = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key !== "string" || !key.startsWith(prefix)) {
      continue;
    }

    const timestamp = getImportBackupTimestamp(key);
    if (timestamp) {
      backups.push({ key, ...timestamp });
    }
  }

  backups.sort(
    (left, right) =>
      left.milliseconds - right.milliseconds || left.sequence - right.sequence,
  );
  for (const backup of backups.slice(0, -MAX_IMPORT_BACKUPS)) {
    storage.removeItem(backup.key);
  }
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

export function importRequests(requests, { confirmed = false } = {}) {
  if (!confirmed) {
    throw new StorageError(
      "A importação exige confirmação explícita.",
      "unauthorized",
    );
  }
  if (!Array.isArray(requests) || !requests.every(validateStoredRequest)) {
    throw new StorageError(
      "Não foi possível importar: a coleção contém solicitações inválidas.",
      "invalid-data",
    );
  }

  const storage = getStorage();
  let currentSerialized;
  try {
    currentSerialized = storage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new StorageError(
      "Não foi possível ler o armazenamento local antes da importação.",
      "read-failed",
      error,
    );
  }

  let currentRequests = [];
  if (currentSerialized !== null) {
    let envelope;
    try {
      envelope = JSON.parse(currentSerialized);
    } catch (error) {
      throw new StorageError(
        "Os dados locais estão corrompidos. A importação foi cancelada e o original foi preservado.",
        "corrupt",
        error,
      );
    }
    currentRequests = validateEnvelope(envelope);
  }

  const requestsById = new Map(
    currentRequests.map((request) => [request.id, request]),
  );
  const requestsByTitle = new Map(
    currentRequests.map((request) => [request.title, request]),
  );
  const added = [];
  const duplicates = [];
  const conflicts = [];

  for (const request of requests) {
    const sameId = requestsById.get(request.id);
    if (sameId) {
      if (stableSerialize(sameId) === stableSerialize(request)) {
        duplicates.push(request);
      } else {
        conflicts.push(request);
      }
      continue;
    }
    if (requestsByTitle.has(request.title)) {
      duplicates.push(request);
      continue;
    }

    requestsById.set(request.id, request);
    requestsByTitle.set(request.title, request);
    added.push(request);
  }

  if (added.length === 0) {
    return {
      requests: currentRequests,
      added,
      duplicates,
      conflicts,
    };
  }

  const savedRequests = [...currentRequests, ...added];
  const nextSerialized = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    requests: savedRequests,
  });
  const backupSerialized =
    currentSerialized ??
    JSON.stringify({ schemaVersion: SCHEMA_VERSION, requests: [] });
  let backupKey;
  try {
    backupKey = makeImportBackupKey(storage);
    storage.setItem(backupKey, backupSerialized);
  } catch (error) {
    let cleanupError;
    if (backupKey) {
      try {
        storage.removeItem(backupKey);
      } catch (caughtCleanupError) {
        cleanupError = caughtCleanupError;
      }
    }
    const cause = cleanupError
      ? new AggregateError(
          [error, cleanupError],
          "A criação e a limpeza da cópia de segurança falharam.",
        )
      : error;
    throw new StorageError(
      cleanupError
        ? "A criação da cópia de segurança falhou e não foi possível limpar completamente a tentativa. Verifique o armazenamento local."
        : "Não foi possível criar a cópia de segurança anterior à importação. Nenhuma solicitação foi importada.",
      cleanupError
        ? "rollback-failed"
        : error?.name === "QuotaExceededError"
          ? "quota-exceeded"
          : "backup-failed",
      cause,
    );
  }

  try {
    storage.setItem(STORAGE_KEY, nextSerialized);
  } catch (error) {
    const rollbackErrors = [];
    try {
      storage.removeItem(backupKey);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    try {
      if (currentSerialized === null) {
        storage.removeItem(STORAGE_KEY);
      } else {
        storage.setItem(STORAGE_KEY, currentSerialized);
      }
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }

    const cause =
      rollbackErrors.length > 0
        ? new AggregateError(
            [error, ...rollbackErrors],
            "Importação e rollback falharam.",
          )
        : error;
    throw new StorageError(
      rollbackErrors.length > 0
        ? "A gravação da importação falhou e não foi possível confirmar a restauração integral. Verifique o armazenamento local."
        : error?.name === "QuotaExceededError"
          ? "O armazenamento local está cheio. A importação foi cancelada e os dados existentes foram preservados."
          : "Não foi possível gravar a importação. Os dados existentes foram preservados.",
      rollbackErrors.length > 0
        ? "rollback-failed"
        : error?.name === "QuotaExceededError"
          ? "quota-exceeded"
          : "import-write-failed",
      cause,
    );
  }

  try {
    pruneImportBackups(storage);
  } catch (error) {
    console.warn(
      "A importação foi gravada, mas não foi possível limpar as cópias de segurança antigas.",
      error,
    );
  }

  return {
    requests: savedRequests,
    added,
    duplicates,
    conflicts,
  };
}

export function replaceCollection(requests, { confirmed = false } = {}) {
  if (!confirmed) {
    throw new StorageError(
      "A substituição da coleção exige confirmação explícita.",
      "unauthorized",
    );
  }
  if (!Array.isArray(requests) || !requests.every(validateStoredRequest)) {
    throw new StorageError(
      "Não foi possível restaurar: a coleção contém registros inválidos.",
      "invalid-data",
    );
  }

  const incomingIds = requests.map((request) => request.id);
  if (new Set(incomingIds).size !== incomingIds.length) {
    throw new StorageError(
      "Não foi possível restaurar: há identificadores duplicados.",
      "invalid-data",
    );
  }

  const storage = getStorage();
  let current;
  try {
    current = storage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new StorageError(
      "Não foi possível ler o armazenamento local.",
      "read-failed",
      error,
    );
  }

  if (current !== null) {
    try {
      storage.setItem(makeCurrentBackupKey(storage), current);
    } catch (error) {
      throw new StorageError(
        "Não foi possível criar uma cópia de segurança antes da restauração. A coleção original foi preservada.",
        error?.name === "QuotaExceededError"
          ? "quota-exceeded"
          : "backup-failed",
        error,
      );
    }
  }

  writeEnvelope(storage, requests);
  return requests;
}

export function removeRequest(requestId, { authorized = false } = {}) {
  if (!authorized) {
    throw new StorageError(
      "A remoção exige autorização explícita.",
      "unauthorized",
    );
  }

  const storage = getStorage();
  const requests = readStoredRequests(storage) ?? [];
  if (!requests.some((request) => request.id === requestId)) {
    return false;
  }

  writeEnvelope(
    storage,
    requests.filter((request) => request.id !== requestId),
  );
  return true;
}
