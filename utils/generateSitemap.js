// utils/generateSitemap.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build XML format
function buildSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .map(
      (u) => `
  <url>
    <loc>${u}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
    )
    .join("")}
</urlset>`;
}

export function generateSitemap() {
  try {
    const domain = "https://beetlebulbs.com"; // final domain (no env needed)

    // Correct blog folder location
    const blogsDir = path.join(__dirname, "..", "blogs");

    // sitemap.xml path
    const sitemapPath = path.join(__dirname, "..", "sitemap.xml");

    // ---------------------------------------
    // STATIC PAGES (your final cleaned list)
    // ---------------------------------------
    const staticPages = [
      "",
      "name",
      "logomaker",
      "services/brand-identity",
      "services/marketing-collateral",
      "services/content-strategy",
      "services/product-packaging",
      "services/itservicespage",
      "services/webdevelopment",
      "services/appdevelopment",
      "services/ui-ux",
      "services/cloud",
      "services/digitalmarketing",
      "services/SEO-Content-Authority",
      "services/Performance-Paid-Media",
      "services/Social-Email-Nurture",
      "services/Marketing-Technology",
      "services/Digital-Strategy",
      "package",
      "blog",
      "aboutus",
      "termsconditions",
      "privacypolicy",
      "refundpolicy"
    ];

    // convert static pages to URLs
    const staticUrls = staticPages.map((page) =>
      `${domain}/${page}`
    );

    // ---------------------------------------
    // BLOG URLs
    // ---------------------------------------
    let blogUrls = [];

    if (fs.existsSync(blogsDir)) {
      const files = fs.readdirSync(blogsDir);

      blogUrls = files
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
          const slug = file.replace(".json", "");
          return `${domain}/blog/${slug}`;
        });
    }

    // MERGE STATIC + BLOG URLs
    const allUrls = [...staticUrls, ...blogUrls];

    // BUILD FINAL SITEMAP XML
    const xml = buildSitemap(allUrls);

    // WRITE FILE
    fs.writeFileSync(sitemapPath, xml, "utf8");

    console.log(`✔ Sitemap generated: ${allUrls.length} URLs`);
  } catch (err) {
    console.error("✖ Error generating sitemap:", err);
  }
}
