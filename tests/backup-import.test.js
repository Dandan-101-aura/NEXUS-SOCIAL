import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBackup,
  MAX_BACKUP_SIZE_BYTES,
  parseBackup,
} from "../JavaScript/backup.js";
import { createRequest } from "../JavaScript/requests.js";
import {
  importRequests,
  loadRequests,
  saveRequests,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "../JavaScript/storage.js";
import { installIsolatedStorage, validRequestInput } from "./support.js";

function serializedBackup(requests, overrides = {}) {
  return JSON.stringify({
    ...buildBackup(requests),
    ...overrides,
  });
}

function makeRequest(title = "Solicitação de backup") {
  return createRequest(validRequestInput({ title }));
}

test("backup parser rejects empty text and malformed JSON", () => {
  assert.equal(parseBackup("").erros[0], "O arquivo de backup está vazio.");
  assert.equal(
    parseBackup("{broken").erros[0],
    "O arquivo não contém JSON válido.",
  );
});

test("backup parser rejects unknown versions and a missing collection", () => {
  const request = makeRequest();

  const unsupported = parseBackup(
    serializedBackup([request], { schemaVersion: SCHEMA_VERSION + 1 }),
  );
  assert.equal(unsupported.ok, false);
  assert.match(unsupported.erros[0], /versão de backup incompatível/i);

  const missingCollection = parseBackup(
    JSON.stringify({ schemaVersion: SCHEMA_VERSION }),
  );
  assert.equal(missingCollection.ok, false);
  assert.match(missingCollection.erros[0], /coleção de solicitações/i);
});

test("backup parser keeps valid records and reports invalid records in a mixed collection", () => {
  const valid = makeRequest();
  const invalid = { ...valid, quantity: -1 };

  const result = parseBackup(serializedBackup([valid, invalid]));

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.validas.map(({ id }) => id),
    [valid.id],
  );
  assert.equal(result.invalidas.length, 1);
  assert.match(result.invalidas[0].motivo, /quantidade/i);
});

test("backup parser ignores duplicate ids and titles, including records without ids", () => {
  const existing = makeRequest("Título já existente");
  const differentIdSameTitle = makeRequest("Título já existente");
  const noIdSameTitle = { ...existing };
  delete noIdSameTitle.id;

  const result = parseBackup(
    serializedBackup([existing, differentIdSameTitle, noIdSameTitle]),
    [existing],
  );

  assert.equal(result.validas.length, 0);
  assert.equal(result.duplicadas.length, 3);
  assert.equal(result.invalidas.length, 0);
});

test("backup parser reports an id conflict instead of importing different content", () => {
  const existing = makeRequest("Solicitação original");
  const conflict = { ...existing, title: "Solicitação alterada" };

  const result = parseBackup(serializedBackup([conflict]), [existing]);

  assert.equal(result.validas.length, 0);
  assert.equal(result.invalidas.length, 1);
  assert.match(result.invalidas[0].motivo, /conflito de identificador/i);
});

test("backup parser preserves HTML-looking user text as literal data", () => {
  const request = makeRequest('<img src=x onerror="alert(1)">');
  request.description = "<script>literal & seguro</script>";

  const result = parseBackup(serializedBackup([request]));

  assert.equal(result.validas.length, 1);
  assert.equal(result.validas[0].title, request.title);
  assert.equal(result.validas[0].description, request.description);
});

test("backup parser rejects fields outside the schema", () => {
  const request = {
    ...makeRequest(),
    importedMetadata: { unexpected: "untrusted" },
  };

  const result = parseBackup(serializedBackup([request]));

  assert.equal(result.validas.length, 0);
  assert.match(result.invalidas[0].motivo, /campos não suportados/i);
});

test("backup parser rejects files larger than the configured maximum", () => {
  const result = parseBackup(" ".repeat(MAX_BACKUP_SIZE_BYTES + 1));

  assert.equal(result.ok, false);
  assert.match(result.erros[0], /excede o limite de 5 MB/i);
});

test("backup parser rejects histories that skip a permitted transition", () => {
  const request = makeRequest();
  request.status = "recebimento_confirmado";
  request.assignedVolunteerId = "voluntario-demo";
  request.completedAt = request.updatedAt;
  request.receiptConfirmedAt = request.updatedAt;
  request.history.push({
    id: "history-invalid-transition",
    requestId: request.id,
    timestamp: request.updatedAt,
    previousStatus: "aberto",
    newStatus: "recebimento_confirmado",
    actionType: "recebimento_confirmado_demo",
    role: "solicitante",
    actorId: "solicitante-demo",
    description: "Transição não permitida no histórico.",
    reason: null,
  });

  const result = parseBackup(serializedBackup([request]));

  assert.equal(result.validas.length, 0);
  assert.match(result.invalidas[0].motivo, /histórico/i);
});

