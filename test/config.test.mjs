import assert from "node:assert/strict";
import test from "node:test";
import { applyWorkerEnv, DEFAULT_TOKEN_PREFIX, normalizeConfig } from "../src/config.mjs";

test("normalizeConfig treats missing and root tokens as unconfigured", () => {
    for (const token_prefix of [undefined, null, "", "/", "//"]) {
        const config = normalizeConfig({ token_prefix });
        assert.equal(config.token_prefix, DEFAULT_TOKEN_PREFIX);
        assert.equal(config.token_configured, false);
        assert.equal(config.default_password, true);
    }
});

test("normalizeConfig keeps explicit tokens configured", () => {
    const config = normalizeConfig({ token_prefix: "/secret/" });
    assert.equal(config.token_prefix, "/secret/");
    assert.equal(config.token_configured, true);
    assert.equal(config.default_password, false);
});

test("applyWorkerEnv always derives the proxy origin from the request", () => {
    applyWorkerEnv({}, "https://proxy.example.com/default/");
    assert.equal(globalThis.proxy_url, "https://proxy.example.com");
    assert.equal(globalThis.token_prefix, undefined);

    applyWorkerEnv(
        {
            proxy_url: "https://ignored.example.com/",
            token_prefix: "/secret/"
        },
        "https://custom.example.com/"
    );
    assert.equal(globalThis.proxy_url, "https://custom.example.com");
    assert.equal(globalThis.token_prefix, "/secret/");
});
