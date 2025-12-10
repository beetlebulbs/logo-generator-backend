// utils/replaceUrls.js
export function replaceLocalUrls(content) {
  if (!content) return content;
  const domain = process.env.DOMAIN || "https://beetlebulbs.com";
  return content
    .replace(/http:\/\/localhost:3001/g, domain)
    .replace(/http:\/\/127\.0\.0\.1:3001/g, domain);
}
