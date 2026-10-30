import assert from "node:assert/strict";
import test from "node:test";
import AxeBuilder from "@axe-core/playwright";
import {
  assertNoBrowserErrors,
  createRequestThroughForm,
  getServerBaseUrl,
  getStoredRequests,
  openApp,
} from "./support.js";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const THEMES = ["light", "dark"];
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 360, height: 740 },
];
const ACCESSIBILITY_STATES = [
  "página pública",
  "painel",
  "lista de solicitações",
  "cadastro vazio",
  "cadastro com erros",
  "detalhes",
  "histórico",
  "diálogo de importação",
];

function recordFinding(findings, finding, context) {
  const entry = findings.get(finding.id) ?? {
    id: finding.id,
    impact: finding.impact,
    help: finding.help,
    description: finding.description,
    tags: finding.tags,
    contexts: new Set(),
    nodes: new Map(),
  };
  entry.contexts.add(context);
  for (const node of finding.nodes) {
    const key = node.target.join(", ");
    const existing = entry.nodes.get(key) ?? {
      target: node.target,
      failureSummaries: new Set(),
    };
    if (node.failureSummary) {
      existing.failureSummaries.add(node.failureSummary);
    }
    entry.nodes.set(key, existing);
  }
  findings.set(finding.id, entry);
}

function serializeFindings(findings) {
  return [...findings.values()]
    .map((finding) => ({
      ...finding,
      contexts: [...finding.contexts],
      nodes: [...finding.nodes.values()].map((node) => ({
        target: node.target,
        failureSummaries: [...node.failureSummaries],
      })),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function setTheme(page, theme) {
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
  }, theme);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
}

async function scanState(page, state, context, findings) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  for (const violation of results.violations) {
    recordFinding(findings.violations, violation, context);
  }
  for (const incomplete of results.incomplete) {
    recordFinding(findings.incomplete, incomplete, context);
  }
  findings.scans.push({
    context,
    state,
    violations: results.violations.map(({ id, impact }) => ({ id, impact })),
    incomplete: results.incomplete.map(({ id, impact }) => ({ id, impact })),
  });
}

async function navigateToView(page, view, viewport) {
  if (viewport.width <= 680) {
    await page.locator(".menu-toggle").click();
  }
  await page.locator(`[data-view="${view}"]`).click();
}

test("axe checks core screens, import dialog, themes and supported viewports", async (t) => {
  const findings = {
    scans: [],
    violations: new Map(),
    incomplete: new Map(),
  };

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const { diagnostics, page } = await openApp(t, viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(getServerBaseUrl(), { waitUntil: "networkidle" });
      await setTheme(page, theme);
      const context = `${theme} ${viewport.width}x${viewport.height}`;

      await scanState(page, ACCESSIBILITY_STATES[0], context, findings);
      await page.getByRole("link", { name: /Abrir demonstração/ }).click();
      await page.locator("#view-dashboard").waitFor({ state: "visible" });
      await scanState(page, ACCESSIBILITY_STATES[1], context, findings);

      await navigateToView(page, "requests", viewport);
      await scanState(page, ACCESSIBILITY_STATES[2], context, findings);

      await navigateToView(page, "new-request", viewport);
      await scanState(page, ACCESSIBILITY_STATES[3], context, findings);
      await page.getByRole("button", { name: "Salvar solicitação" }).click();
      await scanState(page, ACCESSIBILITY_STATES[4], context, findings);

      const title = `Acessibilidade ${theme} ${viewport.width}`;
      const form = page.locator("#request-form");
      await form.getByLabel("Título da solicitação").fill(title);
      await form
        .getByLabel("Descrição")
        .fill(`Descrição válida para a verificação ${title}.`);
      await form
        .getByLabel("Categoria")
        .selectOption({ label: "Alimentos não perecíveis" });
      await form.getByLabel("Quantidade").fill("2");
      await form.getByLabel("Unidade de medida").selectOption("unidades");
      await form.getByLabel("Região aproximada").fill("Centro");
      await form.getByLabel("Urgência declarada").selectOption("media");
      await form.getByRole("button", { name: "Salvar solicitação" }).click();
      await page
        .locator("#toast-region .toast-text", {
          hasText: "Solicitação cadastrada e salva neste navegador.",
        })
        .waitFor();
      const request = (await getStoredRequests(page)).find(
        (record) => record.title === title,
      );
      await page.evaluate((id) => {
        window.location.hash = `#/solicitacao/${encodeURIComponent(id)}`;
      }, request.id);
      await page.locator("#view-details").waitFor({ state: "visible" });
      await scanState(page, ACCESSIBILITY_STATES[5], context, findings);

      await navigateToView(page, "history", viewport);
      await scanState(page, ACCESSIBILITY_STATES[6], context, findings);

      const storedRequests = await getStoredRequests(page);
      await navigateToView(page, "dashboard", viewport);
      await page.locator("#import-backup-file").setInputFiles({
        name: "accessibility-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({ schemaVersion: 2, requests: storedRequests }),
        ),
      });
      await page.locator("#import-dialog").waitFor({ state: "visible" });
      await scanState(page, ACCESSIBILITY_STATES[7], context, findings);

      assertNoBrowserErrors(assert, diagnostics);
    }
  }

  const report = {
    scans: findings.scans,
    violations: serializeFindings(findings.violations),
    incomplete: serializeFindings(findings.incomplete),
  };
  const severe = report.violations.filter(({ impact }) =>
    ["serious", "critical"].includes(impact),
  );
  t.diagnostic(
    `axe matrix: ${JSON.stringify({
      scans: report.scans,
      violations: report.violations,
      incomplete: report.incomplete.map(({ id, contexts, nodes }) => ({
        id,
        contexts,
        targets: nodes.map(({ target }) => target),
      })),
    })}`,
  );
  assert.deepEqual(
    severe,
    [],
    `axe accessibility findings: ${JSON.stringify(report)}`,
  );
});

