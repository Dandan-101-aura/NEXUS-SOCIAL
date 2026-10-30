import { createReadStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { after, before } from "node:test";
import { chromium } from "playwright";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const FAILURE_ARTIFACTS = join(PROJECT_ROOT, "test-results");
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/favicon.ico", [null, null]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/editorial.css", ["editorial.css", "text/css; charset=utf-8"]],
  ["/assets/banner-solidariedade.jpg", ["assets/banner-solidariedade.jpg", "image/jpeg"]],
  ["/queries.js", ["queries.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/script.js", ["JavaScript/script.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/storage.js", ["JavaScript/storage.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/requests.js", ["JavaScript/requests.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/dashboard.js", ["JavaScript/dashboard.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/icons.js", ["JavaScript/icons.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/toast.js", ["JavaScript/toast.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/theme.js", ["JavaScript/theme.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/router.js", ["JavaScript/router.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/backup.js", ["JavaScript/backup.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/demo-data.js", ["JavaScript/demo-data.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/categories.js", ["JavaScript/categories.js", "text/javascript; charset=utf-8"]],
  ["/JavaScript/community.js", ["JavaScript/community.js", "text/javascript; charset=utf-8"]],
]);
const SYSTEM_BROWSER_PATHS = [
  process.env.NEXUS_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

let server;
let browser;
let baseUrl;

async function findSystemBrowser() {
  for (const path of SYSTEM_BROWSER_PATHS) {
    try {
      await access(path);
      return path;
    } catch {
      continue;
    }
  }
  return undefined;
}

function listen(serverInstance) {
  return new Promise((resolveListen, reject) => {
    serverInstance.once("error", reject);
    serverInstance.listen(0, "127.0.0.1", () => {
      serverInstance.removeListener("error", reject);
      resolveListen(serverInstance.address());
    });
  });
}

function closeServer(serverInstance) {
  return new Promise((resolveClose, reject) => {
    serverInstance.close((error) => (error ? reject(error) : resolveClose()));
  });
}

before(async () => {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const file = STATIC_FILES.get(pathname);
    if (!file) {
      response.writeHead(404).end("Not found");
      return;
    }

    if (file[0] === null) {
      response.writeHead(204).end();
      return;
    }

    response.setHeader("Content-Type", file[1]);
    createReadStream(join(PROJECT_ROOT, file[0]))
      .on("error", () => response.writeHead(500).end("Unable to serve app file"))
      .pipe(response);
  });
  const address = await listen(server);
  baseUrl = `http://127.0.0.1:${address.port}`;

  const executablePath = await findSystemBrowser();
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
});

after(async () => {
  await browser?.close();
  if (server?.listening) {
    await closeServer(server);
  }
});

export async function openApp(t, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") {
      diagnostics.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  t.after(async () => {
    await context.close();
  });

  return { context, diagnostics, page };
}

export async function runAppTest(t, callback, viewport) {
  const app = await openApp(t, viewport);
  try {
    await app.page.goto(baseUrl, { waitUntil: "networkidle" });
    return await callback(app);
  } catch (error) {
    let screenshotPath = "not captured";
    try {
      await mkdir(FAILURE_ARTIFACTS, { recursive: true });
      const filename = `${Date.now()}-${t.name.replace(/[^a-z0-9-]/gi, "-")}.png`;
      screenshotPath = join(FAILURE_ARTIFACTS, filename);
      await app.page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (screenshotError) {
      screenshotPath = `capture failed: ${screenshotError.message}`;
    }

    t.diagnostic(`Browser diagnostics: ${JSON.stringify(app.diagnostics)}`);
    t.diagnostic(`Failure screenshot: ${screenshotPath}`);
    throw error;
  }
}

export async function getStoredRequests(page) {
  return page.evaluate(() => {
    const envelope = JSON.parse(localStorage.getItem("nexusSocial.requests"));
    return envelope.requests;
  });
}

export async function createRequestThroughForm(page, {
  title,
  description = `Descrição da solicitação ${title}.`,
  category = "Alimentos não perecíveis",
  quantity = "2",
  unit = "unidades",
  region = "Centro",
  urgency = "media",
}) {
  await page.locator('[data-view="new-request"]').click();
  const form = page.locator("#request-form");
  await form.getByLabel("Título da solicitação").fill(title);
  await form.getByLabel("Descrição").fill(description);
  await form.getByLabel("Categoria").selectOption({ label: category });
  await form.getByLabel("Quantidade").fill(quantity);
  await form.getByLabel("Unidade de medida").selectOption(unit);
  await form.getByLabel("Região aproximada").fill(region);
  await form.getByLabel("Urgência declarada").selectOption(urgency);
  await form.getByRole("button", { name: "Salvar solicitação" }).click();
  await page.locator("#toast-region .toast-text", {
    hasText: "Solicitação cadastrada e salva neste navegador.",
  }).last().waitFor();
  const requests = await getStoredRequests(page);
  const request = requests.find((record) => record.title === title);
  if (!request) {
    throw new Error(`Created request "${title}" was not present in isolated storage.`);
  }
  return request;
}

export function assertNoBrowserErrors(assert, diagnostics) {
  assert.deepEqual(diagnostics.consoleErrors, [], "browser console errors");
  assert.deepEqual(diagnostics.pageErrors, [], "uncaught page errors");
  assert.deepEqual(diagnostics.failedRequests, [], "failed network requests");
  assert.deepEqual(diagnostics.httpErrors, [], "HTTP error responses");
}
