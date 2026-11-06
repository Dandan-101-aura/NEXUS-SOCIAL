import assert from "node:assert/strict";
import test from "node:test";
import AxeBuilder from "@axe-core/playwright";
import {
  assertNoBrowserErrors,
  createRequestThroughForm,
  getServerBaseUrl,
  getStoredRequests,
  openApp,
  clickPrimaryNavLink,
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
    localStorage.setItem("nexusSocial.theme", value);
  }, theme);
  await page.reload({ waitUntil: "networkidle" });
}

async function measureTextContrast(page, selectors) {
  const targets = await page.evaluate(async (textSelectors) => {
    const style = document.createElement("style");
    style.textContent = textSelectors
      .map(
        (selector) =>
          `${selector}{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}`,
      )
      .join("\n");
    const textTargets = textSelectors.flatMap((selector) => {
      const element = document.querySelector(selector);
      if (!element || !element.getClientRects().length) return [];
      const range = document.createRange();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const rects = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        range.selectNodeContents(walker.currentNode);
        rects.push(
          ...[...range.getClientRects()].map(({ x, y, width, height }) => ({
            x,
            y,
            width,
            height,
          })),
        );
      }
      const computed = getComputedStyle(element);
      return rects.length
        ? [
            {
              selector,
              theme: document.documentElement.dataset.theme,
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              bounds: element.getBoundingClientRect().toJSON(),
              fontSize: Number.parseFloat(computed.fontSize),
              fontWeight: Number.parseInt(computed.fontWeight, 10),
              rects,
            },
          ]
        : [];
    });
    document.head.append(style);
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    return textTargets;
  }, selectors);

  const screenshot = await page.screenshot();
  const pngBase64 = screenshot.toString("base64");
  const transparentColors = await page.evaluate(
    (textSelectors) =>
      textSelectors.flatMap((selector) => {
        const element = document.querySelector(selector);
        return element
          ? [{ selector, color: getComputedStyle(element).color }]
          : [];
      }),
    selectors,
  );
  const measurements = await page.evaluate(
    async ({ base64, textTargets, renderedColors }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const scaleX = canvas.width / window.innerWidth;
      const scaleY = canvas.height / window.innerHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const luminance = (rgb) => {
        const channels = rgb.map((value) => {
          const normalized = value / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };

      return textTargets.map((target) => {
        const foreground = target.color.match(/[\d.]+/g).map(Number);
        let minimum = Infinity;
        let worstBackground = null;
        let worstPixel = null;
        for (const rect of target.rects) {
          const left = Math.max(0, Math.floor(rect.x * scaleX));
          const top = Math.max(0, Math.floor(rect.y * scaleY));
          const right = Math.min(
            canvas.width,
            Math.ceil((rect.x + rect.width) * scaleX),
          );
          const bottom = Math.min(
            canvas.height,
            Math.ceil((rect.y + rect.height) * scaleY),
          );
          for (let y = top; y < bottom; y += 1) {
            for (let x = left; x < right; x += 1) {
              const offset = (y * canvas.width + x) * 4;
              const background = [
                pixels.data[offset],
                pixels.data[offset + 1],
                pixels.data[offset + 2],
              ];
              const alpha = foreground.length > 3 ? foreground[3] : 1;
              const compositedForeground = background.map(
                (channel, index) =>
                  foreground[index] * alpha + channel * (1 - alpha),
              );
              const light = Math.max(
                luminance(compositedForeground),
                luminance(background),
              );
              const dark = Math.min(
                luminance(compositedForeground),
                luminance(background),
              );
              const ratio = (light + 0.05) / (dark + 0.05);
              if (ratio < minimum) {
                minimum = ratio;
                worstBackground = background;
                worstPixel = { x, y };
              }
            }
          }
        }
        return {
          selector: target.selector,
          theme: target.theme,
          color: target.color,
          backgroundColor: target.backgroundColor,
          bounds: target.bounds,
          transparentColor: renderedColors.find(
            ({ selector }) => selector === target.selector,
          )?.color,
          fontSize: target.fontSize,
          fontWeight: target.fontWeight,
          minimum: Number(minimum.toFixed(2)),
          worstBackground,
          worstPixel,
          rects: target.rects,
          threshold:
            target.fontSize >= 24 ||
            (target.fontSize >= 18.67 && target.fontWeight >= 700)
              ? 3
              : 4.5,
        };
      });
    },
    {
      base64: pngBase64,
      textTargets: targets,
      renderedColors: transparentColors,
    },
  );

  await page.evaluate(() =>
    document.head.querySelectorAll("style").forEach((style) => {
      if (style.textContent.includes("-webkit-text-fill-color:transparent")) {
        style.remove();
      }
    }),
  );
  return measurements;
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
  const navigation =
    viewport.width <= 680
      ? page.getByRole("navigation", { name: "Navegação rápida" })
      : page.getByRole("navigation", { name: "Seções" });
  await navigation.locator(`[data-view="${view}"]`).click();
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

  await clickPrimaryNavLink(page, "requests");
  await page.waitForFunction(
    () => document.activeElement.id === "requests-title",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "requests-title",
  );
  assert.match(await page.title(), /Solicitações/);

  await clickPrimaryNavLink(page, "new-request");
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
  await clickPrimaryNavLink(page, "requests");
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
  await clickPrimaryNavLink(page, "new-request");
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
  await clickPrimaryNavLink(page, "dashboard");
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
    .locator("#theme-toggle, #demo-profile, #import-backup")
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

test("measures text contrast over public and image-backed hero backgrounds", async (t) => {
  const selectorsByArea = {
    "apresentação pública": [
      ".public-how-link",
      ".public-nav .button-primary",
      "#public-title",
      "#public-title em",
      ".public-hero-copy > p:not(.public-demo-note)",
      ".public-hero-actions .button-primary",
      ".public-secondary-link",
      ".public-demo-note > span:nth-child(2)",
      ".public-hero-visual figcaption",
    ],
    "hero do painel": [
      ".welcome-kicker",
      ".welcome-copy h2",
      ".welcome-copy h2 em",
      ".welcome-copy > p",
      ".welcome-actions .button-light",
      ".welcome-actions .button-ghost-light",
      ".welcome-photo-credit",
      ".welcome-tagline-box p",
    ],
  };
  const measurements = [];

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const { page } = await openApp(t, viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(getServerBaseUrl(), { waitUntil: "networkidle" });
      await setTheme(page, theme);

      for (const [area, selectors] of Object.entries(selectorsByArea)) {
        if (area === "hero do painel") {
          await page
            .getByRole("link", { name: /Abrir a demonstração/ })
            .click();
          await page.locator("#view-dashboard").waitFor({ state: "visible" });
          await page.waitForTimeout(500);
          await page.waitForFunction(() => {
            const view = document.querySelector("#view-dashboard");
            return (
              getComputedStyle(view).opacity === "1" &&
              view
                .getAnimations()
                .every((animation) => animation.playState === "finished")
            );
          });
          if (viewport.width === 360) {
            await page.evaluate(() => window.scrollTo(0, 150));
            await page.waitForFunction(() => window.scrollY >= 150);
          }
        }
        const results = await measureTextContrast(page, selectors);
        measurements.push(
          ...results.map((result) => ({
            ...result,
            area,
            theme,
            viewport: `${viewport.width}x${viewport.height}`,
          })),
        );
        if (area === "apresentação pública") {
          await page.reload({ waitUntil: "networkidle" });
          await setTheme(page, theme);
        }
      }
    }
  }

  const grouped = Object.groupBy
    ? Object.groupBy(
        measurements,
        ({ area, theme, viewport }) => `${area} / ${theme} / ${viewport}`,
      )
    : measurements.reduce((groups, result) => {
        const key = `${result.area} / ${result.theme} / ${result.viewport}`;
        (groups[key] ??= []).push(result);
        return groups;
      }, {});
  const table = Object.entries(grouped).map(([context, results]) => ({
    context,
    minimum: Math.min(...results.map(({ minimum }) => minimum)),
    target: results.find(
      ({ minimum }) =>
        minimum === Math.min(...results.map((result) => result.minimum)),
    )?.selector,
  }));
  const failures = measurements.filter(
    ({ minimum, threshold }) => minimum < threshold,
  );
  t.diagnostic(
    `text contrast over image/gradient backgrounds: ${JSON.stringify({
      table,
      failures,
    })}`,
  );
  assert.ok(measurements.length > 0, "contrast targets were sampled");
  assert.deepEqual(failures, [], "hero text contrast below its size threshold");
});
