import assert from "node:assert/strict";
import test from "node:test";
import { parseProtocolHost } from "../src/proxy/cookies.mjs";

test("parseProtocolHost accepts the canonical segment format", () => {
    assert.deepEqual(parseProtocolHost("https/example.com/path"), {
        protocol: "https",
        host: "example.com"
    });
    assert.deepEqual(parseProtocolHost("http/127.0.0.1:8080/path"), {
        protocol: "http",
        host: "127.0.0.1:8080"
    });
});

test("parseProtocolHost rejects malformed protocol separators", () => {
    assert.deepEqual(parseProtocolHost("https://example.com/path"), {
        protocol: undefined,
        host: undefined
    });
    assert.deepEqual(parseProtocolHost("https:/example.com/path"), {
        protocol: undefined,
        host: undefined
    });
});