test("import creates a copy and adds requests without changing existing records", (t) => {
  const storage = installIsolatedStorage(t);
  const existing = makeRequest("Solicitação preservada");
  const incoming = makeRequest("Solicitação importada");
  importRequests([], { confirmed: true });
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: SCHEMA_VERSION, requests: [existing] }),
  );
  const originalSerialized = storage.getItem(STORAGE_KEY);

  const result = importRequests([incoming], { confirmed: true });
  const backupKeys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  ).filter((key) => key.startsWith(`${STORAGE_KEY}.backup.import.`));

  assert.equal(result.added.length, 1);
  assert.deepEqual(result.requests, [existing, incoming]);
  assert.deepEqual(loadRequests(), [existing, incoming]);
  assert.equal(backupKeys.length, 1);
  assert.equal(storage.getItem(backupKeys[0]), originalSerialized);
  assert.deepEqual(JSON.parse(originalSerialized).requests, [existing]);
});

test("import refuses to write before explicit confirmation", (t) => {
  installIsolatedStorage(t);
  const existing = makeRequest("Coleção intacta");
  const incoming = makeRequest("Não confirmado");
  importRequests([existing], { confirmed: true });
  const before = globalThis.localStorage.getItem(STORAGE_KEY);

  assert.throws(
    () => importRequests([incoming]),
    (error) => error.code === "unauthorized",
  );
  assert.equal(globalThis.localStorage.getItem(STORAGE_KEY), before);
});

test("failed import write rolls back collection and removes its temporary backup", (t) => {
  const storage = installIsolatedStorage(t);
  const existing = makeRequest("Coleção antes da falha");
  const incoming = makeRequest("Importação com falha");
  importRequests([existing], { confirmed: true });
  const before = storage.getItem(STORAGE_KEY);
  const originalSetItem = storage.setItem.bind(storage);
  let failMainWrite = true;
  storage.setItem = (key, value) => {
    if (key === STORAGE_KEY && failMainWrite) {
      failMainWrite = false;
      originalSetItem(key, value);
      throw new Error("Simulated import write failure");
    }
    originalSetItem(key, value);
  };

  assert.throws(
    () => importRequests([incoming], { confirmed: true }),
    (error) => error.code === "import-write-failed",
  );
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.equal(
    Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    ).filter((key) => key.startsWith(`${STORAGE_KEY}.backup.import.`)).length,
    1,
  );
});

test("failed backup creation leaves the existing collection unchanged", (t) => {
  const storage = installIsolatedStorage(t);
  const existing = makeRequest("Coleção preservada sem cópia");
  const incoming = makeRequest("Backup não pôde ser criado");
  saveRequests([existing]);
  const before = storage.getItem(STORAGE_KEY);
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key.startsWith(`${STORAGE_KEY}.backup.import.`)) {
      originalSetItem(key, value);
      const error = new Error("Simulated backup quota failure");
      error.name = "QuotaExceededError";
      throw error;
    }
    originalSetItem(key, value);
  };

  assert.throws(
    () => importRequests([incoming], { confirmed: true }),
    (error) => error.code === "quota-exceeded",
  );
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.equal(
    Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    ).filter((key) => key.startsWith(`${STORAGE_KEY}.backup.import.`)).length,
    0,
  );
  assert.deepEqual(loadRequests(), [existing]);
});

test("storage import ignores title duplicates and never replaces an id conflict", (t) => {
  const storage = installIsolatedStorage(t);
  const existing = makeRequest("Título preservado");
  const idConflict = { ...existing, title: "Mesmo id com outro conteúdo" };
  const titleDuplicate = makeRequest("Título preservado");
  const incoming = makeRequest("Novo registro");
  saveRequests([existing]);

  const result = importRequests([idConflict, titleDuplicate, incoming], {
    confirmed: true,
  });

  assert.deepEqual(result.added, [incoming]);
  assert.deepEqual(result.duplicates, [titleDuplicate]);
  assert.deepEqual(result.conflicts, [idConflict]);
  assert.deepEqual(result.requests, [existing, incoming]);
  assert.deepEqual(loadRequests(), [existing, incoming]);
  assert.equal(
    JSON.parse(storage.getItem(STORAGE_KEY)).requests[0].title,
    existing.title,
  );
});
