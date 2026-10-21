import assert from "node:assert/strict";
import test from "node:test";
import { getRecentRequests, getRequestStatusTotals } from "../dashboard.js";
import {
  getFilteredRequests,
  normalizeSearchText,
} from "../queries.js";

function fixture(id, overrides = {}) {
  return {
    id,
    title: `Request ${id}`,
    description: `Description for ${id}`,
    category: "Alimentos não perecíveis",
    declaredUrgency: "media",
    status: "aberto",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("search normalizes case, surrounding and repeated spaces", () => {
  const requests = [
    fixture("title", { title: "Cesta   Básica" }),
    fixture("description", { description: "Arroz integral para a semana" }),
    fixture("category", { category: "Produtos de higiene" }),
  ];

  assert.equal(normalizeSearchText("  CESTA    Básica  "), "cesta básica");
  assert.deepEqual(
    getFilteredRequests(requests, { term: " CESTA básica " }).matches.map(({ id }) => id),
    ["title"],
  );
  assert.deepEqual(
    getFilteredRequests(requests, { term: "ARROZ integral" }).matches.map(({ id }) => id),
    ["description"],
  );
  assert.deepEqual(
    getFilteredRequests(requests, { term: "PRODUTOS de HIGIENE" }).matches.map(({ id }) => id),
    ["category"],
  );
  assert.deepEqual(getFilteredRequests(requests, { term: "sem correspondência" }).matches, []);
});

test("category, status and urgency filters are combined independently", () => {
  const requests = [
    fixture("matching", {
      category: "Produtos de higiene",
      declaredUrgency: "alta",
    }),
    fixture("wrong-status", {
      category: "Produtos de higiene",
      status: "cancelado",
      declaredUrgency: "alta",
    }),
    fixture("wrong-urgency", {
      category: "Produtos de higiene",
      declaredUrgency: "baixa",
    }),
    fixture("wrong-category", {
      declaredUrgency: "alta",
    }),
  ];
  const filtered = getFilteredRequests(requests, {
    category: "Produtos de higiene",
    status: "aberto",
    urgency: "alta",
  });

  assert.deepEqual(filtered.matches.map(({ id }) => id), ["matching"]);
  assert.deepEqual(filtered.groupedRequests[0][1].map(({ id }) => id), ["matching"]);
});

test("open requests sort by declared urgency then oldest creation date", () => {
  const requests = [
    fixture("medium-new", {
      declaredUrgency: "media",
      createdAt: "2026-03-02T00:00:00.000Z",
    }),
    fixture("low-old", {
      declaredUrgency: "baixa",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    fixture("high-new", {
      declaredUrgency: "alta",
      createdAt: "2026-03-03T00:00:00.000Z",
    }),
    fixture("high-old", {
      declaredUrgency: "alta",
      createdAt: "2026-01-02T00:00:00.000Z",
    }),
    fixture("medium-old", {
      declaredUrgency: "media",
      createdAt: "2026-01-03T00:00:00.000Z",
    }),
  ];
  const snapshot = structuredClone(requests);

  const result = getFilteredRequests(requests);

  assert.deepEqual(
    result.groupedRequests[0][1].map(({ id }) => id),
    ["high-old", "high-new", "medium-old", "medium-new", "low-old"],
  );
  assert.deepEqual(requests, snapshot);
});

test("non-open statuses are grouped and ordered newest first", () => {
  const requests = [
    fixture("cancel-old", {
      status: "cancelado",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    fixture("cancel-new", {
      status: "cancelado",
      createdAt: "2026-02-01T00:00:00.000Z",
    }),
    fixture("assigned", { status: "em_atendimento" }),
  ];
  const result = getFilteredRequests(requests);

  assert.deepEqual(result.groupedRequests.map(([label]) => label), [
    "Em atendimento",
    "Cancelada",
  ]);
  assert.deepEqual(result.groupedRequests[1][1].map(({ id }) => id), [
    "cancel-new",
    "cancel-old",
  ]);
});

test("dashboard totals all current statuses and handles empty input", () => {
  const statuses = [
    "aberto",
    "em_atendimento",
    "conclusao_declarada",
    "recebimento_confirmado",
    "cancelado",
    "suspenso_para_revisao",
  ];
  const requests = statuses.map((status, index) => fixture(`status-${index}`, { status }));

  assert.deepEqual(getRequestStatusTotals([]), {
    aberto: 0,
    em_atendimento: 0,
    conclusao_declarada: 0,
    recebimento_confirmado: 0,
    cancelado: 0,
    suspenso_para_revisao: 0,
  });
  assert.deepEqual(getRequestStatusTotals(requests), {
    aberto: 1,
    em_atendimento: 1,
    conclusao_declarada: 1,
    recebimento_confirmado: 1,
    cancelado: 1,
    suspenso_para_revisao: 1,
  });
});

test("recent requests returns a sorted limited copy without mutating input", () => {
  const requests = [
    fixture("older", { createdAt: "2026-01-01T00:00:00.000Z" }),
    fixture("newer", { createdAt: "2026-03-01T00:00:00.000Z" }),
    fixture("middle", { createdAt: "2026-02-01T00:00:00.000Z" }),
  ];
  const before = [...requests];

  assert.deepEqual(
    getRecentRequests(requests, 2).map(({ id }) => id),
    ["newer", "middle"],
  );
  assert.deepEqual(requests, before);
});
