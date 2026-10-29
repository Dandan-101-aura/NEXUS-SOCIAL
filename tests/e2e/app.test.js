import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoBrowserErrors,
  createRequestThroughForm,
  getStoredRequests,
  runAppTest,
} from "./support.js";

test("starts empty, renders indicators and navigates across main views", async (t) =>
  runAppTest(t, async ({ diagnostics, page }) => {
    assert.match(await page.title(), /NEXUS SOCIAL/);
    assert.deepEqual(
      await page.locator("#dashboard-stats .stat-value").allTextContents(),
      ["0", "0", "0", "0", "0", "0"],
    );
    assert.equal(await page.locator("#dashboard-empty").isVisible(), true);
    assert.equal((await getStoredRequests(page)).length, 0);

    for (const [view, heading] of [
      ["requests", "Solicitações"],
      ["new-request", "Cadastrar solicitação"],
      ["details", "Detalhes da solicitação"],
      ["history", "Histórico"],
      ["dashboard", "Painel principal"],
    ]) {
      await page.locator(`[data-view="${view}"]`).click();
      await page.locator(`#view-${view}`).waitFor({ state: "visible" });
      assert.equal(
        await page.locator("main .view:not([hidden]) h1").textContent(),
        heading,
      );
      assert.equal(
        await page
          .locator("main")
          .evaluate(
            (main) =>
              [...main.querySelectorAll(".view")].filter(
                (section) => !section.hidden,
              ).length,
          ),
        1,
      );
    }

    assertNoBrowserErrors(assert, diagnostics);
  }));

test("validates form errors, creates safe text content and persists after reload", async (t) =>
  runAppTest(t, async ({ diagnostics, page }) => {
    await page.locator('[data-view="new-request"]').click();

    await page.getByRole("button", { name: "Salvar solicitação" }).click();
    assert.match(
      await page.locator("#request-title-error").textContent(),
      /obrigatório/i,
    );
    assert.equal((await getStoredRequests(page)).length, 0);

    await page.getByLabel("Título da solicitação").fill("Solicitação de teste");
    await page
      .getByLabel("Descrição")
      .fill("Descrição válida para o teste automatizado.");
    await page
      .locator("#request-form")
      .getByLabel("Categoria")
      .selectOption({ label: "Produtos de higiene" });
    await page.getByLabel("Quantidade").fill("0");
    await page.getByLabel("Unidade de medida").selectOption("unidades");
    await page.getByLabel("Região aproximada").fill("Centro");
    await page
      .locator("#request-form")
      .getByLabel("Urgência declarada")
      .selectOption("alta");
    await page.getByRole("button", { name: "Salvar solicitação" }).click();
    assert.match(
      await page.locator("#request-quantity-error").textContent(),
      /maior que zero/i,
    );
    assert.equal((await getStoredRequests(page)).length, 0);
    await page.locator("#request-form").getByLabel("Quantidade").fill("-1");
    await page.getByRole("button", { name: "Salvar solicitação" }).click();
    assert.match(
      await page.locator("#request-quantity-error").textContent(),
      /quantidade numérica válida/i,
    );
    assert.equal((await getStoredRequests(page)).length, 0);

    const title = '<strong>Kit "especial" & básico</strong>';
    const description =
      'Texto literal <em>sem execução</em>, "aspas" & símbolos.';
    const request = await createRequestThroughForm(page, {
      title,
      description,
      category: "Produtos de higiene",
      urgency: "alta",
    });
    assert.equal(request.title, title);
    assert.equal(request.description, description);
    assert.equal(
      await page.locator("#dashboard-stats .stat-value").first().textContent(),
      "1",
    );

    await page.locator('[data-view="requests"]').click();
    assert.equal(
      await page
        .locator("#request-list .request-card h3")
        .first()
        .textContent(),
      title,
    );
    assert.equal(
      await page.locator("#request-list .request-card h3 strong").count(),
      0,
    );
    assert.equal(
      await page
        .locator("#request-list .request-card .request-description em")
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator("#request-list .request-description")
        .first()
        .textContent(),
      description,
    );

    await page.reload({ waitUntil: "networkidle" });
    assert.equal((await getStoredRequests(page)).length, 1);
    assert.equal(
      await page.locator("#dashboard-stats .stat-value").first().textContent(),
      "1",
    );
    assertNoBrowserErrors(assert, diagnostics);
  }));

