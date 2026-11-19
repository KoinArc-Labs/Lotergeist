import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp, Db, loadConfig, SandboxNotifier, seedDatabase, type Ctx } from "../src/index";

// REV-API: the built web app is served from disk per request, so rebuilding it while the API runs needs no restart.

describe("REV-API static web app after a rebuild", () => {
  it("serves assets built after start, 404s a missing asset, and falls back to index.html for app routes", async () => {
    process.env.OFFLINE = "1";
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "rv-dist-"));
    fs.mkdirSync(path.join(dist, "assets"));
    fs.writeFileSync(path.join(dist, "index.html"), '<script type="module" src="/assets/index-old.js"></script>');
    fs.writeFileSync(path.join(dist, "assets", "index-old.js"), "console.log('old')");
    const cfg = loadConfig({}, { sqlitePath: ":memory:", nightWatch: false, assetsDir: "/nonexistent", webDist: dist });
    const db = new Db(":memory:");
    const ctx: Ctx = { cfg, db, notify: new SandboxNotifier(db, cfg), now: () => Date.parse("2026-11-18T18:00:00Z") };
    seedDatabase(db, cfg, ctx.now());
    const app = await buildApp(ctx);

    expect((await app.inject({ url: "/assets/index-old.js" })).statusCode).toBe(200);
    // rebuild: new hash, old asset gone, index.html points at the new one
    fs.rmSync(path.join(dist, "assets", "index-old.js"));
    fs.writeFileSync(path.join(dist, "assets", "index-new.js"), "console.log('new')");
    fs.writeFileSync(path.join(dist, "index.html"), '<script type="module" src="/assets/index-new.js"></script>');

    const fresh = await app.inject({ url: "/assets/index-new.js" });
    expect(fresh.statusCode).toBe(200);
    expect(fresh.headers["content-type"]).toMatch(/javascript/);
    expect(fresh.body).toContain("new");
    const old = await app.inject({ url: "/assets/index-old.js" });
    expect(old.statusCode).toBe(404);
    expect(old.headers["content-type"]).not.toMatch(/html/);
    const route = await app.inject({ url: "/recalls" });
    expect(route.statusCode).toBe(200);
    expect(route.body).toContain("index-new.js");
    expect((await app.inject({ url: "/" })).body).toContain("index-new.js");
    expect((await app.inject({ url: "/api/nope" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/auth/login", payload: { storeId: "store-7", email: "x@y.example", password: "z" } })).statusCode).toBe(401);
  });
});
