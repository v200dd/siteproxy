/**
 * Proxy request middleware.
 *
 * Resolves the target URL, builds upstream headers, forwards the request, and
 * hands the upstream Response to the response builder. Token/referer/cookie
 * normalization runs before this module.
 */
import { getConfig, isSpecialSite, isNodeEnvironment } from "../config.mjs";
import { buildProxyResponse } from "./response.mjs";
import {
    parseProtocolHost,
    parseCookieHeader,
    stripProxyCookies,
    rewriteSetCookie,
    buildCookieVariants,
    stripProxyHeaders,
    isMalformedCookie,
    unproxyUrlString
} from "./cookies.mjs";

// Build the proxy-scoped cookie path used by response Set-Cookie and by the
// 431 overflow response, so both paths stay identical.
function cookiePathForTarget(tokenPrefix, protocol, host) {
    let path = tokenPrefix.endsWith("/") ? tokenPrefix : tokenPrefix + "/";
    path += protocol + "/" + host + "/";
    return path.startsWith("/") ? path : "/" + path;
}

var proxyRequestMiddleware = async (context, next, options = {}) => {
    let configProvider = options.getConfig || getConfig;
    let specialSiteFilter = options.need2beFiltered || isSpecialSite;
    let protocolHostParser = options.pathname2protocol_host || parseProtocolHost;
    let responseBuilder = options.responseModification || buildProxyResponse;
    let fetchImpl = options.fetch || fetch;
    let config = configProvider();
    let { req: req } = context;
    let tokenPrefix = config.token_prefix;
    let proxyPrefix = config.proxy_url + tokenPrefix;
    let proxyHost = config.proxy_url.substring(config.proxy_url.indexOf("//") + 2);
    if (proxyHost.indexOf(":") !== -1) {
        proxyHost = proxyHost.substring(0, proxyHost.indexOf(":"));
    }
    if (specialSiteFilter(req.extractedUrl)) {
        return next();
    }
    // Resolve the upstream target. The token path is authoritative; Referer and
    // proxy cookies are only compatibility fallbacks for older pages.
    let requestUrl = new URL(req.extractedUrl);
    if (!requestUrl.pathname.startsWith(tokenPrefix)) {
        let referer = context.req.header("referer");
        if (referer && referer.startsWith(proxyPrefix)) {
            let refererParts = referer.substring(proxyPrefix.length).split("/");
            if (refererParts.length >= 2) {
                let refererProtocol = refererParts[0];
                let refererHost = refererParts[1];
                if (refererProtocol === "http" || refererProtocol === "https") {
                    requestUrl.pathname = tokenPrefix + refererProtocol + "/" + refererHost + requestUrl.pathname;
                    req.extractedUrl = requestUrl.toString();
                }
            }
        }
    }
    if (!requestUrl.pathname.startsWith(tokenPrefix)) {
        let cookieValues = parseCookieHeader(req.raw.headers.cookie || "");
        let cookieProtocol = cookieValues.proxy_real_protocol;
        let cookieHost = cookieValues.proxy_real_host;
        if (cookieProtocol && cookieHost && (cookieProtocol === "http" || cookieProtocol === "https")) {
            requestUrl.pathname = tokenPrefix + cookieProtocol + "/" + cookieHost + requestUrl.pathname;
            req.extractedUrl = requestUrl.toString();
        }
    }
    if (!requestUrl.pathname.startsWith(tokenPrefix)) {
        return next();
    }
    let pathAfterPrefix = requestUrl.pathname.substring(tokenPrefix.length);
    let { protocol: targetProtocol, host: targetHost } = protocolHostParser(pathAfterPrefix);
    let fallbackCookieValues = parseCookieHeader(req.raw.headers.cookie || "");
    if (!targetProtocol || !targetHost) {
        targetProtocol = fallbackCookieValues.proxy_real_protocol;
        targetHost = fallbackCookieValues.proxy_real_host;
    }
    if (targetProtocol !== "http" && targetProtocol !== "https") {
        return next();
    }
    let targetOrigin = targetProtocol + "://" + targetHost;
    req.proxy_real_host = targetHost;
    req.proxy_real_protocol = targetProtocol;
    let rewritePath = (pathParam) => {
        let unproxiedPath = pathParam.replace(new RegExp("^" + tokenPrefix + targetProtocol + "/[^/]+"), "");
        unproxiedPath = unproxyUrlString(unproxiedPath, config);
        if (unproxiedPath === "") {
            return "/";
        } else {
            return unproxiedPath;
        }
    };
    // Forward CORS preflight directly; no body rewriting is needed.
    if (context.req.method === "OPTIONS") {
        let optionsUrl = targetOrigin + rewritePath(requestUrl.pathname) + requestUrl.search;
        let optionsHeaders = new Headers(context.req.raw.headers);
        stripProxyHeaders(optionsHeaders);
        optionsHeaders.set("host", targetHost);
        let optionsResponse = await fetchImpl(optionsUrl, {
            method: "OPTIONS",
            headers: optionsHeaders,
            redirect: "manual"
        });
        context.res = optionsResponse;
        return;
    }
    req.proxy_real_host = targetHost;
    // Build the upstream request headers. Internal cookies and proxy-identifying
    // headers are removed; cookies over the limit are expired client-side.
    let buildForwardHeaders = async (requestHeaders, protocolParam, hostParam) => {
        let activeConfig = configProvider();
        let proxyBase = activeConfig.proxy_url + activeConfig.token_prefix;
        let headerObject = {};
        requestHeaders.forEach((headerValue, headerName) => {
            headerObject[headerName] = headerValue;
        });
        let cookieHeader = "";
        let cookieName = null;
        for (let cookieHeaderKey in headerObject) {
            if (cookieHeaderKey.toLowerCase() === "cookie") {
                cookieHeader = headerObject[cookieHeaderKey];
                cookieName = cookieHeaderKey;
                break;
            }
        }
        if (cookieHeader) {
            let strippedCookie = stripProxyCookies(cookieHeader);
            if (strippedCookie) {
                headerObject[cookieName] = strippedCookie;
            } else {
                delete headerObject[cookieName];
            }
            cookieHeader = strippedCookie;
        }
        if (cookieHeader) {
            let cookieLength = isNodeEnvironment()
                ? Buffer.byteLength(cookieHeader)
                : new TextEncoder().encode(cookieHeader).byteLength;
            console.log("cookieHeader length:" + cookieLength);
            if (cookieLength > 4000) {
                let expireCookies = cookieHeader
                    .split(";")
                    .map((part) => part.trim().split("=", 2))
                    .map(([cookieKey]) =>
                        cookieKey.startsWith("proxy_real_")
                            ? null
                            : cookieKey + "=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/"
                    )
                    .filter(Boolean);
                let cookieLimit = Math.max(1, Math.floor(2));
                throw {
                    type: "header_too_large",
                    expireCookies: expireCookies.slice(0, cookieLimit)
                };
            }
        }
        if (headerObject["siteproxy-newreferer"]) {
            headerObject.referer = headerObject["siteproxy-newreferer"];
            let refererUrl = new URL(headerObject["siteproxy-newreferer"]);
            headerObject.origin = refererUrl.origin;
        } else if (headerObject.referer && headerObject.referer.startsWith(proxyBase)) {
            headerObject.referer = headerObject.referer.substring(proxyBase.length);
            if (headerObject.referer.startsWith("/")) {
                headerObject.referer = headerObject.referer.substring(1);
            }
            if (headerObject.referer.startsWith("https/")) {
                headerObject.referer = "https://" + headerObject.referer.substring(6);
            } else if (headerObject.referer.startsWith("http/")) {
                headerObject.referer = "http://" + headerObject.referer.substring(5);
            }
            headerObject.origin = protocolParam + "://" + hostParam;
        } else if (headerObject.origin === activeConfig.proxy_url) {
            headerObject.origin = protocolParam + "://" + hostParam;
        }
        return headerObject;
    };
    // Filter upstream response headers and scope Set-Cookie to the proxy path.
    let processResponseHeaders = async (responseHeaders, overflowHeaderTarget) => {
        let resultHeaders = new Headers();
        let setCookieValues = [];
        let maxHeaderLength = 4096;
        let reportOnlyHeaders = new Set([
            "report-to",
            "nel",
            "reporting-endpoints",
            "cross-origin-embedder-policy-report-only",
            "cross-origin-opener-policy-report-only",
            "permissions-policy-report-only",
            "content-security-policy-report-only"
        ]);
        let hasTransferEncoding = responseHeaders.has("transfer-encoding");
        responseHeaders.forEach((responseHeaderValue, responseHeaderName) => {
            let lowerName = responseHeaderName.toLowerCase();
            if (lowerName !== "set-cookie") {
                if (reportOnlyHeaders.has(lowerName) || (lowerName === "content-length" && hasTransferEncoding)) {
                    return;
                }
                if (responseHeaderValue && responseHeaderValue.length > maxHeaderLength) {
                    if ((responseHeaders.get("content-type") || "").toLowerCase().includes("text/event-stream")) {
                        console.log(
                            "Dropping oversized response header (streaming response):",
                            responseHeaderName,
                            "size=",
                            responseHeaderValue.length
                        );
                        return;
                    }
                    if (!overflowHeaderTarget) {
                        console.log(
                            "Dropping oversized response header (no service worker to unwrap it):",
                            responseHeaderName,
                            "size=",
                            responseHeaderValue.length
                        );
                        return;
                    }
                    overflowHeaderTarget[responseHeaderName] = responseHeaderValue;
                    console.log(
                        "Smuggling oversized response header via body:",
                        responseHeaderName,
                        "size=",
                        responseHeaderValue.length
                    );
                    return;
                }
                resultHeaders.set(responseHeaderName, responseHeaderValue);
            } else {
                setCookieValues.push(responseHeaderValue);
            }
        });
        let cookiePath = cookiePathForTarget(tokenPrefix, targetProtocol, targetHost);
        setCookieValues.forEach((setCookie) => {
            setCookie.split(/,(?!(?:\s+[0-9]{2}))/).forEach((cookie) => {
                if (isMalformedCookie(cookie)) {
                    return;
                }
                let rewrittenCookie = rewriteSetCookie(cookie, proxyHost, cookiePath);
                resultHeaders.append("Set-Cookie", rewrittenCookie);
            });
        });
        return resultHeaders;
    };
    // The final upstream URL. Only http/https is allowed by the checks above.
    let targetUrl = targetOrigin + rewritePath(requestUrl.pathname) + requestUrl.search;
    let forwardHeaders;
    try {
        forwardHeaders = await buildForwardHeaders(context.req.raw.headers, targetProtocol, targetHost);
    } catch (headerError) {
        console.error("Error in proxyHeaderProcess:", headerError);
        if (headerError.type === "header_too_large") {
            let errorHeaders = new Headers();
            let cookiePath = cookiePathForTarget(tokenPrefix, targetProtocol, targetHost);
            headerError.expireCookies.forEach((expireCookie) => {
                let cookieVariants = buildCookieVariants(expireCookie, proxyHost, cookiePath);
                for (let cookieVariant of cookieVariants) {
                    errorHeaders.append("Set-Cookie", cookieVariant);
                }
            });
            context.res = new Response("Request Header Fields Too Large", {
                status: 431,
                headers: errorHeaders
            });
            return;
        }
        context.res = new Response("Internal Server Error: Header processing failed", {
            status: 500
        });
        return;
    }
    let headerEntries = forwardHeaders;
    forwardHeaders = new Headers();
    for (let forwardHeaderName in headerEntries) {
        if (headerEntries.hasOwnProperty(forwardHeaderName)) {
            forwardHeaders.append(forwardHeaderName, headerEntries[forwardHeaderName]);
        }
    }
    let body = context.req.method !== "GET" ? await context.req.arrayBuffer() : undefined;
    if (body && body.byteLength === 0) {
        body = undefined;
    }
    stripProxyHeaders(forwardHeaders);
    forwardHeaders.set("host", targetHost);
    forwardHeaders.set("Accept-Encoding", "gzip");
    let proxyResponse;
    try {
        console.log("Fetching real website:", targetUrl);
        proxyResponse = await fetchImpl(targetUrl, {
            method: context.req.method,
            headers: forwardHeaders,
            body: body,
            redirect: "manual",
            decompress: false
        });
    } catch (fetchError) {
        console.error(
            "Fetch error occurred:",
            fetchError.message,
            "Proxy URL:",
            targetUrl,
            "Method:",
            context.req.method
        );
        context.res = new Response("Proxy fetch error", {
            status: 502
        });
        return;
    }
    // The service worker opts into the body-header envelope only when present.
    let oversizedHeaders = context.req.raw.headers.get("siteproxy-sw") === "1" ? {} : null;
    let newResHeaders = await processResponseHeaders(proxyResponse.headers, oversizedHeaders);
    context.res = await responseBuilder({
        proxyResponse: proxyResponse,
        newResHeaders: newResHeaders,
        req: req,
        oversizedHeaders
    });
};

export { proxyRequestMiddleware };
