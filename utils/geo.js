// utils/geo.js
// simple geo lookup using ipapi.co (no API key). Node 18+ has global fetch.
export async function lookupGeo(ip) {
  try {
    if (!ip || ip === "unknown") return { country_name: "Unknown", city: "Unknown", region: "" };

    // some private/local IPs will fail; avoid calling API for them
    if (
      ip.startsWith("127.") ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("172.") ||
      ip === "::1"
    ) {
      return { country_name: "Local", city: "Local", region: "" };
    }

    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { timeout: 5000 });
    if (!res.ok) return { country_name: "Unknown", city: "Unknown", region: "" };
    const json = await res.json();
    return json || { country_name: "Unknown", city: "Unknown", region: "" };
  } catch (e) {
    // network / rate limit / parse error
    return { country_name: "Unknown", city: "Unknown", region: "" };
  }
}