test("searches, combines filters, reports no results and clears all criteria", async (t) =>
  runAppTest(t, async ({ diagnostics, page }) => {
    await createRequestThroughForm(page, {
      title: "Cesta inicial",
      description: "Arroz e feijão para consulta.",
      category: "Alimentos não perecíveis",
      urgency: "alta",
    });
    await createRequestThroughForm(page, {
      title: "Kit limpeza",
      description: "Sabonete e pasta de dente.",
      category: "Produtos de higiene",
      urgency: "alta",
    });
    await createRequestThroughForm(page, {
      title: "Casaco",
      description: "Roupa para o frio.",
      category: "Roupas",
      urgency: "baixa",
    });

    await page.locator('[data-view="requests"]').click();
    await page.getByLabel("Pesquisar").fill("  ARROZ   E FEIJÃO ");
    assert.deepEqual(
      await page.locator("#request-list .request-card h3").allTextContents(),
      ["Cesta inicial"],
    );
    await page.getByLabel("Pesquisar").fill("termo inexistente");
    assert.equal(await page.locator("#requests-no-results").isVisible(), true);
    assert.equal(await page.locator("#request-list .request-card").count(), 0);

    await page.getByLabel("Pesquisar").fill("");
    await page.locator("#filter-category").selectOption("Produtos de higiene");
    await page.getByLabel("Status").selectOption("aberto");
    await page.locator("#filter-urgency").selectOption("alta");
    assert.deepEqual(
      await page.locator("#request-list .request-card h3").allTextContents(),
      ["Kit limpeza"],
    );

    await page.getByRole("button", { name: "Limpar filtros" }).click();
    assert.equal(await page.locator("#request-list .request-card").count(), 3);
    assert.equal(await page.locator("#requests-no-results").isVisible(), false);
    assertNoBrowserErrors(assert, diagnostics);
  }));

test("workflow actions update status, separate receipt and preserve history", async (t) =>
  runAppTest(t, async ({ diagnostics, page }) => {
    const request = await createRequestThroughForm(page, {
      title: "Fluxo de atendimento",
    });
    await page.locator('[data-view="requests"]').click();

    await page.getByLabel("Perfil").selectOption("volunteer");
    await page
      .locator(
        `#request-list [data-action="assign"][data-request-id="${request.id}"]`,
      )
      .click();
    await page.getByRole("button", { name: "Assumir", exact: true }).click();
    let [saved] = await getStoredRequests(page);
    assert.equal(saved.status, "em_atendimento");
    assert.equal(saved.assignedVolunteerId, "voluntario-demo");
    assert.equal(
      await page
        .locator(
          `#request-list [data-action="assign"][data-request-id="${request.id}"]`,
        )
        .count(),
      0,
    );

    await page
      .locator(
        `#request-list [data-action="complete"][data-request-id="${request.id}"]`,
      )
      .click();
    await page
      .getByRole("button", { name: "Declarar conclusão", exact: true })
      .last()
      .click();
    [saved] = await getStoredRequests(page);
    assert.equal(saved.status, "conclusao_declarada");
    assert.ok(saved.completedAt);
    assert.equal(saved.receiptConfirmedAt, null);

    await page.getByLabel("Perfil").selectOption("requester");
    await page
      .locator(
        `#request-list [data-action="confirm"][data-request-id="${request.id}"]`,
      )
      .click();
    await page
      .getByRole("button", { name: "Confirmar na demonstração" })
      .click();
    [saved] = await getStoredRequests(page);
    assert.equal(saved.status, "recebimento_confirmado");
    assert.ok(saved.receiptConfirmedAt);

    await page.getByLabel("Perfil").selectOption("moderator");
    await page
      .locator(
        `#request-list [data-action="suspend"][data-request-id="${request.id}"]`,
      )
      .click();
    await page
      .getByLabel("Justificativa da revisão")
      .fill("Revisão do fluxo automatizado");
    await page.getByRole("button", { name: "Suspender", exact: true }).click();
    await page
      .locator(
        `#request-list [data-action="reopen"][data-request-id="${request.id}"]`,
      )
      .click();
    await page
      .getByLabel("Justificativa da reabertura")
      .fill("Reabertura do fluxo automatizado");
    await page.getByRole("button", { name: "Reabrir", exact: true }).click();

    [saved] = await getStoredRequests(page);
    assert.equal(saved.status, "aberto");
    assert.equal(saved.history.length, 6);
    assert.deepEqual(
      saved.history.map(({ actionType }) => actionType),
      [
        "solicitacao_criada",
        "voluntario_atribuido",
        "conclusao_declarada",
        "recebimento_confirmado_demo",
        "solicitacao_suspensa",
        "solicitacao_reaberta",
      ],
    );
    assert.deepEqual(
      await page.locator("#dashboard-stats .stat-value").allTextContents(),
      ["1", "0", "0", "0", "0", "0"],
    );

    await page
      .locator(
        `#request-list [data-action="details"][data-request-id="${request.id}"]`,
      )
      .click();
    assert.equal(
      await page.locator("#selected-request-details h2").textContent(),
      request.title,
    );
    await page.locator('[data-view="history"]').click();
    assert.equal(await page.locator("#history-list .history-entry").count(), 6);
    assertNoBrowserErrors(assert, diagnostics);
  }));

