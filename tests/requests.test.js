import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_TRANSITIONS,
  assignVolunteer,
  cancelRequest,
  confirmReceipt,
  createRequest,
  declareCompletion,
  DEMO_PROFILES,
  getRequestHistory,
  reopenRequest,
  REQUEST_STATUSES,
  suspendForReview,
  validateRequestInput,
  withdrawFromRequest,
} from "../requests.js";
import { loadRequests, saveRequests } from "../storage.js";
import { installIsolatedStorage, validRequestInput } from "./support.js";

test("request input trims text and accepts current allowed values", () => {
  const validation = validateRequestInput(validRequestInput({
    title: "  Solicitação válida  ",
    description: "  Descrição válida e completa.  ",
    region: "  Centro  ",
  }));

  assert.equal(validation.isValid, true);
  assert.equal(validation.values.title, "Solicitação válida");
  assert.equal(validation.values.description, "Descrição válida e completa.");
  assert.equal(validation.values.region, "Centro");
  assert.equal(validation.values.quantity, 2);
});

test("request validation reports required, malformed and disallowed fields", () => {
  const invalidCases = [
    ["title", "   ", "title"],
    ["description", "   ", "description"],
    ["description", "curta", "description"],
    ["quantity", "0", "quantity"],
    ["quantity", "-1", "quantity"],
    ["quantity", "não é número", "quantity"],
    ["category", "Dinheiro", "category"],
    ["unit", "serviço", "unit"],
    ["declaredUrgency", "imediata", "declaredUrgency"],
    ["region", "Rua das Flores, 45", "region"],
  ];

  for (const [field, value, expectedError] of invalidCases) {
    const validation = validateRequestInput(validRequestInput({ [field]: value }));
    assert.equal(validation.isValid, false, `${field}=${value}`);
    assert.ok(validation.errors[expectedError], `${field} reports its own error`);
  }
});

test("createRequest rejects invalid input before storage changes", (t) => {
  const storage = installIsolatedStorage(t);

  assert.throws(
    () => createRequest(validRequestInput({ title: " " })),
    (error) => Boolean(error.validationErrors?.title),
  );
  assert.equal(storage.getItem("nexusSocial.requests"), null);
});

test("created requests have unique ids, valid initial state and creation history", () => {
  const first = createRequest(validRequestInput({
    title: "<b>Solicitação & teste</b>",
  }));
  const second = createRequest(validRequestInput());

  assert.notEqual(first.id, second.id);
  assert.equal(first.title, "<b>Solicitação & teste</b>");
  assert.equal(first.status, "aberto");
  assert.equal(first.assignedVolunteerId, null);
  assert.equal(first.completedAt, null);
  assert.equal(first.receiptConfirmedAt, null);
  assert.equal(first.createdAt, first.updatedAt);
  assert.equal(first.history.length, 1);
  assert.equal(first.history[0].actionType, "solicitacao_criada");
  assert.equal(first.history[0].requestId, first.id);
});

