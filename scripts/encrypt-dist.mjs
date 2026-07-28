// Post-build step: replace dist/index.html with a password gate, and encrypt
// the app bundle so the plaintext never ships.
//
// This is obfuscation-grade privacy, not security: anyone with the password
// (or enough patience) gets the code, and the ciphertext is public.  The point
// is only that a passer-by browsing the GitHub org can't load the page.
//
// Crypto: PBKDF2-SHA256 (250k iterations) → AES-256-GCM.  GCM's auth tag is
// what tells us a password was wrong — decrypt() throws on mismatch.
//
// Usage:  SITE_PASSWORD=... bun scripts/encrypt-dist.mjs [distDir]

import { readFile, writeFile, unlink } from "node:fs/promises";
import { join, basename } from "node:path";

const DIST = process.argv[2] ?? "dist";
const ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const password = process.env.SITE_PASSWORD;
if (!password) {
  console.error(
    "encrypt-dist: SITE_PASSWORD is not set.\n" +
      "  Refusing to build — an unencrypted dist would be published as-is.\n" +
      "  Locally:  SITE_PASSWORD=... bun scripts/encrypt-dist.mjs\n" +
      "  In CI:    set the SITE_PASSWORD repository secret.",
  );
  process.exit(1);
}

const indexPath = join(DIST, "index.html");
const html = await readFile(indexPath, "utf8");

// Vite emits exactly one entry script and one stylesheet for this app.
const jsHref = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
const cssHref = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1];
if (!jsHref) {
  console.error(`encrypt-dist: no entry <script src> found in ${indexPath}`);
  process.exit(1);
}

const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "Protected";

const assetPath = (href) => join(DIST, "assets", basename(href));
const js = await readFile(assetPath(jsHref), "utf8");
const css = cssHref ? await readFile(assetPath(cssHref), "utf8") : "";

// ─── Encrypt ───
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

const keyMaterial = await crypto.subtle.importKey(
  "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"],
);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  keyMaterial,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"],
);
const ciphertext = new Uint8Array(
  await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify({ js, css }))),
);

// Wire format: salt ‖ iv ‖ ciphertext+tag, base64'd.
const blob = new Uint8Array(salt.length + iv.length + ciphertext.length);
blob.set(salt, 0);
blob.set(iv, salt.length);
blob.set(ciphertext, salt.length + iv.length);
const payload = Buffer.from(blob).toString("base64");

// ─── Gate page ───
const gate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${title}</title>
    <style id="gate-style">
      /* Follows the light/dark split the app itself uses (src/app.css). */
      :root {
        color-scheme: light dark;
        --bg: #ffffff; --fg: #1a1d24; --muted: #6b7280;
        --surface: #f6f7f9; --border: #d8dbe2; --accent: #4f8cff;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0c0e14; --fg: #e6e6e6; --muted: #8b93a7;
          --surface: #151a23; --border: #2a3040;
        }
      }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: var(--bg); color: var(--fg);
        font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      form { display: flex; flex-direction: column; gap: 10px; width: 260px; }
      h1 { font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase;
           color: var(--muted); margin: 0 0 4px; font-weight: 600; }
      input, button {
        font: inherit; padding: 9px 11px; border-radius: 8px;
        border: 1px solid var(--border); background: var(--surface); color: inherit;
      }
      input:focus { outline: none; border-color: var(--accent); }
      button { cursor: pointer; background: var(--accent); border-color: var(--accent);
               color: #fff; font-weight: 600; }
      button:disabled { opacity: 0.6; cursor: default; }
      .err { color: #e5484d; font-size: 12px; min-height: 16px; }
    </style>
  </head>
  <body>
    <form id="gate">
      <h1>Password required</h1>
      <input id="pw" type="password" autocomplete="current-password"
             placeholder="password" autofocus />
      <button id="go" type="submit">Unlock</button>
      <div class="err" id="err"></div>
    </form>

    <script>
      const PAYLOAD = "${payload}";
      const ITERATIONS = ${ITERATIONS};
      const SALT_BYTES = ${SALT_BYTES};
      const IV_BYTES = ${IV_BYTES};
      const STORE_KEY = "site-pw";

      const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

      async function decrypt(password) {
        const raw = b64(PAYLOAD);
        const salt = raw.slice(0, SALT_BYTES);
        const iv = raw.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
        const data = raw.slice(SALT_BYTES + IV_BYTES);

        const km = await crypto.subtle.importKey(
          "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"],
        );
        const key = await crypto.subtle.deriveKey(
          { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
          km,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"],
        );
        // Throws on a wrong password: the GCM tag won't verify.
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        return JSON.parse(new TextDecoder().decode(plain));
      }

      function boot({ js, css }) {
        // Drop the gate and its centering styles before the app mounts.
        document.getElementById("gate").remove();
        document.getElementById("gate-style")?.remove();
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
        const app = document.createElement("div");
        app.id = "app";
        document.body.appendChild(app);
        const script = document.createElement("script");
        script.type = "module";
        script.src = URL.createObjectURL(new Blob([js], { type: "text/javascript" }));
        document.body.appendChild(script);
      }

      const form = document.getElementById("gate");
      const pw = document.getElementById("pw");
      const go = document.getElementById("go");
      const err = document.getElementById("err");

      async function tryUnlock(password, { remember }) {
        go.disabled = true;
        err.textContent = "";
        try {
          const bundle = await decrypt(password);
          if (remember) localStorage.setItem(STORE_KEY, password);
          boot(bundle);
        } catch {
          localStorage.removeItem(STORE_KEY);
          err.textContent = "Wrong password";
          go.disabled = false;
          pw.select();
        }
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        tryUnlock(pw.value, { remember: true });
      });

      // Silently retry a remembered password so a reload doesn't re-prompt.
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) tryUnlock(saved, { remember: false });
    </script>
  </body>
</html>
`;

await writeFile(indexPath, gate);

// Remove the plaintext bundle — otherwise it stays fetchable at its own URL.
await unlink(assetPath(jsHref));
if (cssHref) await unlink(assetPath(cssHref));

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(
  `encrypt-dist: locked ${basename(jsHref)} (${kb(js.length)})` +
    (cssHref ? ` + ${basename(cssHref)} (${kb(css.length)})` : "") +
    ` → ${indexPath} (${kb(gate.length)})`,
);
