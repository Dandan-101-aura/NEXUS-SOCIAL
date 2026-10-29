import { createReadStream } from "node:fs";
import { access, mkdir, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { after, before } from "node:test";
import { chromium } from "playwright";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const FAILURE_ARTIFACTS = join(PROJECT_ROOT, "test-results");
const APPLICATION_ROOTS = new Set(["JavaScript", "assets"]);
const APPLICATION_FILES = new Set(["index.html", "style.css", "editorial.css"]);
const BLOCKED_SEGMENTS = new Set(["tests", "node_modules", "test-results"]);
const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
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

function isWithinDirectory(directory, filePath) {
  const pathFromDirectory = relative(directory, filePath);
  return (
    pathFromDirectory === "" ||
    (pathFromDirectory !== ".." &&
      !pathFromDirectory.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromDirectory))
  );
}

function resolveApplicationPath(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname).replace(/\\/g, "/");
  } catch {
    return null;
  }

  if (decodedPath === "/") {
    decodedPath = "/index.html";
  }
  if (!decodedPath.startsWith("/")) {
    return null;
  }

  const segments = decodedPath.slice(1).split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.startsWith(".") ||
        BLOCKED_SEGMENTS.has(segment.toLowerCase()),
    )
  ) {
    return null;
  }
  let allowedRoot;
  let filePath;
  if (segments.length === 1 && APPLICATION_FILES.has(segments[0])) {
    allowedRoot = PROJECT_ROOT;
    filePath = resolve(PROJECT_ROOT, segments[0]);
  } else if (APPLICATION_ROOTS.has(segments[0]) && segments.length > 1) {
    allowedRoot = resolve(PROJECT_ROOT, segments[0]);
    filePath = resolve(allowedRoot, ...segments.slice(1));
  } else {
    return null;
  }

  if (!isWithinDirectory(allowedRoot, filePath)) {
    return null;
  }
  return { allowedRoot, filePath };
}

async function serveApplicationFile(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url, "http://127.0.0.1").pathname;
  } catch {
    response.writeHead(404).end("Not found");
    return;
  }

  if (pathname === "/favicon.ico") {
    response.writeHead(204).end();
    return;
  }

  const resolvedPath = resolveApplicationPath(pathname);
  if (!resolvedPath) {
    response.writeHead(404).end("Not found");
    return;
  }

  try {
    const [realRoot, realFile] = await Promise.all([
      realpath(resolvedPath.allowedRoot),
      realpath(resolvedPath.filePath),
    ]);
    if (!isWithinDirectory(realRoot, realFile)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const fileStat = await stat(realFile);
    if (!fileStat.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    const contentType =
      CONTENT_TYPES.get(extname(realFile).toLowerCase()) ??
      "application/octet-stream";
    response.writeHead(200, {
      "Content-Length": fileStat.size,
      "Content-Type": contentType,
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(realFile)
      .on("error", (error) => {
        console.error("Unable to stream application file:", error);
        if (!response.headersSent) {
          response.writeHead(500).end("Unable to serve app file");
        } else {
          response.destroy(error);
        }
      })
      .pipe(response);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      response.writeHead(404).end("Not found");
      return;
    }
    console.error("Unable to resolve application file:", error);
    response.writeHead(500).end("Unable to serve app file");
  }
}

before(async () => {
  server = createServer((request, response) =>
    serveApplicationFile(request, response),
  );
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

export function getServerBaseUrl() {
  return baseUrl;
}

export async function openApp(t, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
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
    diagnostics.failedRequests.push(
      `${request.url()}: ${request.failure()?.errorText}`,
    );
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

export async function createRequestThroughForm(
  page,
  {
    title,
    description = `Descrição da solicitação ${title}.`,
    category = "Alimentos não perecíveis",
    quantity = "2",
    unit = "unidades",
    region = "Centro",
    urgency = "media",
  },
) {
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
  await page
    .locator("#toast-region .toast-text", {
      hasText: "Solicitação cadastrada e salva neste navegador.",
    })
    .last()
    .waitFor();
  const requests = await getStoredRequests(page);
  const request = requests.find((record) => record.title === title);
  if (!request) {
    throw new Error(
      `Created request "${title}" was not present in isolated storage.`,
    );
  }
  return request;
}

export function assertNoBrowserErrors(assert, diagnostics) {
  assert.deepEqual(diagnostics.consoleErrors, [], "browser console errors");
  assert.deepEqual(diagnostics.pageErrors, [], "uncaught page errors");
  assert.deepEqual(diagnostics.failedRequests, [], "failed network requests");
  assert.deepEqual(diagnostics.httpErrors, [], "HTTP error responses");
}
