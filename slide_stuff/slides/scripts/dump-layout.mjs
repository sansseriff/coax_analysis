// Dump the deck's rendered geometry to ../output/slide-layout.json.
//
// The pptx build (see ../../pptx_build) does pure placement: it never
// re-implements flexbox, grid or line breaking. Instead we let Chrome lay the
// deck out exactly as `export-slides.mjs` captures it, then walk the DOM and
// record, in CSS px relative to the `.slide` box:
//
//   box   – an element's border box, its background and its four borders
//   text  – ONE ENTRY PER RENDERED LINE, with the tight ink box of that line
//   svg   – a cross-section placeholder, redrawn from slide-data.json geometry
//
// Emitting one entry per *line* (rather than per paragraph) is what keeps the
// pptx faithful: line breaks, inline margins, letter-spacing and flex/grid
// positioning are all resolved by the browser, so Python only has to drop a
// non-wrapping text box onto each line's measured rectangle.
//
// Usage:  bun scripts/dump-layout.mjs
// (Builds the deck, serves the static build, walks each slide, then cleans up.)

import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const SLIDES_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.resolve(SLIDES_DIR, '..', 'output', 'slide-layout.json');
const ROUTES_DIR = path.join(SLIDES_DIR, 'src', 'routes', '(slides)');
const PORT = 4321;

// Must match export-slides.mjs so the pptx and the reference PNGs agree.
const ZOOM = 1.15;
const BASE_W = 1280;
const BASE_H = 720;
const DPR = 2;

const viewport = { width: Math.round(BASE_W / ZOOM), height: Math.round(BASE_H / ZOOM) };
const deviceScaleFactor = DPR * ZOOM;

// Cross-sections render at ~82 CSS px but print near 1″, so oversample hard.
const XSEC_DPR = 12;

const slugify = (s) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');

const HIDE_CHROME = `
	.bar, .progress, .zone { display: none !important; }
	.deck, .stage { height: 100vh !important; }
`;

// Elements that become a PowerPoint group, so a background travels with the
// text on top of it and a number travels with its unit. Deliberately shallow:
// HTML nests far more deeply than is useful to someone dragging shapes around a
// slide, so this is an opt-in list rather than a mirror of the DOM tree. The
// name is what shows up in PowerPoint's selection pane.
const GROUPS = [
	{ sel: '.icard', name: 'Cable spec card' }, // title slide: accent bar, name, spec list
	{ sel: '.card', name: 'Cable card' }, // length slide: everything for one cable
	{ sel: '.chip', name: 'Spec chip' }, // grey pill + its label and value
	{ sel: '.stat', name: 'Metric row' }, // key, value, unit
	{ sel: 'tbody tr', name: 'Summary row' } // one length across both cables
];

const slideNumbers = fs
	.readdirSync(ROUTES_DIR, { withFileTypes: true })
	.filter((e) => e.isDirectory() && /^slide_\d+$/.test(e.name))
	.map((e) => parseInt(e.name.replace('slide_', ''), 10))
	.sort((a, b) => a - b);

