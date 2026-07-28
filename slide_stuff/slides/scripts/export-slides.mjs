// Export every deck slide to ../output/slide_N.png.
//
// Reproduces the original exports: a 1280×720 logical frame captured at an
// effective device-pixel ratio of 2 (→ 2560×1440 PNG), with the page content
// magnified to emulate a Chrome browser zoom (Cmd +/-) of 1.15.
//
// Browser zoom is NOT the same as deviceScaleFactor (DPI) or CSS `zoom`: a
// zoom of Z shrinks the layout viewport to (size / Z) CSS px and maps each CSS
// px to Z× more device px. We emulate that exactly by using a viewport of
// (BASE / ZOOM) and a deviceScaleFactor of DPR × ZOOM, so the layout reflows as
// if zoomed in while the output stays BASE × DPR pixels.
//
// Usage:  bun scripts/export-slides.mjs
// (Builds the deck, serves the static build, screenshots, then cleans up.)

import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const SLIDES_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.resolve(SLIDES_DIR, '..', 'output');
const ROUTES_DIR = path.join(SLIDES_DIR, 'src', 'routes', '(slides)');
const PORT = 4320;

// --- Match the original PNG exports -----------------------------------------
const ZOOM = 1.15; // emulated Chrome Cmd-+ browser zoom
const BASE_W = 1280;
const BASE_H = 720;
const DPR = 2; // raster oversampling → 2560×1440 output
// ----------------------------------------------------------------------------

const viewport = {
	width: Math.round(BASE_W / ZOOM),
	height: Math.round(BASE_H / ZOOM)
};
const deviceScaleFactor = DPR * ZOOM;

// Slide routes are slide_0 … slide_N; export them in numeric order.
const slideNumbers = fs
	.readdirSync(ROUTES_DIR, { withFileTypes: true })
	.filter((e) => e.isDirectory() && /^slide_\d+$/.test(e.name))
	.map((e) => parseInt(e.name.replace('slide_', ''), 10))
	.sort((a, b) => a - b);

// Strip the deck chrome (top bar, progress bar, click zones) so each capture is
// just the slide surface, filling the full frame.
const HIDE_CHROME = `
	.bar, .progress, .zone { display: none !important; }
	.deck, .stage { height: 100vh !important; }
`;

async function waitForServer(url, timeoutMs = 15000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const r = await fetch(url);
			if (r.ok) return;
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`preview server did not start at ${url}`);
}

console.log('Building deck…');
execSync('bun run build', { cwd: SLIDES_DIR, stdio: 'inherit' });

console.log(`Serving build on :${PORT}…`);
const server = spawn('bunx', ['vite', 'preview', '--port', String(PORT)], {
	cwd: SLIDES_DIR,
	stdio: 'ignore'
});

let browser;
try {
	await waitForServer(`http://localhost:${PORT}/slide_0`);

	browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport, deviceScaleFactor });
	const page = await ctx.newPage();

	fs.mkdirSync(OUT_DIR, { recursive: true });
	for (const n of slideNumbers) {
		await page.goto(`http://localhost:${PORT}/slide_${n}`, { waitUntil: 'networkidle' });
		await page.addStyleTag({ content: HIDE_CHROME });
		await page.waitForTimeout(400);
		const out = path.join(OUT_DIR, `slide_${n}.png`);
		await page.screenshot({ path: out });
		console.log(`  ✓ slide_${n}.png`);
	}
	console.log(`Exported ${slideNumbers.length} slides to ${OUT_DIR}`);
} finally {
	if (browser) await browser.close();
	server.kill();
}
