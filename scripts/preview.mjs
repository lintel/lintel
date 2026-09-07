// Local, offline preview server for the bilingual profile README.
// Renders the Markdown with GitHub-flavored styling so you can see how the
// profile page will look before pushing. Files are read fresh on every
// request, so editing a README and refreshing the browser shows the change.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

// Pages served by the preview server. Keyed by URL path.
const PAGES = {
  "/": { file: "README.md", title: "README.md (中文)" },
  "/en": { file: "README_en.md", title: "README_en.md (English)" },
};

const marked = new Marked({ gfm: true, breaks: false });
marked.use(gfmHeadingId());

async function loadGithubCss() {
  const cssPath = join(
    rootDir,
    "node_modules",
    "github-markdown-css",
    "github-markdown.css",
  );
  try {
    return await readFile(cssPath, "utf8");
  } catch {
    return "body{font-family:sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;}";
  }
}

function pageShell({ title, css, bodyHtml, activePath }) {
  const navLinks = Object.entries(PAGES)
    .map(([path, meta]) => {
      const active = path === activePath ? ' aria-current="page"' : "";
      return `<a href="${path}"${active}>${meta.title}</a>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${css}
body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 24px; }
.preview-nav { max-width: 980px; margin: 0 auto 16px; display: flex; gap: 12px; font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; }
.preview-nav a { padding: 6px 12px; border: 1px solid #d0d7de; border-radius: 6px; text-decoration: none; color: #24292f; background: #f6f8fa; }
.preview-nav a[aria-current="page"] { background: #0969da; color: #fff; border-color: #0969da; }
</style>
</head>
<body>
<nav class="preview-nav">${navLinks}</nav>
<article class="markdown-body">
${bodyHtml}
</article>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const page = PAGES[url.pathname];

  if (!page) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Not found: ${url.pathname}\nAvailable pages: ${Object.keys(PAGES).join(", ")}`);
    return;
  }

  try {
    const md = await readFile(join(rootDir, page.file), "utf8");
    const css = await loadGithubCss();
    const bodyHtml = marked.parse(md);
    const html = pageShell({
      title: page.title,
      css,
      bodyHtml,
      activePath: url.pathname,
    });
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Failed to render ${page.file}: ${err.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Profile README preview running at http://${HOST}:${PORT}/`);
  console.log("Pages:");
  for (const [path, meta] of Object.entries(PAGES)) {
    console.log(`  http://${HOST}:${PORT}${path}  ->  ${meta.file}`);
  }
});