test("withdrawal, cancellation and suspension require valid confirmation flows", async (t) =>
  runAppTest(t, async ({ diagnostics, page }) => {
    const withdrawal = await createRequestThroughForm(page, {
      title: "Desistência",
    });
    const cancellation = await createRequestThroughForm(page, {
      title: "Cancelamento",
    });
    const suspension = await createRequestThroughForm(page, {
      title: "Suspensão",
    });
    await page.locator('[data-view="requests"]').click();

    await page.getByLabel("Perfil").selectOption("volunteer");
    await page
      .locator(
        `#request-list [data-action="assign"][data-request-id="${withdrawal.id}"]`,
      )
      .click();
    await page.getByRole("button", { name: "Assumir", exact: true }).click();
    await page
      .locator(
        `#request-list [data-action="withdraw"][data-request-id="${withdrawal.id}"]`,
      )
      .click();
    await page.getByRole("button", { name: "Voltar" }).click();
    assert.equal(
      (await getStoredRequests(page)).find(({ id }) => id === withdrawal.id)
        .status,
      "em_atendimento",
    );
    await page
      .locator(
        `#request-list [data-action="withdraw"][data-request-id="${withdrawal.id}"]`,
      )
      .click();
    await page.getByRole("button", { name: "Confirmar desistência" }).click();
    assert.equal(
      (await getStoredRequests(page)).find(({ id }) => id === withdrawal.id)
        .status,
      "aberto",
    );

    await page.getByLabel("Perfil").selectOption("requester");
    await page
      .locator(
        `#request-list [data-action="cancel"][data-request-id="${cancellation.id}"]`,
      )
      .click();
    await page.getByRole("button", { name: "Voltar" }).click();
    assert.equal(
      (await getStoredRequests(page)).find(({ id }) => id === cancellation.id)
        .status,
      "aberto",
    );
    await page
      .locator(
        `#request-list [data-action="cancel"][data-request-id="${cancellation.id}"]`,
      )
      .click();
    await page
      .getByLabel("Motivo do cancelamento")
      .fill("Cancelamento confirmado no teste");
    await page
      .getByRole("button", { name: "Cancelar solicitação", exact: true })
      .last()
      .click();
    assert.equal(
      (await getStoredRequests(page)).find(({ id }) => id === cancellation.id)
        .status,
      "cancelado",
    );

    await page.getByLabel("Perfil").selectOption("moderator");
    await page
      .locator(
        `#request-list [data-action="suspend"][data-request-id="${suspension.id}"]`,
      )
      .click();
    await page
      .getByLabel("Justificativa da revisão")
      .fill("Suspensão confirmada no teste");
    await page.getByRole("button", { name: "Suspender", exact: true }).click();
    assert.equal(
      (await getStoredRequests(page)).find(({ id }) => id === suspension.id)
        .status,
      "suspenso_para_revisao",
    );

    await page.getByLabel("Perfil").selectOption("volunteer");
    assert.equal(
      await page
        .locator(
          `#request-list [data-action="assign"][data-request-id="${cancellation.id}"]`,
        )
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator(
          `#request-list [data-action="assign"][data-request-id="${suspension.id}"]`,
        )
        .count(),
      0,
    );
    assertNoBrowserErrors(assert, diagnostics);
  }));

