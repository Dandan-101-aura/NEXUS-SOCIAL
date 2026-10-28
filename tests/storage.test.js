import assert from "node:assert/strict";
import test from "node:test";
import {
  assignVolunteer,
  createRequest,
  DEMO_PROFILES,
} from "../JavaScript/requests.js";
import {
  loadRequests,
  saveRequests,
  SCHEMA_VERSION,
  STORAGE_KEY,
  updateRequest,
} from "../JavaScript/storage.js";
import { installIsolatedStorage, validRequestInput } from "./support.js";

test("missing data initializes an empty versioned collection", (t) => {
  const storage = installIsolatedStorage(t);

  assert.deepEqual(loadRequests(), []);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), {
    schemaVersion: SCHEMA_VERSION,
    requests: [],
  });
});

test("valid requests persist and remain available on a subsequent load", (t) => {
  const storage = installIsolatedStorage(t);
  const request = createRequest(validRequestInput());

  assert.deepEqual(saveRequests([request]), [request]);
  assert.deepEqual(loadRequests(), [request]);
  assert.equal(
    JSON.parse(storage.getItem(STORAGE_KEY)).schemaVersion,
    SCHEMA_VERSION,
  );
});

test("corrupt JSON is reported without overwriting the original bytes", (t) => {
  const storage = installIsolatedStorage(t);
  const corrupt = "{broken-json";
  storage.setItem(STORAGE_KEY, corrupt);

  assert.throws(
    () => loadRequests(),
    (error) => error.code === "corrupt",
  );
  assert.equal(storage.getItem(STORAGE_KEY), corrupt);
});

test("unsupported schema versions are rejected and preserved", (t) => {
  const storage = installIsolatedStorage(t);
  const incompatible = JSON.stringify({
    schemaVersion: SCHEMA_VERSION + 1,
    requests: [],
  });
  storage.setItem(STORAGE_KEY, incompatible);

  assert.throws(
    () => loadRequests(),
    (error) => error.code === "incompatible",
  );
  assert.equal(storage.getItem(STORAGE_KEY), incompatible);
});

test("schema v1 migration creates a backup before writing the current schema", (t) => {
  const storage = installIsolatedStorage(t);
  const legacyRequest = createRequest(validRequestInput());
  const legacy = JSON.stringify({
    schemaVersion: 1,
    requests: [legacyRequest],
  });
  storage.setItem(STORAGE_KEY, legacy);

  const migrated = loadRequests();
  const backupKeys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  ).filter((key) => key.startsWith(`${STORAGE_KEY}.backup.v1.`));

  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].id, legacyRequest.id);
  assert.equal(migrated[0].status, "aberto");
  assert.equal(
    JSON.parse(storage.getItem(STORAGE_KEY)).schemaVersion,
    SCHEMA_VERSION,
  );
  assert.equal(backupKeys.length, 1);
  assert.equal(storage.getItem(backupKeys[0]), legacy);
});

test("quota failure during a workflow update does not partially persist", (t) => {
  const storage = installIsolatedStorage(t);
  const request = createRequest(validRequestInput());
  saveRequests([request]);
  const before = storage.getItem(STORAGE_KEY);
  storage.failWriteKey = STORAGE_KEY;

  assert.throws(
    () => assignVolunteer(request.id, DEMO_PROFILES.volunteer),
    (error) => error.code === "quota-exceeded",
  );
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.equal(loadRequests()[0].status, "aberto");
});

test("storage rejects a transition that bypasses the allowed state machine", (t) => {
  const storage = installIsolatedStorage(t);
  const request = createRequest(validRequestInput());
  saveRequests([request]);
  const before = storage.getItem(STORAGE_KEY);

  assert.throws(
    () =>
      updateRequest(request.id, (current) => {
        const timestamp = new Date().toISOString();
        return {
          ...current,
          status: "recebimento_confirmado",
          history: [
            ...current.history,
            {
              id: "test-invalid-transition",
              requestId: current.id,
              timestamp,
              previousStatus: "aberto",
              newStatus: "recebimento_confirmado",
              actionType: "invalid_test_transition",
              role: "moderador",
              actorId: "moderador-demo",
              description: "Tentativa inválida de transição.",
              reason: null,
            },
          ],
        };
      }),
    (error) => error.code === "invalid-transition",
  );
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test("storage rejects updates that rewrite earlier history events", (t) => {
  installIsolatedStorage(t);
  const request = createRequest(validRequestInput());
  saveRequests([request]);

  assert.throws(
    () =>
      updateRequest(request.id, (current) => ({
        ...current,
        status: "em_atendimento",
        history: [
          {
            ...current.history[0],
            description: "History rewrite attempt",
          },
          {
            ...current.history[0],
            id: "test-history-append",
            previousStatus: "aberto",
            newStatus: "em_atendimento",
          },
        ],
      })),
    (error) => error.code === "history-must-append",
  );
  assert.equal(
    loadRequests()[0].history[0].description,
    "Solicitação cadastrada.",
  );
});
