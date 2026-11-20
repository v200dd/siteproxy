import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
const { honoApp } = await import("../bundle.mjs");

test("health endpoint is not exposed", async () => {
    const response = await honoApp.fetch(new Request("http://localhost/healthz"));
    assert.notEqual(response.status, 200);
});

test("token homepage and client script are served", async () => {
    const home = await honoApp.fetch(new Request("http://localhost/default/"));
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/);

    const client = await honoApp.fetch(new Request("http://localhost/siteproxy-response-injected.js"));
    assert.equal(client.status, 200);
    assert.equal(client.headers.get("content-type"), "application/javascript");
});