test("mobile navigation, keyboard focus, labels and supported viewport widths work", async (t) =>
  runAppTest(
    t,
    async ({ diagnostics, page }) => {
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .locator(":focus")
          .evaluate((element) => element.classList.contains("skip-link")),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .locator(":focus")
          .evaluate(
            (element) =>
              getComputedStyle(element).outlineStyle !== "none" &&
              getComputedStyle(element).outlineWidth !== "0px",
          ),
        true,
      );

      await page.locator(".menu-toggle").click();
      assert.equal(
        await page.locator(".menu-toggle").getAttribute("aria-expanded"),
        "true",
      );
      assert.equal(
        await page
          .locator("#site-navigation")
          .evaluate((navigation) => navigation.inert),
        false,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(".menu-toggle").getAttribute("aria-expanded"),
        "false",
      );
      assert.equal(
        await page
          .locator(":focus")
          .evaluate((element) => element.classList.contains("menu-toggle")),
        true,
      );

      assert.equal(
        await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              "#request-form input, #request-form textarea, #request-form select",
            ),
          ].every((field) =>
            document.querySelector(`label[for="${CSS.escape(field.id)}"]`),
          ),
        ),
        true,
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page
          .locator(".nav-link")
          .first()
          .evaluate((element) => getComputedStyle(element).transitionDuration),
        "1e-05s",
      );

      const viewportResults = [];
      for (const width of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        viewportResults.push(
          await page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            overflowingElements: [...document.body.querySelectorAll("*")]
              .map((element) => ({
                element,
                bounds: element.getBoundingClientRect(),
              }))
              .filter(
                ({ bounds }) =>
                  bounds.right > document.documentElement.clientWidth + 1,
              )
              .map(({ element, bounds }) => ({
                tag: element.tagName,
                id: element.id,
                className:
                  typeof element.className === "string"
                    ? element.className
                    : "",
                left: Math.round(bounds.left),
                right: Math.round(bounds.right),
              }))
              .slice(0, 10),
          })),
        );
        assert.equal(
          await page.locator(".profile-control select").isVisible(),
          true,
        );
        assert.equal(
          await page.locator("main .view:not([hidden]) h1").isVisible(),
          true,
        );
      }
      assert.ok(
        viewportResults.every(
          ({ clientWidth, scrollWidth }) => scrollWidth <= clientWidth,
        ),
        `horizontal overflow by viewport: ${JSON.stringify(viewportResults)}`,
      );
      assertNoBrowserErrors(assert, diagnostics);
    },
    { width: 390, height: 844 },
  ));

