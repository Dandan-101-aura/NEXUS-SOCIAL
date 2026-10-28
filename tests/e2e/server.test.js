import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import test from "node:test";
import { getServerBaseUrl } from "./support.js";

const viewsDirectory = join(import.meta.dirname, "../../JavaScript/views");

function requestApplication(path, method = "GET") {
  const baseUrl = getServerBaseUrl();
  assert.ok(baseUrl);
  const { hostname, port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { hostname, method, path, port },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            body,
            headers: response.headers,
            status: response.statusCode,
          });
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

test("serves a newly created module from JavaScript/views", async () => {
  const filename = `server-test-${randomUUID()}.js`;
  const filePath = join(viewsDirectory, filename);
  const contents = "export const servedByTest = true;\n";

  try {
    await writeFile(filePath, contents, { flag: "wx" });
    const response = await requestApplication(`/JavaScript/views/${filename}`);

    assert.equal(response.status, 200);
    assert.equal(response.body, contents);
    assert.match(response.headers["content-type"], /^text\/javascript\b/);
  } finally {
    await rm(filePath, { force: true });
  }
});

test("rejects plain and encoded path traversal", async () => {
  for (const path of [
    "/../package.json",
    "/%2e%2e/package.json",
    "/JavaScript/%2e%2e/package.json",
    "/JavaScript/views/%2e%2e/%2e%2e/package.json",
  ]) {
    const response = await requestApplication(path);
    assert.ok(
      response.status === 403 || response.status === 404,
      `${path} returned ${response.status}`,
    );
  }
});

test("does not expose test, dependency, package, hidden, or report files", async () => {
  for (const path of [
    "/tests/requests.test.js",
    "/node_modules/playwright/package.json",
    "/test-results/",
    "/JavaScript/support.js",
    "/package.json",
    "/package-lock.json",
    "/.gitignore",
    "/.vscode/settings.json",
    "/FASE-8-RELATORIO.md",
  ]) {
    const response = await requestApplication(path);
    assert.ok(
      response.status === 403 || response.status === 404,
      `${path} returned ${response.status}`,
    );
  }
});

test("rejects HTTP methods other than GET and HEAD", async () => {
  const response = await requestApplication("/index.html", "POST");
  const headResponse = await requestApplication("/index.html", "HEAD");

  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, "GET, HEAD");
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.body, "");
});

test("serves supported application and asset MIME types", async () => {
  const assetTypes = [
    [".json", "application/json; charset=utf-8"],
    [".svg", "image/svg+xml"],
    [".webmanifest", "application/manifest+json"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".webp", "image/webp"],
    [".bin", "application/octet-stream"],
  ];
  const temporaryAssets = assetTypes.map(([extension, expectedType]) => {
    const filename = `mime-test-${randomUUID()}${extension}`;
    return {
      expectedType,
      filePath: join(import.meta.dirname, "../../assets", filename),
      urlPath: `/assets/${filename}`,
    };
  });

  try {
    await Promise.all(
      temporaryAssets.map(({ filePath }) =>
        writeFile(filePath, "temporary MIME test file\n", { flag: "wx" }),
      ),
    );
    const responses = await Promise.all(
      [
        ["/index.html", "text/html; charset=utf-8"],
        ["/style.css", "text/css; charset=utf-8"],
        ["/JavaScript/script.js", "text/javascript; charset=utf-8"],
        ...temporaryAssets.map(({ expectedType, urlPath }) => [
          urlPath,
          expectedType,
        ]),
      ].map(async ([path, expectedType]) => ({
        expectedType,
        response: await requestApplication(path),
      })),
    );

    for (const { expectedType, response } of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.headers["content-type"], expectedType);
    }
  } finally {
    await Promise.all(
      temporaryAssets.map(({ filePath }) => rm(filePath, { force: true })),
    );
  }
});
