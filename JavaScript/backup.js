import { createRequest, DEMO_PROFILES } from "./requests.js";
import { SCHEMA_VERSION } from "./storage.js";

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
