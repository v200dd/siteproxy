/*
 * Deobfuscated from siteproxy 2.7.11 (bundle.mjs).
 * Generated with Node 22.14.0 + webcrack 2.15.1 plus a local string-array prepass.
 * This is a reverse-engineered equivalent, not the original source.
 * See README.md in this directory for scope and limitations.
 */
var hostMap = {};
function stripProxyPrefix(url) {
    if (!url.startsWith(proxy_url_prefix)) {
        return null;
    }
    const path = url.substring(proxy_url_prefix.length);
    const parts = path.split("/");
    if (parts.length >= 2) {
        const protocol = parts[0];
        const host = parts[1];
        return {
            protocol: protocol,
            host: host
        };
    }
    return null;
}
function cleanHostMap() {
    const now = Date.now();
    for (let key in hostMap) {
        if (now > hostMap[key].lasttime + 30000) {
            delete hostMap[key];
        }
    }
}
setInterval(cleanHostMap, 2000);
let decodeProxiedUrl = (input) => {
    input = input.replace(new RegExp(proxy_url_prefix + "(http[s]?)/([^/]+)", "g"), "$1://$2");
    input = input.replace(/___location/g, "location");
    input = input.replace(/___URL/g, "URL");
    input = input.replace(/___domain/g, "domain");
    input = input.replace(/___pushState/g, "pushState");
    input = input.replace(/___replaceState/g, "replaceState");
    input = input.replace(/navigator.___serviceWorker/g, "navigator.serviceWorker");
    input = input.replace(/document.___requestStorageAccessFor/g, "document.requestStorageAccessFor");
    return input;
};
self.addEventListener("message", (event) => {
    if (event.data.type === "PROXY_CUR_LOCATION") {
        if (
            event.data.data.protocol !== "undefined" &&
            event.data.data.host !== "undefined" &&
            (event.data.data.protocol !== self.proxy_target_protocol || event.data.data.host !== self.proxy_target_host)
        ) {
            self.proxy_target_protocol = event.data.data.protocol;
            self.proxy_target_host = event.data.data.host;
        }
    } else if (event.data.type === "PROXY_URL_HOST_MAP") {
        hostMap[event.data.data.pathname] = {
            real_protocol: event.data.data.real_protocol,
            real_host: event.data.data.real_host,
            lasttime: Date.now()
        };
    }
});
self.addEventListener("install", (event) => {
    self.skipWaiting();
});
self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});
const SITEPROXY_HEADER = new Uint8Array([0, 0, 83, 73, 84, 69, 80, 82, 79, 88, 89, 72, 68, 82, 0]);
function hasSiteProxyHeader(payload) {
    if (payload.byteLength < SITEPROXY_HEADER.length) {
        return false;
    }
    for (let index = 0; index < SITEPROXY_HEADER.length; index++) {
        if (payload[index] !== SITEPROXY_HEADER[index]) {
            return false;
        }
    }
    return true;
}
async function decodeOversizedHeaders(response) {
    if (response.headers.get("x-siteproxy-body-headers") !== "1") {
        return response;
    }
    let buffer;
    try {
        buffer = await response.arrayBuffer();
    } catch (error) {
        return response;
    }
    const bytes = new Uint8Array(buffer);
    if (!hasSiteProxyHeader(bytes)) {
        return new Response(buffer, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }
    const offset = SITEPROXY_HEADER.length;
    if (bytes.byteLength < offset + 4) {
        return response;
    }
    const headerLength =
        (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (headerLength < 0 || headerLength > bytes.byteLength - offset - 4) {
        return response;
    }
    const bodyStart = offset + 4;
    const bodyEnd = bodyStart + headerLength;
    let headerJson;
    try {
        headerJson = JSON.parse(new TextDecoder("utf-8").decode(bytes.subarray(bodyStart, bodyEnd)));
    } catch (parseError) {
        return response;
    }
    const body = bytes.subarray(bodyEnd);
    const headers = new Headers();
    response.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();
        if (lowerName === "x-siteproxy-body-headers") {
            return;
        }
        if (lowerName === "content-length") {
            return;
        }
        if (lowerName === "content-encoding") {
            return;
        }
        headers.append(name, value);
    });
    for (const headerPairs in headerJson) {
        headers.set(headerPairs, headerJson[headerPairs]);
    }
    headers.set("content-length", String(body.byteLength));
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
    });
}
async function stripCspFromHtml(response) {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const headers = new Headers(response.headers);
    const hasCsp =
        headers.has("content-security-policy") || headers.has("content-security-policy-report-only");
    if (!hasCsp || contentType.indexOf("text/html") === -1) {
        return response;
    }
    const body = await response.arrayBuffer();
    headers.delete("content-security-policy");
    headers.delete("content-security-policy-report-only");
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    headers.set("content-length", String(body.byteLength));
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
    });
}

