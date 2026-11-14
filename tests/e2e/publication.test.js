import assert from "node:assert/strict";
import test from "node:test";
import AxeBuilder from "@axe-core/playwright";
import { buildDemoRequests } from "../../JavaScript/demo-data.js";
import {
  assertNoBrowserErrors,
  createRequestThroughForm,
  getServerBaseUrl,
  openApp,
} from "./support.js";

const THEMES = ["light", "dark"];
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 360, height: 740 },
];
const ROUTES = [
  "",
  "#/inicio",
  "#/painel",
  "#/solicitacoes",
  "#/cadastrar",
  "#/solicitacao",
  "#/solicitacao/demo-id",
  "#/historico",
  "#/sobre-dados",
];

async function openTheme(page, theme, route = "#/inicio") {
  await page.goto(getServerBaseUrl(), { waitUntil: "networkidle" });
  await page.evaluate((value) => {
    localStorage.setItem("nexusSocial.theme", value);
  }, theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, route);
  await page.waitForFunction((hash) => window.location.hash === hash, route);
  assert.equal(
    await page.locator("html").getAttribute("data-theme"),
    theme,
    `theme ${theme} was not applied`,
  );
  await page.waitForTimeout(100);
}

async function measureContrast(page, selectors) {
  const targets = await page.evaluate(async (textSelectors) => {
    const textTargets = textSelectors.flatMap((selector) => {
      const element = document.querySelector(selector);
      if (!element || !element.getClientRects().length) {
        return [];
      }
      const range = document.createRange();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const rects = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) {
          continue;
        }
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
      const fontSize = Number.parseFloat(computed.fontSize);
      const fontWeight = Number.parseInt(computed.fontWeight, 10);
      return rects.length
        ? [
            {
              selector,
              color: computed.color,
              fontSize,
              fontWeight,
              textClass:
                fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)
                  ? "texto grande"
                  : "texto normal",
              rects,
            },
          ]
        : [];
    });

    const style = document.createElement("style");
    style.dataset.contrastMeasurement = "";
    style.textContent = textSelectors
      .map(
        (selector) =>
          `${selector}{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}`,
      )
      .join("\n");
    document.head.append(style);
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    return textTargets;
  }, selectors);

  const screenshot = await page.screenshot();
  const results = await page.evaluate(
    async ({ base64, textTargets }) => {
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
              const composite = background.map(
                (channel, index) =>
                  foreground[index] * alpha + channel * (1 - alpha),
              );
              const light = Math.max(
                luminance(composite),
                luminance(background),
              );
              const dark = Math.min(
                luminance(composite),
                luminance(background),
              );
              const ratio = (light + 0.05) / (dark + 0.05);
              if (ratio < minimum) {
                minimum = ratio;
                worstBackground = background;
              }
            }
          }
        }
        return {
          selector: target.selector,
          color: target.color,
          fontSize: target.fontSize,
          fontWeight: target.fontWeight,
          textClass: target.textClass,
          minimum: Number(minimum.toFixed(2)),
          worstBackground,
          threshold: target.textClass === "texto grande" ? 3 : 4.5,
        };
      });
    },
    { base64: screenshot.toString("base64"), textTargets: targets },
  );
  await page.evaluate(() =>
    document
      .querySelectorAll("[data-contrast-measurement]")
      .forEach((style) => style.remove()),
  );
  return results;
}

test("local-only guard covers every route and rendered resource", async (t) => {
  const { diagnostics, page } = await openApp(t);
  const externalRequests = [];
  const baseOrigin = new URL(getServerBaseUrl()).origin;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin !== baseOrigin
    ) {
      externalRequests.push(url.href);
    }
  });

  for (const route of ROUTES) {
    await page.goto(`${getServerBaseUrl()}${route}`, {
      waitUntil: "networkidle",
    });
    const state = await page.evaluate(() => {
      const externalReferences = [
        ...document.querySelectorAll("script, link, iframe, img"),
      ].flatMap((element) =>
        ["src", "href", "srcset"].flatMap((attribute) => {
          const value = element.getAttribute(attribute);
          if (!value) {
            return [];
          }
          const candidates =
            attribute === "srcset"
              ? value
                  .split(",")
                  .map((candidate) => candidate.trim().split(/\s+/)[0])
              : [value];
          return candidates
            .map((candidate) => new URL(candidate, document.baseURI))
            .filter(
              (url) =>
                ["http:", "https:"].includes(url.protocol) &&
                url.origin !== window.location.origin,
            )
            .map((url) => ({
              tag: element.tagName.toLowerCase(),
              attribute,
              url: url.href,
            }));
        }),
      );
      return {
        cookie: document.cookie,
        externalReferences,
        route: window.location.hash,
      };
    });
    assert.equal(state.route, route);
    assert.equal(state.cookie, "", `cookie present on ${route}`);
    assert.deepEqual(
      state.externalReferences,
      [],
      `external DOM resource on ${route}`,
    );
  }

  assert.deepEqual(externalRequests, [], "external network request detected");
  assertNoBrowserErrors(assert, diagnostics);
  t.diagnostic(
    `local-only guard: ${ROUTES.length} routes; no external requests, DOM resources, or cookies`,
  );
});