test("workflow enforces assignment, withdrawal, completion, receipt, suspension and reopening", (t) => {
  installIsolatedStorage(t);
  const request = createRequest(validRequestInput());
  saveRequests([request]);
  const createdAt = request.createdAt;

  const assigned = assignVolunteer(request.id, DEMO_PROFILES.volunteer);
  assert.equal(assigned.status, "em_atendimento");
  assert.equal(assigned.assignedVolunteerId, DEMO_PROFILES.volunteer.id);
  assert.ok(Date.parse(assigned.updatedAt) >= Date.parse(createdAt));
  assert.throws(
    () => assignVolunteer(request.id, DEMO_PROFILES.volunteer),
    /Transição não permitida/,
  );
  assert.equal(loadRequests()[0].history.length, 2);

  const withdrawn = withdrawFromRequest(request.id, DEMO_PROFILES.volunteer);
  assert.equal(withdrawn.status, "aberto");
  assert.equal(withdrawn.assignedVolunteerId, null);
  assert.throws(
    () => withdrawFromRequest(request.id, DEMO_PROFILES.moderator),
    /perfil de demonstração/,
  );

  assignVolunteer(request.id, DEMO_PROFILES.volunteer);
  const completed = declareCompletion(request.id, DEMO_PROFILES.volunteer);
  assert.equal(completed.status, "conclusao_declarada");
  assert.ok(completed.completedAt);
  assert.equal(completed.receiptConfirmedAt, null);

  const received = confirmReceipt(request.id, DEMO_PROFILES.requester);
  assert.equal(received.status, "recebimento_confirmado");
  assert.ok(received.receiptConfirmedAt);

  const suspended = suspendForReview(
    request.id,
    DEMO_PROFILES.moderator,
    "Revisão demonstrativa necessária",
  );
  assert.equal(suspended.status, "suspenso_para_revisao");
  assert.throws(
    () => assignVolunteer(request.id, DEMO_PROFILES.volunteer),
    /Transição não permitida/,
  );

  const reopened = reopenRequest(
    request.id,
    DEMO_PROFILES.moderator,
    "Solicitação liberada para nova etapa",
  );
  assert.equal(reopened.status, "aberto");
  assert.equal(reopened.assignedVolunteerId, null);
  assert.equal(reopened.completedAt, completed.completedAt);
  assert.equal(reopened.receiptConfirmedAt, received.receiptConfirmedAt);
  assert.deepEqual(
    reopened.history.map((entry) => entry.actionType),
    [
      "solicitacao_criada",
      "voluntario_atribuido",
      "voluntario_desistiu",
      "voluntario_atribuido",
      "conclusao_declarada",
      "recebimento_confirmado_demo",
      "solicitacao_suspensa",
      "solicitacao_reaberta",
    ],
  );
  assert.deepEqual(getRequestHistory(request.id), reopened.history);
});

test("cancellation requires its requester or moderator and blocks new assignments", (t) => {
  installIsolatedStorage(t);
  const request = createRequest(validRequestInput());
  saveRequests([request]);

  assert.throws(
    () => cancelRequest(request.id, DEMO_PROFILES.volunteer, "Motivo inválido"),
    /perfil de demonstração/,
  );
  assert.throws(
    () => cancelRequest(request.id, DEMO_PROFILES.requester, "x"),
    /3 a 500 caracteres/,
  );

  const cancelled = cancelRequest(
    request.id,
    DEMO_PROFILES.requester,
    "Solicitação não é mais necessária",
  );
  assert.equal(cancelled.status, "cancelado");
  assert.equal(cancelled.cancellationReason, "Solicitação não é mais necessária");
  assert.throws(
    () => assignVolunteer(request.id, DEMO_PROFILES.volunteer),
    /Transição não permitida/,
  );
  assert.equal(loadRequests()[0].history.length, 2);
});

test("transition table contains only the defined workflow states", () => {
  assert.deepEqual(Object.keys(ALLOWED_TRANSITIONS), REQUEST_STATUSES);
  assert.deepEqual(ALLOWED_TRANSITIONS.aberto, [
    "em_atendimento",
    "cancelado",
    "suspenso_para_revisao",
  ]);
  assert.equal(ALLOWED_TRANSITIONS.cancelado.includes("em_atendimento"), false);
});

test("failed persistence leaves stored request and history unchanged", (t) => {
  const storage = installIsolatedStorage(t);
  const request = createRequest(validRequestInput());
  saveRequests([request]);
  const before = storage.getItem("nexusSocial.requests");
  storage.failWriteKey = "nexusSocial.requests";

  assert.throws(
    () => assignVolunteer(request.id, DEMO_PROFILES.volunteer),
    (error) => error.code === "quota-exceeded",
  );
  assert.equal(storage.getItem("nexusSocial.requests"), before);
  assert.equal(loadRequests()[0].status, "aberto");
  assert.equal(loadRequests()[0].history.length, 1);
});