test("exports, clears isolated storage and additively imports a backup", async (t) =>
  runAppTest(t, async ({ diagnostics, page }) => {
    const title = '<img src=x onerror="alert(1)"> pedido restaurado';
    const description = "Descrição <script>literal</script> da importação.";
    const original = await createRequestThroughForm(page, {
      title,
      description,
    });

    await page.locator('[data-view="dashboard"]').click();
    await page.evaluate(() => {
      const createObjectURL = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        window.lastExportBlob = blob;
        return createObjectURL(blob);
      };
    });
    await page.getByRole("button", { name: /Exportar backup/ }).click();
    await page
      .locator("#toast-region .toast-text", {
        hasText: "Backup com 1 solicitação(ões) baixado.",
      })
      .waitFor();
    const backupText = await page.evaluate(() => window.lastExportBlob.text());
    assert.equal(JSON.parse(backupText).requests.length, 1);

    await page.evaluate(() => localStorage.removeItem("nexusSocial.requests"));
    await page.reload({ waitUntil: "networkidle" });
    assert.equal((await getStoredRequests(page)).length, 0);

    await page.locator("#import-backup-file").setInputFiles({
      name: "nexus-social-backup-exportado.json",
      mimeType: "application/json",
      buffer: Buffer.from(backupText),
    });
    const dialog = page.locator("#import-dialog");
    await dialog.waitFor({ state: "visible" });
    assert.match(
      await page.locator("#import-preview-summary").textContent(),
      /Serão adicionadas: 1/,
    );
    const confirmButton = page.getByRole("button", {
      name: "Confirmar importação",
    });
    assert.equal(await confirmButton.isEnabled(), true);

    await confirmButton.click();
    await page
      .locator("#toast-region .toast-text", {
        hasText: "Importação concluída: 1 solicitação(ões) adicionada(s).",
      })
      .waitFor();
    assert.deepEqual(await getStoredRequests(page), [original]);

    const importBackup = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith("nexusSocial.requests.backup.import."),
      );
      return key ? JSON.parse(localStorage.getItem(key)) : null;
    });
    assert.deepEqual(importBackup, { schemaVersion: 2, requests: [] });

    await page.locator('[data-view="requests"]').click();
    assert.equal(
      await page.locator("#request-list .request-card h3").textContent(),
      title,
    );
    assert.equal(
      await page.locator("#request-list .request-card img").count(),
      0,
    );
    assertNoBrowserErrors(assert, diagnostics);
  }));

test("cancelling an import by button or Escape does not change stored data", async (t) =>
  runAppTest(t, async ({ page }) => {
    const existing = await createRequestThroughForm(page, {
      title: "Registro anterior à pré-visualização",
    });
    const candidate = await createRequestThroughForm(page, {
      title: "Registro candidato à importação",
    });
    await page.evaluate((requestId) => {
      const envelope = JSON.parse(localStorage.getItem("nexusSocial.requests"));
      envelope.requests = envelope.requests.filter(
        (request) => request.id === requestId,
      );
      localStorage.setItem("nexusSocial.requests", JSON.stringify(envelope));
    }, existing.id);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-view="dashboard"]').click();
    const before = await page.evaluate(() =>
      localStorage.getItem("nexusSocial.requests"),
    );
    const candidateBackup = JSON.stringify({
      app: "nexus-social",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      requests: [candidate],
    });
    const file = {
      name: "candidate.json",
      mimeType: "application/json",
      buffer: Buffer.from(candidateBackup),
    };
    const fileInput = page.locator("#import-backup-file");
    const dialog = page.locator("#import-dialog");

    await fileInput.setInputFiles(file);
    await dialog.waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Cancelar" }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement?.id === "import-backup",
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("nexusSocial.requests")),
      before,
    );

    await fileInput.setInputFiles(file);
    await dialog.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement?.id === "import-backup",
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("nexusSocial.requests")),
      before,
    );
  }));

test("invalid import file reports an error without changing stored data", async (t) =>
  runAppTest(t, async ({ page }) => {
    const existing = await createRequestThroughForm(page, {
      title: "Registro deve permanecer intacto",
    });
    const before = await page.evaluate(() =>
      localStorage.getItem("nexusSocial.requests"),
    );

    await page.locator("#import-backup-file").setInputFiles({
      name: "backup-invalido.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ JSON inválido"),
    });
    await page.locator("#import-dialog").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#import-preview").getAttribute("aria-live"),
      "polite",
    );
    assert.equal(
      await page.locator("#import-backup-file").getAttribute("aria-label"),
      "Selecionar arquivo de backup JSON",
    );
    assert.match(
      await page.locator("#import-preview-error").textContent(),
      /JSON válido/,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Confirmar importação" })
        .isEnabled(),
      false,
    );
    assert.match(
      await page.locator("#toast-region .toast-text").last().textContent(),
      /JSON válido/,
    );
    await page.getByRole("button", { name: "Cancelar" }).click();

    assert.deepEqual(await getStoredRequests(page), [existing]);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("nexusSocial.requests")),
      before,
    );
  }));