async function waitForServer(url, timeoutMs = 20000) {
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

/**
 * Runs in the page (serialized, so it closes over nothing — `groups` is passed
 * in). Returns { width, height, nodes[], warnings[] } for the `.slide` box.
 */
function walkSlide(groups) {
	const root = document.querySelector('.slide');
	const origin = root.getBoundingClientRect();

	const rel = (r) => ({
		x: r.left - origin.left,
		y: r.top - origin.top,
		w: r.width,
		h: r.height
	});

	/** 'rgb(r, g, b)' | 'rgba(r, g, b, a)' -> {r,g,b,a} */
	function parseColor(s) {
		const m = /rgba?\(([^)]+)\)/.exec(s);
		if (!m) return null;
		const p = m[1].split(',').map((v) => parseFloat(v.trim()));
		return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
	}

	const isBlank = (c) => c === null || c.a === 0;

	function borders(cs) {
		const side = (w, st, c) => {
			const px = parseFloat(w);
			if (!px || st === 'none' || st === 'hidden') return null;
			const col = parseColor(c);
			return isBlank(col) ? null : { w: px, color: col };
		};
		return {
			top: side(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor),
			right: side(cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor),
			bottom: side(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor),
			left: side(cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor)
		};
	}

	// --- text extraction ------------------------------------------------------
	//
	// A block's inline content is measured character by character, so the browser
	// tells us exactly which characters landed on which rendered line and where.
	// Characters sharing a `top` form one line; a line's rect is the union of its
	// *inked* characters, i.e. a tight ascent..descent box we can centre text in.
	//
	// Pieces on a line are then merged back into as few text boxes as possible.
	// Merging matters: PowerPoint and LibreOffice do not reproduce Chrome's glyph
	// advances exactly, so a sentence split across boxes ("… lengths of", "3″ …",
	// ".") would drift apart or collide. Runs that are only separated by a word
	// space get merged and re-flow together; runs separated by an inline margin
	// (e.g. `.chip b { margin-right }`) stay in their own box, preserving the gap.

	const font = (cs) => ({
		font: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
		sizePx: parseFloat(cs.fontSize),
		weight: parseInt(cs.fontWeight, 10) || 400,
		italic: cs.fontStyle === 'italic',
		color: parseColor(cs.color),
		letterSpacingPx: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing)
	});

	const transform = (text, cs) =>
		cs.textTransform === 'uppercase'
			? text.toUpperCase()
			: cs.textTransform === 'lowercase'
				? text.toLowerCase()
				: text;

	/** Split one text node into per-line pieces carrying their own ink box. */
	function piecesOf(textNode, cs) {
		const raw = textNode.nodeValue;
		if (!raw || !raw.trim()) return [];

		const range = document.createRange();
		const lines = new Map();

		for (let i = 0; i < raw.length; i++) {
			range.setStart(textNode, i);
			range.setEnd(textNode, i + 1);
			const r = range.getBoundingClientRect();
			if (r.width === 0 && r.height === 0) continue; // collapsed whitespace

			const key = Math.round(r.top * 2) / 2;
			if (!lines.has(key))
				lines.set(key, { chars: [], l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
			const line = lines.get(key);
			line.chars.push(raw[i]);

			if (raw[i].trim()) {
				line.l = Math.min(line.l, r.left);
				line.t = Math.min(line.t, r.top);
				line.r = Math.max(line.r, r.right);
				line.b = Math.max(line.b, r.bottom);
			}
		}

		const out = [];
		for (const [key, line] of lines) {
			if (line.l === Infinity) continue; // whitespace-only line
			const collapsed = line.chars.join('').replace(/\s+/g, ' ');
			const text = collapsed.trim();
			if (!text) continue;
			out.push({
				key,
				text: transform(text, cs),
				leadWS: /^\s/.test(collapsed),
				trailWS: /\s$/.test(collapsed),
				l: line.l,
				t: line.t,
				r: line.r,
				b: line.b,
				style: font(cs)
			});
		}
		return out;
	}

	/** Text nodes in `el`'s inline subtree, paired with their styling element. */
	function inlineSegments(el) {
		const segs = [];
		for (const node of el.childNodes) {
			if (node.nodeType === Node.TEXT_NODE) {
				if (node.nodeValue.trim()) segs.push(...piecesOf(node, getComputedStyle(el)));
			} else if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() !== 'svg') {
				const cs = getComputedStyle(node);
				if (cs.display === 'inline' && cs.visibility !== 'hidden')
					segs.push(...inlineSegments(node));
			}
		}
		return segs;
	}

	// Two pieces belong in one box when a word space was collapsed between them.
	// Anything else that abuts within a hairline is also joinable; a real gap
	// means an inline box model margin we must not swallow.
	const JOIN_EPS = 0.75;

	function textNodesFor(el, cs) {
		const pieces = inlineSegments(el);
		if (!pieces.length) return [];

		const lines = new Map();
		for (const p of pieces) {
			if (!lines.has(p.key)) lines.set(p.key, []);
			lines.get(p.key).push(p);
		}

		const out = [];
		for (const [, line] of [...lines.entries()].sort((a, b) => a[0] - b[0])) {
			line.sort((a, b) => a.l - b.l);

			let group = null;
			const flush = () => {
				if (!group) return;
				out.push({
					kind: 'text',
					rect: rel({
						left: group.l,
						top: group.t,
						width: group.r - group.l,
						height: group.b - group.t
					}),
					align: cs.textAlign,
					runs: group.runs
				});
				group = null;
			};

			for (const p of line) {
				const spaced = group && (group.trailWS || p.leadWS);
				if (group && !spaced && p.l - group.r > JOIN_EPS) flush();

				if (!group) {
					group = { ...p, runs: [{ ...p.style, text: p.text }] };
					continue;
				}
				// Attach the collapsed space to whichever side actually carried it.
				if (group.trailWS) group.runs[group.runs.length - 1].text += ' ';
				group.runs.push({ ...p.style, text: (!group.trailWS && p.leadWS ? ' ' : '') + p.text });

				group.trailWS = p.trailWS;
				group.r = Math.max(group.r, p.r);
				group.t = Math.min(group.t, p.t);
				group.b = Math.max(group.b, p.b);
			}
			flush();
		}
		return out;
	}

	const hasAnyBorder = (bd) => !!(bd.top || bd.right || bd.bottom || bd.left);
	const groupName = (el) => groups.find((g) => el.matches(g.sel))?.name;

	const warnings = [];

	/** Returns this element's nodes, in paint order (box, own text, children). */
	function walk(el) {
		const cs = getComputedStyle(el);
		if (cs.display === 'none' || cs.visibility === 'hidden') return [];

		const rect = el.getBoundingClientRect();

		if (el.tagName.toLowerCase() === 'svg') {
			return [{ kind: 'svg', rect: rel(rect), label: el.getAttribute('aria-label') || '' }];
		}

		const nodes = [];

		// Box decoration: background and/or any visible border.
		const bg = parseColor(cs.backgroundColor);
		const bd = borders(cs);
		if (el !== root && (!isBlank(bg) || hasAnyBorder(bd))) {
			nodes.push({
				kind: 'box',
				rect: rel(rect),
				bg: isBlank(bg) ? null : bg,
				radius: parseFloat(cs.borderTopLeftRadius) || 0,
				borders: bd
			});
		}

		// This block's own inline content paints above its box; block-level
		// children are laid out and measured the same way, one level down.
		// Inline children are consumed as text runs, so a background or border on
		// one would be silently lost — the deck has none, and this keeps it honest.
		nodes.push(...textNodesFor(el, cs));
		for (const child of el.children) {
			const ccs = getComputedStyle(child);
			// <svg> is display:inline but is a replaced element, not text.
			if (ccs.display !== 'inline' || child.tagName.toLowerCase() === 'svg') {
				nodes.push(...walk(child));
			} else if (!isBlank(parseColor(ccs.backgroundColor)) || hasAnyBorder(borders(ccs))) {
				warnings.push(
					`decorated inline <${child.tagName.toLowerCase()}> dropped: ${child.className}`
				);
			}
		}

		// A group of one is just the shape itself.
		const name = groupName(el);
		if (name && nodes.length > 1) {
			return [{ kind: 'group', name, rect: rel(rect), children: nodes }];
		}
		return nodes;
	}

	return { width: origin.width, height: origin.height, nodes: walk(root), warnings };
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

	const slides = [];
	for (const n of slideNumbers) {
		await page.goto(`http://localhost:${PORT}/slide_${n}`, { waitUntil: 'networkidle' });
		await page.addStyleTag({ content: HIDE_CHROME });
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(300);
		const { warnings, ...s } = await page.evaluate(walkSlide, GROUPS);
		slides.push({ index: n, ...s });
		console.log(`  ✓ slide_${n}: ${s.nodes.length} nodes`);
		for (const w of warnings) console.warn(`    ! slide_${n}: ${w}`);
	}

	// Cross-sections are far easier to embed as images than to rebuild out of
	// pptx ovals. Re-shoot each distinct SVG on its own, transparent and heavily
	// oversampled, so it stays crisp when scaled to ~1″ on the slide.
	//
	// Sweep every slide, not just one: the radius-scaling slides draw a cable at
	// another cable's scale, which is a different image under a different
	// aria-label. The label is the identity — first slide to show one wins.
	const xsecCtx = await browser.newContext({ viewport, deviceScaleFactor: XSEC_DPR });
	const xsecPage = await xsecCtx.newPage();

	const xsecs = {};
	for (const n of slideNumbers) {
		await xsecPage.goto(`http://localhost:${PORT}/slide_${n}`, { waitUntil: 'networkidle' });
		await xsecPage.evaluate(() => document.fonts.ready);
		await xsecPage.waitForTimeout(300);

		for (const el of await xsecPage.locator('svg[aria-label$="cross-section"]').all()) {
			const label = await el.getAttribute('aria-label');
			if (xsecs[label]) continue;
			const slug = slugify(label.replace(/ cross-section$/, ''));
			const file = `xsec_${slug}.png`;
			await el.screenshot({ path: path.join(path.dirname(OUT), file), omitBackground: true });
			xsecs[label] = file;
			console.log(`  ✓ ${file}`);
		}
	}

	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, JSON.stringify({ zoom: ZOOM, xsecs, slides }, null, '\t') + '\n');
	console.log(`Wrote ${OUT}`);
} finally {
	if (browser) await browser.close();
	server.kill();
}
