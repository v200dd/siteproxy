import assert from "node:assert/strict";
import test from "node:test";
import { rewriteInlineScript } from "../src/rewrite/index.mjs";

const rewriteOptions = {
    proxy_real_host: "github.com",
    proxy_real_protocol: "https",
    proxy_url_prefix: "https://proxy.example/default/",
    token_prefix: "/default/"
};

test("rewriteInlineScript proxies URL attributes", () => {
    const output = rewriteInlineScript({
        ...rewriteOptions,
        body: '<a href="https://example.com/path?q=1">link</a>'
    });
    assert.match(output, /href="https:\/\/proxy\.example\/default\/https\/example\.com\/path\?q=1"/);
});

test("rewriteInlineScript leaves Turbo action flags unchanged", () => {
    const output = rewriteInlineScript({
        ...rewriteOptions,
        body: '<div data-turbo-action="advance"></div>'
    });
    assert.match(output, /data-turbo-action="advance"/);
});
