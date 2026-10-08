// Post-build: give every route its own static HTML file so crawlers see the real
// title, description and canonical without running JS. The SPA shell from Vite
// is the template; route meta comes straight out of each route file's head(),
// so the route files stay the only place titles and descriptions live.
//
// Also writes sitemap.xml (from the same route list) and 404.html.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SITE = "https://noupload.xyz";
const OG_IMAGE = `${SITE}/og/default.png`;
// Same as vite.config.ts routeFileIgnorePattern — dev-only routes never ship.
const IGNORED = /design-system|test-compress/;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = join(root, "src/routes");
const dist = join(root, "dist");

// ── read route meta out of the route files ─────────────────

function literal(node) {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	return undefined;
}

function prop(obj, name) {
	return obj.properties.find((p) => p.name && p.name.text === name);
}

function readRoute(file) {
	const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
	let route;
	const visit = (node) => {
		// createFileRoute("/path")({ ...options })
		if (
			ts.isCallExpression(node) &&
			ts.isCallExpression(node.expression) &&
			node.expression.expression.getText() === "createFileRoute"
		) {
			const path = literal(node.expression.arguments[0]);
			const options = node.arguments[0];
			route = { file, path, meta: {}, redirects: false, hasComponent: false };
			if (!options || !ts.isObjectLiteralExpression(options)) return;
			route.redirects = !!prop(options, "beforeLoad") && /redirect\(/.test(options.getText());
			route.hasComponent = !!prop(options, "component");
			const head = prop(options, "head");
			const body = head && ts.isArrowFunction(head.initializer) ? head.initializer.body : undefined;
			const ret = body && ts.isParenthesizedExpression(body) ? body.expression : body;
			const metaArr = ret && ts.isObjectLiteralExpression(ret) ? prop(ret, "meta")?.initializer : undefined;
			if (!metaArr || !ts.isArrayLiteralExpression(metaArr)) return;
			for (const el of metaArr.elements) {
				if (!ts.isObjectLiteralExpression(el)) continue;
				const title = prop(el, "title");
				if (title) route.meta.title = literal(title.initializer);
				const key = prop(el, "name") ?? prop(el, "property");
				const content = prop(el, "content");
				if (key && content) route.meta[literal(key.initializer)] = literal(content.initializer);
			}
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(src);
	return route;
}

function collectRoutes() {
	const routes = [];
	for (const name of readdirSync(routesDir).sort()) {
		if (!name.endsWith(".tsx") || name === "__root.tsx" || IGNORED.test(name)) continue;
		const route = readRoute(join(routesDir, name));
		if (!route?.path) throw new Error(`prerender-seo: no createFileRoute path in ${name}`);
		if (route.redirects) continue; // handled by a real redirect in vercel.json
		route.path = route.path.length > 1 ? route.path.replace(/\/$/, "") : route.path;
		const { title, description } = route.meta;
		if (!title || !description) {
			throw new Error(`prerender-seo: ${name} needs a static title and description in head()`);
		}
		routes.push(route);
	}
	return routes;
}

// ── html ───────────────────────────────────────────────────

const esc = (s) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// JSON inside <script> only needs "<" neutralised.
const jsonLd = (data) =>
	`<script type="application/ld+json" data-ssg>${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

function structuredData(route, url) {
	if (route.path === "/") {
		return [
			jsonLd({
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: "noupload",
				alternateName: ["NoUpload", "noupload.xyz"],
				url: `${SITE}/`,
			}),
			jsonLd({
				"@context": "https://schema.org",
				"@type": "Organization",
				name: "noupload",
				url: `${SITE}/`,
				logo: `${SITE}/og/logo.png`,
				sameAs: ["https://github.com/shockz09/noupload"],
			}),
		];
	}
	return [
		jsonLd({
			"@context": "https://schema.org",
			"@type": "WebApplication",
			name: route.meta["og:title"] ?? route.meta.title,
			description: route.meta.description,
			url,
			applicationCategory: "UtilitiesApplication",
			operatingSystem: "Any",
			browserRequirements: "Requires JavaScript",
			offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
			isPartOf: { "@type": "WebSite", name: "noupload", url: `${SITE}/` },
		}),
	];
}

function headTags(route, url) {
	const m = route.meta;
	const ogTitle = m["og:title"] ?? m.title;
	const ogDesc = m["og:description"] ?? m.description;
	return [
		`<title data-ssg>${esc(m.title)}</title>`,
		`<meta data-ssg name="description" content="${esc(m.description)}" />`,
		`<link rel="canonical" href="${url}" data-ssg />`,
		`<meta data-ssg property="og:type" content="website" />`,
		`<meta data-ssg property="og:site_name" content="noupload" />`,
		`<meta data-ssg property="og:url" content="${url}" />`,
		`<meta data-ssg property="og:title" content="${esc(ogTitle)}" />`,
		`<meta data-ssg property="og:description" content="${esc(ogDesc)}" />`,
		`<meta data-ssg property="og:image" content="${OG_IMAGE}" />`,
		`<meta data-ssg property="og:image:width" content="1200" />`,
		`<meta data-ssg property="og:image:height" content="630" />`,
		`<meta data-ssg name="twitter:card" content="summary_large_image" />`,
		`<meta data-ssg name="twitter:title" content="${esc(ogTitle)}" />`,
		`<meta data-ssg name="twitter:description" content="${esc(ogDesc)}" />`,
		`<meta data-ssg name="twitter:image" content="${OG_IMAGE}" />`,
		...structuredData(route, url),
	].join("\n    ");
}

function render(template, route) {
	const url = route.path === "/" ? `${SITE}/` : `${SITE}${route.path}`;
	return template.replace("</head>", `  ${headTags(route, url)}\n  </head>`);
}

function outFile(path) {
	// cleanUrls: /image/compress is served from image/compress.html
	return path === "/" ? join(dist, "index.html") : join(dist, `${path.slice(1)}.html`);
}

function sitemap(routes) {
	const urls = [...routes]
		.sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : 0))
		.map((r) => `  <url><loc>${r.path === "/" ? `${SITE}/` : `${SITE}${r.path}`}</loc></url>`)
		.join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function notFound(template) {
	return template
		.replace(
			"</head>",
			`  <title data-ssg>Page not found | noupload</title>\n    <meta name="robots" content="noindex" />\n  </head>`,
		);
}

// ── main ───────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const templatePath = join(dist, "index.html");
	if (!existsSync(templatePath)) throw new Error("prerender-seo: run vite build first");
	const template = readFileSync(templatePath, "utf8");
	if (template.includes("data-ssg")) throw new Error("prerender-seo: dist/index.html is already prerendered");

	const routes = collectRoutes();
	for (const route of routes) {
		const file = outFile(route.path);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, render(template, route));
	}
	writeFileSync(join(dist, "404.html"), notFound(template));
	writeFileSync(join(dist, "sitemap.xml"), sitemap(routes));

	console.log(`prerender-seo: ${routes.length} pages, sitemap.xml, 404.html`);
}
