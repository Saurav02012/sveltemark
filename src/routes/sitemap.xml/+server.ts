export async function GET({ url }: { url: URL }) {
	const origin = url.origin;
	const lastmod = new Date().toISOString();

	const pages = [
		{ path: '/', priority: '1.0', changefreq: 'weekly' },
		{ path: '/app', priority: '0.8', changefreq: 'monthly' }
	];

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
			.map(
				(page) => `  <url>
    <loc>${origin}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
			)
			.join('\n')}
</urlset>`;

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600, no-transform'
		}
	});
}