test("about-data page is reachable, responsive, locally fonted, and axe-clean", async (t) => {
  const scans = [];

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const { diagnostics, page } = await openApp(t, viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openTheme(page, theme);

      const publicLayout = await page.evaluate(async () => {
        await document.fonts.ready;
        const title = document.querySelector("#public-title");
        const range = document.createRange();
        range.selectNodeContents(title);
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          titleSize: getComputedStyle(title).fontSize,
          titleLineCount: range.getClientRects().length,
        };
      });
      assert.ok(
        publicLayout.scrollWidth <= publicLayout.clientWidth,
        `public presentation overflow in ${theme} ${viewport.width}x${viewport.height}: ${JSON.stringify(publicLayout)}`,
      );

      await page.locator(".public-footer a[href='#/sobre-dados']").click();
      await page.locator("#view-about-data").waitFor({ state: "visible" });
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains("data-privacy-title"),
      );
      assert.match(await page.title(), /Sobre os dados/);
      assert.match(
        await page.locator("#view-about-data").innerText(),
        /nexusSocial\.requests[\s\S]*nexusSocial\.theme[\s\S]*três cópias[\s\S]*não substitui orientação jurídica/i,
      );

      const visual = await page.evaluate(async () => {
        await Promise.all([
          document.fonts.load("400 16px Inter"),
          document.fonts.load("700 20px 'Plus Jakarta Sans'"),
          document.fonts.load("500 20px Fraunces"),
        ]);
        await document.fonts.ready;
        const title = document.querySelector("#view-about-data h1");
        const bounds = title.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(title);
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          titleFont: getComputedStyle(title).fontFamily,
          titleSize: getComputedStyle(title).fontSize,
          titleLineCount: range.getClientRects().length,
          titleLeft: Math.round(bounds.left),
          titleRight: Math.round(bounds.right),
          localFontsReady:
            document.fonts.check("700 20px 'Plus Jakarta Sans'") &&
            document.fonts.check("500 20px Fraunces"),
        };
      });
      assert.ok(
        visual.scrollWidth <= visual.clientWidth,
        `horizontal overflow in ${theme} ${viewport.width}x${viewport.height}: ${JSON.stringify(visual)}`,
      );
      assert.match(visual.titleFont, /Fraunces/);
      assert.equal(visual.localFontsReady, true);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      const severe = results.violations.filter(({ impact }) =>
        ["serious", "critical"].includes(impact),
      );
      scans.push({
        theme,
        viewport: `${viewport.width}x${viewport.height}`,
        publicTitleSize: publicLayout.titleSize,
        publicTitleLines: publicLayout.titleLineCount,
        lineCount: visual.titleLineCount,
        titleSize: visual.titleSize,
        axeViolations: results.violations.map(({ id, impact }) => ({
          id,
          impact,
        })),
      });
      assert.deepEqual(
        severe,
        [],
        `serious/critical axe findings on about-data: ${JSON.stringify(severe)}`,
      );
      assertNoBrowserErrors(assert, diagnostics);

      await page.goto(`${getServerBaseUrl()}#/painel`, {
        waitUntil: "networkidle",
      });
      await page.locator("#view-dashboard").waitFor({ state: "visible" });
      await page.locator(".site-footer a[href='#/sobre-dados']").click();
      await page.locator("#view-about-data").waitFor({ state: "visible" });
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains("data-privacy-title"),
      );
    }
  }

  t.diagnostic(
    `about-data axe and responsive matrix: ${JSON.stringify(scans)}`,
  );
});

