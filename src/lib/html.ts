/**
 * HTML shell builders and escape helpers shared across all route files.
 */

/** Escape a string for safe interpolation inside an HTML attribute value. */
export const escapeAttr = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Escape a string for safe interpolation inside HTML text content. */
export function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Escape a JSON string for safe embedding inside a <script>…</script> block.
 * Without this, a `</script>` substring inside the JSON would close the tag.
 * U+2028/U+2029 are also legal in JSON but illegal in raw JS source.
 */
export function escapeScriptJson(json: string): string {
	return json
		.replace(/<\/script/gi, '<\\/script')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

/** Optional Open Graph / Twitter Card meta tags for social sharing. */
export interface PageMeta {
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	ogUrl?: string;
	twitterCard?: 'summary' | 'summary_large_image';
}

/** Build OG / Twitter Card meta tag HTML from a PageMeta object. */
function renderMetaTags(meta: PageMeta): string {
	const tags: string[] = [];
	if (meta.ogTitle) {
		tags.push(`<meta property="og:title" content="${escapeAttr(meta.ogTitle)}" />`);
		tags.push(`<meta name="twitter:title" content="${escapeAttr(meta.ogTitle)}" />`);
	}
	if (meta.ogDescription) {
		tags.push(`<meta property="og:description" content="${escapeAttr(meta.ogDescription)}" />`);
		tags.push(`<meta name="twitter:description" content="${escapeAttr(meta.ogDescription)}" />`);
	}
	if (meta.ogImage) {
		tags.push(`<meta property="og:image" content="${escapeAttr(meta.ogImage)}" />`);
		tags.push(`<meta name="twitter:image" content="${escapeAttr(meta.ogImage)}" />`);
	}
	if (meta.ogUrl) {
		tags.push(`<meta property="og:url" content="${escapeAttr(meta.ogUrl)}" />`);
	}
	tags.push(`<meta property="og:type" content="website" />`);
	tags.push(`<meta name="twitter:card" content="${meta.twitterCard ?? 'summary'}" />`);
	return tags.join('\n\t\t');
}

/** Standard page shell used by all non-kiosk routes. */
export const page = (title: string, body: string, meta?: PageMeta) => `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>${title}</title>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		${meta ? renderMetaTags(meta) : ''}
		<link rel="stylesheet" href="/app.css" />
		<link rel="icon" href="/favicon.png" />
	</head>
	<body class="min-h-screen bg-cf-ink text-white font-display antialiased">
		${body}
	</body>
</html>`;

/**
 * Kiosk shell — used for every /kiosk/* screen. Differs from page() in
 * three ways:
 *   1. viewport locks zoom (kiosks shouldn't be pinch-zoomable)
 *   2. `viewport-fit=cover` so we can paint behind the home indicator
 *   3. `html.h-full` so full-bleed flex layouts work without min-height hacks
 *
 * No dev chrome. The kiosk runs in Safari Guided Access — anything that
 * helps the user escape the flow is a bug.
 */
export const kioskPage = (title: string, body: string) => `<!doctype html>
<html lang="en" class="h-full">
	<head>
		<meta charset="utf-8" />
		<title>${title}</title>
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
		/>
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
		<meta name="theme-color" content="#000000" />
		<link rel="stylesheet" href="/app.css" />
		<link rel="icon" href="/favicon.png" />
	</head>
	<!--
		min-h-[100dvh] + overscroll-none = looks like a locked kiosk on iPad
		but degrades gracefully on short desktop windows (content stays
		reachable instead of being clipped behind the bottom of the viewport).
	-->
	<body class="min-h-[100dvh] bg-cf-ink text-white font-display antialiased overscroll-none select-none touch-manipulation">
		${body}
	</body>
</html>`;
