/**
 * Cookie and request/response header helpers.
 *
 * Parses the proxy target cookies, strips internal cookies before forwarding,
 * scopes upstream Set-Cookie values to the proxy path, and drops hop-by-hop or
 * proxy-identifying request headers.
 */

// Parse the first two path segments of `http/host/...`.
function parseProtocolHost(path) {
    let pattern = /^([^:/?#]+)\/([^/?#]+)/;
    let match = path.match(pattern);
    let protocol;
    let host;
    if (match) {
        protocol = match[1];
        host = match[2];
    }
    return {
        protocol: protocol,
        host: host
    };
}
function isMalformedCookie(cookie) {
    let semicolonIndex = cookie.indexOf(";");
    return semicolonIndex !== -1 && cookie.substring(0, semicolonIndex).indexOf("=") === -1;
}
// Parse a Cookie header into a plain name -> value object.
function parseCookieHeader(cookieHeader) {
    let cookies = {};
    if (cookieHeader) {
        cookieHeader.split(";").forEach((part) => {
            let [name, value] = part.trim().split("=");
            if (name && value) {
                cookies[name] = value;
            }
        });
    }
    return cookies;
}
// Remove internal proxy cookies before forwarding a request upstream.
function stripProxyCookies(cookieHeader) {
    if (!cookieHeader) {
        return "";
    }
    let parts = cookieHeader.split(";");
    let kept = [];
    for (let part of parts) {
        let trimmed = part.trim();
        if (!trimmed) {
            continue;
        }
        let equalsIndex = trimmed.indexOf("=");
        if (equalsIndex === -1) {
            kept.push(trimmed);
            continue;
        }
        if (!trimmed.substring(0, equalsIndex).trim().startsWith("proxy_real_")) {
            kept.push(trimmed);
        }
    }
    return kept.join("; ");
}
// Build deletion variants for the same cookie at different Domain/Path scopes.
function buildCookieVariants(cookie, domain, path = "/") {
    cookie = cookie.replace(/;?\s*Secure;?/gi, "");
    cookie = cookie.replace(/;?\s*HttpOnly;?/gi, "");
    let baseCookie = cookie.replace(/;?\s*Domain\s*=[^;]*/gi, "");
    baseCookie = baseCookie.replace(/;?\s*Path\s*=[^;]*/gi, "");
    baseCookie = baseCookie.replace(/; ;/g, ";").replace(/;;/g, ";").trim();
    baseCookie = baseCookie.replace(/^;|;$/g, "");
    let pathOnly = baseCookie + ("; Path=" + path);
    let domainPath = baseCookie + "; Domain=" + domain + "; Path=" + path;
    let dotDomainPath = baseCookie + "; Domain=." + domain + "; Path=" + path;
    let rootPath = baseCookie + "; Path=/";
    let domainRoot = baseCookie + "; Domain=" + domain + "; Path=/";
    let dotDomainRoot = baseCookie + "; Domain=." + domain + "; Path=/";
    return [pathOnly, domainPath, dotDomainPath, rootPath, domainRoot, dotDomainRoot];
}
function isExpiredDate(date) {
    return new Date(date) < new Date();
}
// Scope an upstream Set-Cookie to the proxy domain and target path.
function rewriteSetCookie(setCookie, domain, proxyTokenPrefix = "/") {
    let nameMatch = setCookie.match(/^([^=]+)=/);
    let cookieName = nameMatch ? nameMatch[1] : "";
    let isProxyCookie = cookieName === "proxy_real_host" || cookieName === "proxy_real_protocol";
    let hasExpires = /Expires\s*=/i.test(setCookie);
    let hasMaxAge = /Max-Age\s*=/i.test(setCookie);
    let rewritten = setCookie.replace(/Domain\s*=\s*[^;]*?(;|$)/gi, "Domain=" + domain + ";");
    let pathMatch = setCookie.match(/Path\s*=\s*([^;]*)(;|$)/i);
    let cookiePath = pathMatch ? pathMatch[1].trim() : "/";
    if (!cookiePath.startsWith("/")) {
        cookiePath = "/" + cookiePath;
    }
    let newPath;
    if (isProxyCookie) {
        newPath = "/";
    } else if (cookiePath === "/") {
        newPath = proxyTokenPrefix;
    } else {
        let basePath = proxyTokenPrefix.endsWith("/") ? proxyTokenPrefix.slice(0, -1) : proxyTokenPrefix;
        let isSameBasePath =
            cookiePath.startsWith(basePath) &&
            (cookiePath.length === basePath.length || cookiePath[basePath.length] === "/");
        if (isSameBasePath) {
            newPath = cookiePath;
        } else {
            newPath = proxyTokenPrefix.slice(0, -1) + cookiePath;
        }
    }
    if (/Path\s*=/i.test(rewritten)) {
        rewritten = rewritten.replace(/Path\s*=\s*([^;]*)(;|$)/gi, "Path=" + newPath + ";");
    } else {
        rewritten += "; Path=" + newPath + ";";
    }
    if (!/Domain\s*=/i.test(rewritten)) {
        rewritten += "; Domain=" + domain + ";";
    }
    rewritten = rewritten.replace(/Max-Age\s*=\s*[^;]*?(;|$)/gi, "");
    let expiresMatch = rewritten.match(/Expires\s*=\s*([^;]*?)(;|$)/i);
    if (expiresMatch) {
        let expiresValue = expiresMatch[1];
        if (!isExpiredDate(expiresValue)) {
            rewritten = rewritten.replace(/Expires\s*=\s*[^;]*?(;|$)/gi, "");
            rewritten += "; Max-Age=1800";
        }
    } else if (!hasExpires && !hasMaxAge) {
        rewritten += "; Max-Age=1800";
    }
    rewritten = rewritten.replace(/; ;|;;/g, ";");
    return rewritten;
}
function unproxyUrlString(url, config) {
    let tokenPrefix = config.token_prefix;
    let httpsPrefix = config.proxy_url + tokenPrefix + "https/";
    let httpPrefix = config.proxy_url + tokenPrefix + "http/";
    let result = url;
    let httpsIndex = url.indexOf(httpsPrefix);
    if (httpsIndex !== -1) {
        let httpsStart = httpsIndex + httpsPrefix.length;
        let httpsRest = url.substring(httpsStart);
        result = url.substring(0, httpsIndex) + "https://" + httpsRest;
    }
    let httpIndex = url.indexOf(httpPrefix);
    if (httpIndex !== -1 && httpsIndex === -1) {
        let httpStart = httpIndex + httpPrefix.length;
        let httpRest = url.substring(httpStart);
        result = url.substring(0, httpIndex) + "http://" + httpRest;
    }
    return result;
}
var strippedHeaderNames = new Set([
    "cdn-loop",
    "forwarded",
    "via",
    "x-real-ip",
    "true-client-ip",
    "x-client-ip",
    "x-cluster-client-ip",
    "fastly-client-ip",
    "fly-client-ip"
]);
function stripProxyHeaders(headers) {
    if (!headers) {
        return;
    }
    let namesToDelete = [];
    headers.forEach((_value, name) => {
        let lowerName = name.toLowerCase();
        let isProxyHeader =
            name.startsWith("siteproxy") ||
            lowerName.startsWith("cf-") ||
            lowerName.startsWith("x-forwarded") ||
            strippedHeaderNames.has(lowerName);
        if (isProxyHeader) {
            namesToDelete.push(name);
        }
    });
    namesToDelete.forEach((headerName) => {
        headers.delete(headerName);
    });
}

export {
    parseProtocolHost,
    parseCookieHeader,
    stripProxyCookies,
    rewriteSetCookie,
    buildCookieVariants,
    stripProxyHeaders,
    isMalformedCookie,
    unproxyUrlString
};