test("measures hero contrast and classifies text from computed size and weight", async (t) => {
  const targetsByArea = {
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
    "Hero do painel": [
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
      const { diagnostics, page } = await openApp(t, viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openTheme(page, theme);

      for (const [area, selectors] of Object.entries(targetsByArea)) {
        if (area === "Hero do painel") {
          await page.goto(`${getServerBaseUrl()}#/painel`, {
            waitUntil: "networkidle",
          });
          await page.locator("#view-dashboard").waitFor({ state: "visible" });
          await page.waitForFunction(() =>
            [
              ...document.querySelector("#view-dashboard").getAnimations(),
            ].every((animation) => animation.playState === "finished"),
          );
          if (viewport.width === 360) {
            await page.evaluate(() => window.scrollTo(0, 150));
            await page.waitForFunction(() => window.scrollY >= 150);
          }
        }

        measurements.push(
          ...(await measureContrast(page, selectors)).map((result) => ({
            ...result,
            area,
            theme,
            viewport: `${viewport.width}x${viewport.height}`,
          })),
        );
        if (area === "apresentação pública" && viewport.width === 360) {
          const captionSelector = ".public-hero-visual figcaption";
          await page.locator(captionSelector).scrollIntoViewIfNeeded();
          await page.waitForTimeout(120);
          const [caption] = await measureContrast(page, [captionSelector]);
          assert.ok(caption, "mobile public Hero caption contrast was sampled");
          measurements.push({
            ...caption,
            area,
            theme,
            viewport: `${viewport.width}x${viewport.height}`,
          });
        }
      }
      assertNoBrowserErrors(assert, diagnostics);
    }
  }

  const failures = measurements.filter(
    ({ minimum, threshold }) => minimum < threshold,
  );
  t.diagnostic(
    `hero text contrast classifications: ${JSON.stringify({ measurements, failures })}`,
  );
  assert.ok(measurements.length > 0, "hero contrast targets were measured");
  assert.deepEqual(
    failures,
    [],
    "public or image-backed hero text is below its computed-size threshold",
  );
});

test("measures dock labels, toast, and import dialog contrast in both themes", async (t) => {
  const measurements = [];
  const dockSelectors = [1, 2, 3, 4].map(
    (index) => `.dock-item:nth-of-type(${index}) .dock-label`,
  );

  for (const theme of THEMES) {
    const { diagnostics, page } = await openApp(t, {
      width: 360,
      height: 740,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openTheme(page, theme, "#/painel");
    await page.addStyleTag({
      content:
        ".dock-label{opacity:1!important;transform:translate(-50%,0)!important}",
    });

    const maxScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    for (const [position, scrollTop] of [
      ["top", 0],
      ["middle", Math.round(maxScroll / 2)],
      ["bottom", maxScroll],
    ]) {
      await page.evaluate((value) => window.scrollTo(0, value), scrollTop);
      await page.waitForTimeout(80);
      const results = await measureContrast(page, dockSelectors);
      measurements.push(
        ...results.map((result) => ({
          ...result,
          context: `dock-${position}`,
          theme,
          viewport: "360x740",
        })),
      );
    }

    await page.goto(`${getServerBaseUrl()}#/cadastrar`, {
      waitUntil: "networkidle",
    });
    await page.locator("#request-submit").click();
    await page
      .locator("#toast-region .toast-error .toast-text")
      .waitFor({ state: "visible" });
    measurements.push(
      ...(
        await measureContrast(page, ["#toast-region .toast-error .toast-text"])
      ).map((result) => ({
        ...result,
        context: "toast de erro",
        theme,
        viewport: "360x740",
      })),
    );
    await page.locator("#toast-region .toast-error .toast-close").click();
    await page
      .locator("#toast-region .toast-error")
      .waitFor({ state: "detached" });
    await createRequestThroughForm(page, {
      title: "Teste de contraste do toast",
    });
    await page
      .locator("#toast-region .toast-success .toast-text")
      .waitFor({ state: "visible" });
    measurements.push(
      ...(
        await measureContrast(page, [
          "#toast-region .toast-success .toast-text",
        ])
      ).map((result) => ({
        ...result,
        context: "toast de sucesso",
        theme,
        viewport: "360x740",
      })),
    );

    await page.goto(`${getServerBaseUrl()}#/painel`, {
      waitUntil: "networkidle",
    });
    await page.locator("#import-backup-file").setInputFiles({
      name: "empty-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          schemaVersion: 2,
          requests: buildDemoRequests().slice(0, 1),
        }),
      ),
    });
    await page.locator("#import-dialog").waitFor({ state: "visible" });
    await page.locator("#import-dialog-confirm").waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      document
        .querySelector("#import-dialog")
        .getAnimations()
        .every((animation) => animation.playState === "finished"),
    );
    assert.equal(
      await page.locator("#import-dialog-confirm").isEnabled(),
      true,
    );
    measurements.push(
      ...(
        await measureContrast(page, [
          "#import-dialog-title",
          "#import-dialog-description",
          "#import-preview-summary",
          "#import-dialog-cancel",
          "#import-dialog-confirm",
        ])
      ).map((result) => ({
        ...result,
        context: "diálogo de importação",
        theme,
        viewport: "360x740",
      })),
    );
    assertNoBrowserErrors(assert, diagnostics);
  }

  const failures = measurements.filter(
    ({ minimum, threshold }) => minimum < threshold,
  );
  t.diagnostic(
    `extended text contrast: ${JSON.stringify({ measurements, failures })}`,
  );
  assert.ok(measurements.length > 0, "extended contrast targets were measured");
  assert.deepEqual(
    failures,
    [],
    "dock labels, toasts, or import dialog are below their text contrast thresholds",
  );
});
