/**
 * Build-time text assets.
 *
 * esbuild loads these files through the text-asset plugin, so they stay
 * reviewable as ordinary source files while the build embeds their contents.
 */
import homePageHtml from "../assets/homepage.html";
import clientScriptSource from "../assets/client.js";
import serviceWorkerSource from "../assets/service-worker.js";

export { homePageHtml, clientScriptSource, serviceWorkerSource };
