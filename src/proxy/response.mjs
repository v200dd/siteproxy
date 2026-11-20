/**
 * Upstream response processing.
 *
 * Decompresses/compresses bodies, applies content rewriting, moves oversized
 * response headers into a service-worker envelope, and rewrites redirects.
 */

import { getConfig, isLoginHost, isNodeEnvironment } from "../config.mjs";
import { rewriteInlineScript } from "../rewrite/index.mjs";

var zlibModule;
var locationGuardSnippet =
    "if(typeof self!=='undefined'&&typeof self.___location==='undefined'){try{self.___location=self.location}catch(e){}}\n";
function replaceHtmlCharset(htmlText, charset = "utf-8") {
    let result = htmlText.replace(/<meta\s+[^>]*charset\s*=\s*[\"']?([0-9a-zA-Z\-]+)[\"']?[^>]*>/gi, (tag) =>
        tag.replace(/charset\s*=\s*[\"']?[0-9a-zA-Z\-]+[\"']?/i, 'charset="' + charset + '"')
    );
    result = result.replace(
        /<meta\s+http-equiv=[\"']?Content-Type[\"']?\s+[^>]*content=[\"'][^\"']*charset=[^\"']*[\"'][^>]*>/gi,
        '<meta http-equiv="Content-Type" content="text/html; charset=' + charset + '">'
    );
    return result;
}
function replaceHeaderCharset(headers, charset) {
    let contentType = headers.get("content-type");
    if (contentType) {
        let rewritten = contentType.replace(/charset\s*=\s*[^;]+/i, "charset=" + charset);
        if (rewritten === contentType) {
            headers.set("content-type", contentType + "; charset=" + charset);
        } else {
            headers.set("content-type", rewritten);
        }
    }
}
function rewriteWindowLocation(code) {
    code = code.replace(/\bwindow\.location\s*=(.*?)/g, "window.___location=$1");
    code = code.replace(/\bwindow\.location\.href\s*=(.*?)/g, "window.___location.href=$1");
    return code;
}
var proxyRewriteUrl = ({
    location_value: locationValue,
    proxy_url_prefix: proxyUrlPrefix,
    token_prefix: tokenPrefix = ""
}) => {
    if (locationValue.startsWith(proxyUrlPrefix)) {
        return locationValue;
    }
    if (tokenPrefix && tokenPrefix.length < proxyUrlPrefix.length) {
        let basePrefix = proxyUrlPrefix.slice(0, -tokenPrefix.length);
        if (basePrefix && locationValue.startsWith(basePrefix)) {
            return locationValue;
        }
    }
    let replacementMap = {
        "^(http[s]?)://([-a-zA-Z0-9.]+(:[0-9]+)?)": proxyUrlPrefix + "$1/$2"
    };
    for (let pattern in replacementMap) {
        let regex = new RegExp(pattern, "g");
        locationValue = locationValue.replace(regex, replacementMap[pattern]);
    }
    return locationValue;
};
function rewriteLocation({
    location_value: locationValue,
    proxy_url_prefix: proxyUrlPrefix,
    proxy_real_protocol: proxyRealProtocol,
    proxy_real_host: proxyRealHost,
    token_prefix: tokenPrefix = ""
}) {
    if (tokenPrefix && locationValue.startsWith(tokenPrefix)) {
        return locationValue;
    }
    let rewrittenLocation = proxyRewriteUrl({
        location_value: locationValue,
        proxy_url_prefix: proxyUrlPrefix,
        proxy_real_protocol: proxyRealProtocol,
        proxy_real_host: proxyRealHost,
        token_prefix: tokenPrefix
    });
    if (locationValue.startsWith("/")) {
        rewrittenLocation = proxyUrlPrefix + proxyRealProtocol + "/" + proxyRealHost + rewrittenLocation;
    }
    return rewrittenLocation;
}
// Compression is intentionally split by runtime: Node uses zlib, Workers use
// the Web Compression Streams API.
async function decompressBody(buffer, encoding) {
    if (isNodeEnvironment()) {
        return await decompressBodyNode(buffer, encoding);
    } else {
        return await decompressBodyWeb(buffer, encoding);
    }
}
async function compressBody(buffer, encoding) {
    if (isNodeEnvironment()) {
        return await compressBodyNode(buffer, encoding);
    } else {
        return await compressBodyWeb(buffer, encoding);
    }
}
async function decompressBodyNode(buffer, encoding) {
    zlibModule ||= await import("zlib");
    if (encoding === "gzip") {
        let bytes = new Uint8Array(buffer);
        if (bytes.length < 2 || bytes[0] !== 31 || bytes[1] !== 139) {
            return buffer;
        }
    }
    try {
        if (encoding === "br") {
            return zlibModule.brotliDecompressSync(buffer);
        } else if (encoding === "gzip") {
            return zlibModule.gunzipSync(buffer);
        } else {
            return buffer;
        }
    } catch (error) {
        console.error("Decompression error:", error);
        return buffer;
    }
}
async function compressBodyNode(buffer, encoding) {
    zlibModule ||= await import("zlib");
    if (!buffer || buffer.byteLength === 0 || buffer.length === 0) {
        return Buffer.alloc(0);
    }
    try {
        if (encoding === "br") {
            return zlibModule.brotliCompressSync(buffer);
        } else if (encoding === "gzip") {
            return zlibModule.gzipSync(buffer);
        } else {
            return buffer;
        }
    } catch (error) {
        console.error("Compression error:", error);
        return buffer;
    }
}
async function compressBodyWeb(body, encoding) {
    if (!body || body.byteLength === 0) {
        return new Uint8Array();
    }
    if (typeof CompressionStream !== "undefined") {
        try {
            let compressedStream;
            if (encoding === "gzip" || encoding === "br") {
                compressedStream = body.pipeThrough(new CompressionStream(encoding));
            } else {
                return body;
            }
            let reader = compressedStream.getReader();
            let chunks = [];
            let readResult;
            while (!(readResult = await reader.read()).done) {
                chunks.push(readResult.value);
            }
            return new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
        } catch (error) {
            console.error("Compression error:", error);
            return body;
        }
    } else {
        console.error("Compression not supported in this environment or for the specified format.");
        return body;
    }
}
async function decompressBodyWeb(body, encoding) {
    if (!body || body.byteLength === 0) {
        return new Uint8Array();
    }
    if (typeof DecompressionStream !== "undefined") {
        try {
            let decompressedStream;
            if (encoding === "gzip" || encoding === "br") {
                decompressedStream = body.pipeThrough(new DecompressionStream(encoding));
            } else {
                return body;
            }
            let reader = decompressedStream.getReader();
            let chunks = [];
            let readResult;
            while (!(readResult = await reader.read()).done) {
                chunks.push(readResult.value);
            }
            return new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
        } catch (error) {
            console.error("Decompression error:", error);
            return body;
        }
    } else {
        console.error("Decompression not supported in this environment or for the specified format.");
        return body;
    }
}
var SITEPROXY_HEADER = new Uint8Array([0, 0, 83, 73, 84, 69, 80, 82, 79, 88, 89, 72, 68, 82, 0]);
// Encode headers that exceed the platform limit into a body envelope. The
// service worker removes the envelope before the page sees the response.
function encodeOversizedHeadersBody(body, headers) {
    let headersJson = JSON.stringify(headers);
    let headersBytes = new TextEncoder().encode(headersJson);
    let lengthBytes = new Uint8Array(4);
    lengthBytes[0] = (headersBytes.length >>> 24) & 255;
    lengthBytes[1] = (headersBytes.length >>> 16) & 255;
    lengthBytes[2] = (headersBytes.length >>> 8) & 255;
    lengthBytes[3] = headersBytes.length & 255;
    let totalLength = SITEPROXY_HEADER.length + lengthBytes.length + headersBytes.length + body.byteLength;
    let result = new Uint8Array(totalLength);
    let offset = 0;
    result.set(SITEPROXY_HEADER, offset);
    offset += SITEPROXY_HEADER.length;
    result.set(lengthBytes, offset);
    offset += lengthBytes.length;
    result.set(headersBytes, offset);
    offset += headersBytes.length;
    let bodyView =
        body instanceof Uint8Array
            ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
            : new Uint8Array(body);
    result.set(bodyView, offset);
    return result;
}
// Build the final response after upstream fetch: rewrite redirects and the body,
// then optionally wrap oversized response headers.
function proxyUrlPrefixFor(config) {
    let base = config.proxy_url.endsWith("/") ? config.proxy_url.slice(0, -1) : config.proxy_url;
    return base + config.token_prefix;
}

async function buildProxyResponse(
    { proxyResponse: proxyResponse, newResHeaders: newResHeaders, req: req, oversizedHeaders: oversizedHeaders },
    config,
    isLoginHostFn = isLoginHost,
    decompressFn = decompressBody,
    compressFn = compressBody
) {
    let activeConfig = config || getConfig();
    let proxyUrlPrefix = proxyUrlPrefixFor(activeConfig);
    let proxyRealProtocol = req.proxy_real_protocol;
    let proxyRealHost = req.proxy_real_host;
    let injectedScript =
        "<script>\n  if (!window.siteproxy_injected_flag) {\n    var proxy_url_prefix = '" +
        proxyUrlPrefix +
        "';\n    var proxy_real_protocol = '" +
        proxyRealProtocol +
        "';\n    var proxy_real_host = '" +
        proxyRealHost +
        "';\n    var config_proxy_url = '" +
        activeConfig.proxy_url +
        "';\n    var config_token_prefix = '" +
        activeConfig.token_prefix +
        '\';\n    function proxyRewrite(url) {\n      if (typeof url !== "string") return url;\n      if (url.startsWith(proxy_url_prefix)) return url;\n      if (url.startsWith("http://") || url.startsWith("https://")) {\n        var protocol = url.split("://")[0];\n        var rest = url.substring(protocol.length + 3);\n        return proxy_url_prefix + protocol + "/" + rest;\n      }\n      if (url.startsWith("//")) {\n        return proxy_url_prefix + "https/" + url.substring(2);\n      }\n      if (url.startsWith("/")) {\n        return proxy_url_prefix + proxy_real_protocol + "/" + proxy_real_host + url;\n      }\n      // relative path without leading slash\n      return proxy_url_prefix + proxy_real_protocol + "/" + proxy_real_host + "/" + url;\n    }\n    window.___location = (function() {\n      var target = window.location;\n      return {\n        get href() { return target.href; },\n        set href(v) { target.href = proxyRewrite(v); },\n        replace(v) { target.replace(proxyRewrite(v)); },\n        assign(v) { target.assign(proxyRewrite(v)); },\n        reload: target.reload.bind(target)\n      };\n    })();\n    var originalReplaceState = window.history.replaceState;\n    var originalPushState = window.history.pushState;\n    window.history.___replaceState = function(state, title, url) {\n      var rewritten = url !== undefined ? proxyRewrite(url) : url;\n      return originalReplaceState.call(this, state, title, rewritten);\n    };\n    window.history.___pushState = function(state, title, url) {\n      var rewritten = url !== undefined ? proxyRewrite(url) : url;\n      return originalPushState.call(this, state, title, rewritten);\n    };\n  } else {\n    proxy_url_prefix = \'' +
        proxyUrlPrefix +
        "';\n    proxy_real_protocol = '" +
        proxyRealProtocol +
        "';\n    proxy_real_host = '" +
        proxyRealHost +
        "';\n    config_proxy_url = '" +
        activeConfig.proxy_url +
        "';\n    config_token_prefix = '" +
        activeConfig.token_prefix +
        "';\n    window.siteproxy_injected_flag = false; // reset flag to allow script re-execution\n    if (window.proxy_worker_registration && window.proxy_worker_registration.active) {\n      window.proxy_worker_registration.active.postMessage({\n        type: 'PROXY_CUR_LOCATION',\n        data: { protocol: proxy_real_protocol, host: proxy_real_host }\n      });\n    }\n  }\n</script><script src=\"/siteproxy-response-injected.js?v=4\"></script>";
    let tokenPrefix = activeConfig.token_prefix;
    rewriteRedirectLocation(
        proxyResponse,
        newResHeaders,
        proxyUrlPrefix,
        proxyRealProtocol,
        proxyRealHost,
        tokenPrefix
    );
    let body = await rewriteResponseBody(
        proxyResponse,
        newResHeaders,
        injectedScript,
        req,
        activeConfig,
        isLoginHostFn,
        decompressFn,
        compressFn
    );
    if (proxyResponse.status === 204 || [301, 302, 303, 304, 307, 308].includes(proxyResponse.status)) {
        body = undefined;
        newResHeaders.delete("content-length");
        newResHeaders.delete("content-encoding");
        newResHeaders.delete("transfer-encoding");
    }
    if (oversizedHeaders && Object.keys(oversizedHeaders).length > 0 && body !== undefined) {
        let bodyBytes;
        if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
            bodyBytes = body;
        } else if (body && typeof body.getReader == "function") {
            let reader = body.getReader();
            let chunks = [];
            let totalLength = 0;
            let readResult = await reader.read();
            while (!readResult.done) {
                chunks.push(readResult.value);
                totalLength += readResult.value.byteLength;
                readResult = await reader.read();
            }
            bodyBytes = new Uint8Array(totalLength);
            let offset = 0;
            for (let chunk of chunks) {
                bodyBytes.set(chunk, offset);
                offset += chunk.byteLength;
            }
        } else if (typeof body == "string") {
            bodyBytes = new TextEncoder().encode(body);
        } else {
            bodyBytes = new Uint8Array(0);
        }
        let contentEncoding = newResHeaders.get("content-encoding");
        if (contentEncoding && bodyBytes.byteLength > 0) {
            try {
                bodyBytes = await decompressFn(bodyBytes, contentEncoding);
                if (bodyBytes && !(bodyBytes instanceof Uint8Array)) {
                    bodyBytes = new Uint8Array(bodyBytes);
                }
            } catch (error) {
                console.error("Failed to decompress for oversized-header smuggling:", error);
            }
        }
        if (!(bodyBytes instanceof Uint8Array)) {
            bodyBytes = new Uint8Array(bodyBytes || 0);
        }
        body = encodeOversizedHeadersBody(bodyBytes, oversizedHeaders);
        newResHeaders.delete("content-encoding");
        newResHeaders.set("content-length", String(body.byteLength));
        newResHeaders.set("x-siteproxy-body-headers", "1");
    }
    return new Response(body, {
        status: proxyResponse.status,
        headers: newResHeaders
    });
}
// Rewrite a redirect Location so the browser stays inside the proxy prefix.
function rewriteRedirectLocation(
    response,
    headers,
    proxyUrlPrefix,
    proxyRealProtocol,
    proxyRealHost,
    tokenPrefix = ""
) {
    if ([301, 302, 303, 307, 308].includes(response.status)) {
        let location = response.headers.get("location");
        if (location) {
            let rewrittenLocation = rewriteLocation({
                location_value: location,
                proxy_url_prefix: proxyUrlPrefix,
                proxy_real_protocol: proxyRealProtocol,
                proxy_real_host: proxyRealHost,
                token_prefix: tokenPrefix
            });
            headers.set("Location", rewrittenLocation);
        }
    }
}
// Decode, rewrite, and re-encode an upstream body. Only HTML/JS/CSS below 500
// status is buffered and modified; other responses are streamed through.
async function rewriteResponseBody(
    proxyResponse,
    newResHeaders,
    injectedScript,
    req,
    config,
    isLoginHostFn,
    decompressFn,
    compressFn
) {
    let activeConfig = config || getConfig();
    let proxyUrlPrefix = proxyUrlPrefixFor(activeConfig);
    let proxyRealProtocol = req.proxy_real_protocol;
    let proxyRealHost = req.proxy_real_host;
    let tokenPathPrefix = activeConfig.token_prefix;
    if (!tokenPathPrefix.endsWith("/")) {
        tokenPathPrefix += "/";
    }
    tokenPathPrefix += proxyRealProtocol + "/" + proxyRealHost + "/";
    let body;
    let contentEncoding = proxyResponse.headers.get("content-encoding");
    let contentType = proxyResponse.headers.get("content-type") || "";
    let isHtml = /text\/html/i.test(contentType);
    let isJavaScript = /^(application|text)\/(x-)?(javascript|ecmascript)/i.test(contentType);
    let isCss = /^text\/css/i.test(contentType);
    let responseBody = proxyResponse.body;
    let charset = "utf-8";
    let bodyLength;
    if (contentEncoding) {
        body = await proxyResponse.arrayBuffer();
        bodyLength = body.byteLength;
        if ((isHtml || isJavaScript || isCss) && proxyResponse.status < 500) {
            body = await decompressFn(body, contentEncoding);
        }
    }
    if ((isHtml || isJavaScript || isCss) && proxyResponse.status < 500) {
        if (!contentEncoding) {
            body = await proxyResponse.arrayBuffer();
            bodyLength = body.byteLength;
        }
        if ((!bodyLength || bodyLength < 32) && (!bodyLength || proxyResponse.status === 204)) {
            body = undefined;
            return body;
        }
        let metaCharsetText = new TextDecoder("iso-8859-1").decode(body);
        let metaCharsetMatch = metaCharsetText.match(/<meta\s+[^>]*charset\s*=\s*["']?([0-9a-zA-Z\-]+)["']?[^>]*>/i);
        if (isHtml && metaCharsetMatch && metaCharsetMatch[1]) {
            charset = metaCharsetMatch[1].toLowerCase();
        } else {
            let headerCharsetMatch = contentType.match(/charset=([^;]+)/i);
            if (headerCharsetMatch) {
                charset = headerCharsetMatch[1].toLowerCase();
            }
        }
        let textDecoder;
        try {
            textDecoder = new TextDecoder(charset);
        } catch (error) {
            console.error("Unsupported charset, falling back to utf-8", error);
            textDecoder = new TextDecoder("utf-8");
        }
        let decodedBody = textDecoder.decode(body);
        if (isLoginHostFn(proxyRealHost)) {
            if (isJavaScript) {
                body = decodedBody;
                if (charset !== "utf-8") {
                    if (isHtml) {
                        body = replaceHtmlCharset(body, "utf-8");
                    }
                    replaceHeaderCharset(newResHeaders, "utf-8");
                }
                body = rewriteWindowLocation(body);
                body = locationGuardSnippet + body;
                body = new TextEncoder("utf-8").encode(body);
            } else if (isHtml) {
                body = decodedBody;
                if (charset !== "utf-8") {
                    body = replaceHtmlCharset(body, "utf-8");
                    replaceHeaderCharset(newResHeaders, "utf-8");
                }
                if (body.indexOf("<head") !== -1) {
                    body = body.replace(/<head(.*?)>/, "<head$1>" + injectedScript);
                } else if (body.indexOf("<html") !== -1) {
                    body = body.replace(/<html(.*?)>/, "<html$1>" + injectedScript);
                } else if (body.indexOf("<body") !== -1) {
                    body = body.replace(/<body(.*?)>/, "<body$1>" + injectedScript);
                } else {
                    let closingTagPattern = new RegExp("</[a-zA-Z0-9]+>");
                    body = body.replace(closingTagPattern, (tag) => tag + injectedScript);
                }
                body = new TextEncoder("utf-8").encode(body);
            }
        } else if (isHtml || isJavaScript || isCss) {
            body = decodedBody;
            if (charset !== "utf-8") {
                if (isHtml) {
                    body = replaceHtmlCharset(body, "utf-8");
                }
                replaceHeaderCharset(newResHeaders, "utf-8");
            }
            if (isJavaScript) {
                body = rewriteWindowLocation(body);
            }
            body = rewriteInlineScript({
                body: body,
                proxy_real_host: proxyRealHost,
                proxy_real_protocol: proxyRealProtocol,
                proxy_url_prefix: proxyUrlPrefix,
                token_prefix: activeConfig.token_prefix,
                skipUrlRewrite: isJavaScript,
                skipIdentifierRewrite: isCss
            });
            if (isJavaScript) {
                body = locationGuardSnippet + body;
            }
            if (isHtml) {
                if (body.indexOf("<head") !== -1) {
                    body = body.replace(/<head(.*?)>/, "<head$1>" + injectedScript);
                } else if (body.indexOf("<html") !== -1) {
                    body = body.replace(/<html(.*?)>/, "<html$1>" + injectedScript);
                } else if (body.indexOf("<body") !== -1) {
                    body = body.replace(/<body(.*?)>/, "<body$1>" + injectedScript);
                } else {
                    let closingTagPattern = new RegExp("</[a-zA-Z0-9]+>");
                    body = body.replace(closingTagPattern, (tag) => tag + injectedScript);
                }
            }
            body = new TextEncoder("utf-8").encode(body);
        }
        if (req.proxy_real_protocol) {
            let protocolCookie = "proxy_real_protocol=" + req.proxy_real_protocol + "; Path=/; HttpOnly";
            let hostCookie = "proxy_real_host=" + req.proxy_real_host + "; Path=/; HttpOnly";
            newResHeaders.append("set-cookie", protocolCookie);
            newResHeaders.append("set-cookie", hostCookie);
            newResHeaders.delete("x-frame-options");
        }
        responseBody = body;
    }
    if (contentEncoding) {
        if (isNodeEnvironment() && proxyResponse.status < 500) {
            if (body == null) {
                body = new Uint8Array(0);
            }
            body = await compressFn(body, contentEncoding);
            if (body == null) {
                body = new Uint8Array(0);
            }
            newResHeaders.set("content-length", String(body.byteLength || body.length || 0));
            newResHeaders.set("content-encoding", contentEncoding);
        }
        responseBody = body;
        newResHeaders.delete("transfer-encoding");
    }
    if (responseBody != null) {
        if (responseBody?.byteLength !== undefined || responseBody?.length !== undefined) {
            newResHeaders.set("content-length", String(responseBody.byteLength || responseBody.length || 0));
        }
        newResHeaders.delete("transfer-encoding");
    }
    if (responseBody instanceof ArrayBuffer) {
        responseBody = new Uint8Array(responseBody);
    }
    return responseBody;
}

export { buildProxyResponse };