self.addEventListener("fetch", (event) => {
    event.respondWith(
        (async () => {
            const requestUrl = new URL(event.request.url);
            if (requestUrl.hostname === "static.cloudflareinsights.com") {
                return new Response("", {
                    status: 200,
                    headers: {
                        "content-type": "text/javascript"
                    }
                });
            }
            let targetProtocol = self.proxy_target_protocol || proxy_real_protocol;
            let targetHost = self.proxy_target_host || proxy_real_host;
            let hostMatch = null;
            if (event.clientId) {
                hostMatch = await self.clients.get(event.clientId);
            }
            if (hostMatch && hostMatch.url && hostMatch.url.startsWith(proxy_url_prefix)) {
                const mappedUrl = stripProxyPrefix(hostMatch.url);
                if (mappedUrl) {
                    targetProtocol = mappedUrl.protocol;
                    targetHost = mappedUrl.host;
                }
            } else {
                const referer = event.request.headers.get("referer");
                if (referer) {
                    const unproxiedReferer = stripProxyPrefix(referer);
                    if (unproxiedReferer) {
                        targetProtocol = unproxiedReferer.protocol;
                        targetHost = unproxiedReferer.host;
                    }
                }
            }
            let targetOrigin = targetProtocol + "://" + targetHost;
            let targetUrl = event.request.url;
            let headers = new Headers(event.request.headers);
            headers.set("siteproxy-newreferer", targetOrigin);
            headers.set("siteproxy-sw", "1");
            let decodedSearch = decodeProxiedUrl(requestUrl.search);
            const serviceWorkerPrefix = config_token_prefix.endsWith("/")
                ? config_token_prefix
                : config_token_prefix + "/";
            const serviceWorkerPath = serviceWorkerPrefix + "siteproxy_service_worker.js";
            const isInternalRequest =
                config_proxy_url.endsWith(requestUrl.host) &&
                (requestUrl.pathname === "/siteproxy-response-injected.js" ||
                    requestUrl.pathname === serviceWorkerPath);
            if (targetProtocol != "undefined" && !isInternalRequest) {
                if (!requestUrl.pathname.startsWith(config_token_prefix)) {
                    if (targetHost !== requestUrl.host && !config_proxy_url.endsWith(requestUrl.host)) {
                        targetHost = requestUrl.host;
                    } else if (
                        headers.get("siteproxy-target-host") &&
                        config_proxy_url.endsWith(requestUrl.host) &&
                        !requestUrl.pathname.includes(config_token_prefix)
                    ) {
                        targetProtocol = headers.get("siteproxy-target-protocol");
                        targetHost = headers.get("siteproxy-target-host");
                        targetOrigin = headers.get("siteproxy-real-referer");
                        headers.set("siteproxy-newreferer", targetOrigin);
                    }
                    if (!config_proxy_url.endsWith(targetHost)) {
                        targetUrl =
                            proxy_url_prefix + targetProtocol + "/" + targetHost + requestUrl.pathname + decodedSearch;
                    }
                }
            }
            const requestInit = {
                method: event.request.method,
                headers: headers,
                mode: "cors",
                credentials: "include",
                redirect: event.request.redirect
            };
            if (["POST", "PUT", "PATCH"].includes(event.request.method.toUpperCase())) {
                const clonedRequest = event.request.clone();
                const contentType = clonedRequest.headers.get("Content-Type");
                const contentEncoding = clonedRequest.headers.get("Content-Encoding");
                if (
                    !contentEncoding &&
                    contentType &&
                    (contentType.includes("json") || contentType.includes("text") || contentType.includes("form"))
                ) {
                    let bodyText = await clonedRequest.text();
                    bodyText = decodeProxiedUrl(bodyText);
                    requestInit.body = bodyText;
                } else {
                    let bodyBuffer = await clonedRequest.arrayBuffer();
                    requestInit.body = bodyBuffer;
                }
                const requestWithBody = new Request(targetUrl, requestInit);
                return fetch(requestWithBody).then(decodeOversizedHeaders).then(stripCspFromHtml);
            } else {
                const requestNoBody = new Request(targetUrl, requestInit);
                return fetch(requestNoBody).then((proxiedResponse) => {
                    if (proxiedResponse.status === 404) {
                        return new Promise((resolveDelayedResponse) =>
                            setTimeout(() => resolveDelayedResponse(proxiedResponse), 3000)
                        )
                            .then(decodeOversizedHeaders)
                            .then(stripCspFromHtml);
                    }
                    return decodeOversizedHeaders(proxiedResponse).then(stripCspFromHtml);
                });
            }
        })()
    );
});
