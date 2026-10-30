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

function getImportBackupKeys(storage) {
  const prefix = `${STORAGE_KEY}.backup.import.`;
  return Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  )
    .filter((key) => key?.startsWith(prefix))
    .sort();
}

function makeImportBackupKey(date, suffix = "") {
  return `${STORAGE_KEY}.backup.import.${date
    .toISOString()
    .replace(/[:.]/g, "-")}${suffix}`;
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

test("consecutive imports retain the three newest backups when timestamps collide", (t) => {
  const storage = installIsolatedStorage(t);
  const imported = Array.from({ length: 5 }, (_, index) =>
    makeRequest(`Importação consecutiva ${index + 1}`),
  );
  const RealDate = globalThis.Date;
  const fixedTimestamp = "2024-06-15T12:30:45.123Z";
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length > 0 ? args : [fixedTimestamp]));
    }
  };
  t.after(() => {
    globalThis.Date = RealDate;
  });

  for (const request of imported.slice(0, 4)) {
    importRequests([request], { confirmed: true });
  }
  assert.equal(getImportBackupKeys(storage).length, 3);

  importRequests([imported[4]], { confirmed: true });
  const backupSnapshots = getImportBackupKeys(storage).map((key) =>
    JSON.parse(storage.getItem(key)),
  );
  assert.ok(backupSnapshots.some(({ requests }) => requests.length === 4));
  assert.deepEqual(loadRequests(), imported);
});

test("import backup pruning preserves schema v1 backups and the theme key", (t) => {
  const storage = installIsolatedStorage(t);
  const migrationKey = `${STORAGE_KEY}.backup.v1.2020-01-01T00-00-00-000Z`;
  const migrationBackup = JSON.stringify({ schemaVersion: 1, requests: [] });
  storage.setItem(migrationKey, migrationBackup);
  storage.setItem("nexusSocial.theme", "dark");

  for (let index = 1; index <= 4; index += 1) {
    importRequests([makeRequest(`Importação com backup v1 ${index}`)], {
      confirmed: true,
    });
  }

  assert.equal(storage.getItem(migrationKey), migrationBackup);
  assert.equal(storage.getItem("nexusSocial.theme"), "dark");
  assert.equal(
    storage.getItem(STORAGE_KEY).includes('"schemaVersion":2'),
    true,
  );
});

test("import backup pruning preserves malformed keys and ignores invalid timestamps", (t) => {
  const storage = installIsolatedStorage(t);
  const oldestKey = makeImportBackupKey(new Date("2020-01-01T00:00:00.000Z"));
  const malformedKeys = [
    `${STORAGE_KEY}.backup.import.not-a-timestamp`,
    `${STORAGE_KEY}.backup.import.2024-02-31T12-00-00-000Z`,
  ];
  storage.setItem(oldestKey, "oldest backup");
  malformedKeys.forEach((key, index) =>
    storage.setItem(key, `malformed backup ${index}`),
  );

  for (let index = 1; index <= 4; index += 1) {
    importRequests([makeRequest(`Importação com chave malformada ${index}`)], {
      confirmed: true,
    });
  }

  assert.equal(storage.getItem(oldestKey), null);
  malformedKeys.forEach((key, index) => {
    assert.equal(storage.getItem(key), `malformed backup ${index}`);
  });
  assert.equal(
    getImportBackupKeys(storage).filter((key) => !malformedKeys.includes(key))
      .length,
    3,
  );
});

test("failed import write does not prune existing import backups", (t) => {
  const storage = installIsolatedStorage(t);
  const existing = makeRequest("Coleção preservada com backups");
  const incoming = makeRequest("Importação com falha de gravação");
  const oldKeys = Array.from({ length: 4 }, (_, index) =>
    makeImportBackupKey(new Date(`2020-01-0${index + 1}T00:00:00.000Z`)),
  );
  oldKeys.forEach((key, index) => storage.setItem(key, `backup ${index}`));
  saveRequests([existing]);
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
  oldKeys.forEach((key, index) => {
    assert.equal(storage.getItem(key), `backup ${index}`);
  });
  assert.deepEqual(getImportBackupKeys(storage), oldKeys.sort());
});

test("failed import backup cleanup does not undo a successful import", (t) => {
  const storage = installIsolatedStorage(t);
  const existing = makeRequest("Coleção antes de falha de limpeza");
  const incoming = makeRequest("Importação preservada após falha de limpeza");
  const oldestKey = makeImportBackupKey(new Date("2020-01-01T00:00:00.000Z"));
  for (let index = 1; index <= 3; index += 1) {
    storage.setItem(
      makeImportBackupKey(new Date(`2020-01-0${index + 1}T00:00:00.000Z`)),
      `backup ${index}`,
    );
  }
  storage.setItem(oldestKey, "oldest backup");
  saveRequests([existing]);

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  t.after(() => {
    console.warn = originalWarn;
  });
  const originalRemoveItem = storage.removeItem.bind(storage);
  storage.removeItem = (key) => {
    if (key === oldestKey) {
      throw new Error("Simulated cleanup failure");
    }
    originalRemoveItem(key);
  };

  const result = importRequests([incoming], { confirmed: true });

  assert.deepEqual(result.requests, [existing, incoming]);
  assert.deepEqual(loadRequests(), [existing, incoming]);
  assert.equal(storage.getItem(oldestKey), "oldest backup");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /importação foi gravada/i);
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
