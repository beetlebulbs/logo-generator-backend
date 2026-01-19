// utils/generateSitemap.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

if (process.env.NODE_ENV !== "production") {
  console.log("⏭️ Skipping sitemap generation (not production)");
  process.exit(0);
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------
// SUPABASE
// --------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --------------------
// MAIN FUNCTION
// --------------------
export async function generateSitemap() {
  try {
    const DOMAIN = "https://beetlebulbs.com";

    // sitemap will be served from frontend
    const sitemapPath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "frontend",
      "public",
      "sitemap.xml"
    );

    // ---------------------------------------
    // STATIC PAGES (AS PROVIDED BY YOU)
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

    const staticUrlsXml = staticPages
      .map(
        (page) => `
  <url>
    <loc>${DOMAIN}/${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
      )
      .join("");

    // ---------------------------------------
    // BLOG URLs (SUPABASE – SOURCE OF TRUTH)
    // ---------------------------------------
    const { data: blogs, error } = await supabase
      .from("blogs")
      .select("slug, original_date, created_at");

    if (error) {
      console.error("❌ Sitemap blog fetch error:", error);
      return;
    }

    const blogUrlsXml = (blogs || [])
      .map((b) => {
        const lastmod = new Date(
          b.original_date || b.created_at
        ).toISOString();

        return `
  <url>
    <loc>${DOMAIN}/blog/${b.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
      })
      .join("");

    // ---------------------------------------
    // FINAL SITEMAP XML
    // ---------------------------------------
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrlsXml}
${blogUrlsXml}
</urlset>`;

    fs.writeFileSync(sitemapPath, xml, "utf8");

    console.log(
      `✔ Sitemap generated successfully (${staticPages.length + blogs.length} URLs)`
    );
  } catch (err) {
    console.error("✖ Error generating sitemap:", err);
  }
}