test("supports route focus, dialog keyboard use, and narrow 200% text layout", async (t) => {
  const { diagnostics, page } = await openApp(t);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${getServerBaseUrl()}#/painel`, {
    waitUntil: "networkidle",
  });

  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator(":focus").getAttribute("href"),
    "#main-content",
  );
  await page.keyboard.press("Enter");

  await page.locator('[data-view="requests"]').click();
  await page.waitForFunction(
    () => document.activeElement.id === "requests-title",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "requests-title",
  );
  assert.match(await page.title(), /Solicitações/);

  await page.locator('[data-view="new-request"]').click();
  await page.getByRole("button", { name: "Salvar solicitação" }).click();
  const summary = page.locator("#request-error-summary");
  assert.equal(await summary.isVisible(), true);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "request-error-summary",
  );
  assert.equal(await summary.locator("a").count(), 7);
  await summary.locator("a").first().click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "request-title",
  );
  assert.equal(new URL(page.url()).hash, "#/cadastrar");

  const firstRequest = await createRequestThroughForm(page, {
    title: "Solicitação para diálogo modal",
  });
  await page.locator("#demo-profile").selectOption("volunteer");
  await page.locator('[data-view="requests"]').click();
  const assignButton = page.getByRole("button", {
    name: "Assumir atendimento",
  });
  await assignButton.click();
  const actionDialog = page.locator("#action-dialog");
  await actionDialog.waitFor({ state: "visible" });
  assert.equal(await actionDialog.getAttribute("aria-modal"), "true");
  assert.equal(
    await actionDialog.evaluate((dialog) =>
      dialog.contains(document.activeElement),
    ),
    true,
  );
  await page.keyboard.press("Shift+Tab");
  const actionFocus = await page.evaluate(() => ({
    id: document.activeElement.id,
    tagName: document.activeElement.tagName,
    modal: document.querySelector("#action-dialog").matches(":modal"),
  }));
  assert.ok(
    await actionDialog.evaluate((dialog) =>
      dialog.contains(document.activeElement),
    ),
    `focus escaped native action dialog: ${JSON.stringify(actionFocus)}`,
  );
  await page.keyboard.press("Escape");
  await actionDialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.dataset.action === "assign",
  );

  await page.locator("#demo-profile").selectOption("requester");
  await page.locator('[data-view="new-request"]').click();
  const importRequest = await createRequestThroughForm(page, {
    title: "Solicitação que será importada",
  });
  const records = await getStoredRequests(page);
  await page.evaluate((id) => {
    const key = "nexusSocial.requests";
    const envelope = JSON.parse(localStorage.getItem(key));
    envelope.requests = envelope.requests.filter((record) => record.id !== id);
    localStorage.setItem(key, JSON.stringify(envelope));
  }, importRequest.id);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-view="dashboard"]').click();
  await page.locator("#import-backup-file").setInputFiles({
    name: "keyboard-import.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 2,
        requests: records.filter((record) => record.id === importRequest.id),
      }),
    ),
  });
  const importDialog = page.locator("#import-dialog");
  await importDialog.waitFor({ state: "visible" });
  assert.equal(await importDialog.getAttribute("aria-modal"), "true");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "import-dialog-cancel",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "import-dialog-confirm",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "import-dialog-cancel",
  );
  await page.keyboard.press("Escape");
  await importDialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement.id === "import-backup",
  );
  assert.deepEqual(
    (await getStoredRequests(page)).map(({ id }) => id),
    [firstRequest.id],
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
  const narrowLayout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowingElements: [...document.body.querySelectorAll("*")]
      .map((element) => ({
        element,
        bounds: element.getBoundingClientRect(),
      }))
      .filter(
        ({ bounds }) => bounds.right > document.documentElement.clientWidth + 1,
      )
      .map(({ element, bounds }) => ({
        tag: element.tagName,
        id: element.id,
        className:
          typeof element.className === "string" ? element.className : "",
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
      }))
      .slice(0, 15),
  }));
  assert.ok(
    narrowLayout.scrollWidth <= narrowLayout.clientWidth,
    `horizontal overflow at narrow 200% text layout: ${JSON.stringify(narrowLayout)}`,
  );
  assert.equal(await page.locator("#view-dashboard").isVisible(), true);

  const touchTargets = await page
    .locator(".menu-toggle, #theme-toggle, #demo-profile, #import-backup")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const { width, height } = element.getBoundingClientRect();
        return { id: element.id || element.className, width, height };
      }),
    );
  assert.ok(
    touchTargets.every(({ width, height }) => width >= 44 && height >= 44),
    `interactive target below 44x44 CSS px: ${JSON.stringify(touchTargets)}`,
  );
  assertNoBrowserErrors(assert, diagnostics);
});
