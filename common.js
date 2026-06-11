// DR Lens - shared pure helpers used by both the service worker and the popup.

// ---------- Color / tier scale ----------
export function colorFor(dr) {
  if (dr >= 80) return "#7c5cff"; // elite - purple
  if (dr >= 60) return "#1fa971"; // strong - green
  if (dr >= 40) return "#2f8fd6"; // decent - blue
  if (dr >= 20) return "#e08a2e"; // building - orange
  return "#8a8f9c";               // low - gray
}

export function tierFor(dr) {
  if (dr >= 80) return "Elite - top-tier backlink profile";
  if (dr >= 60) return "Strong - well-established authority";
  if (dr >= 40) return "Decent - solid and growing";
  if (dr >= 20) return "Building - early authority";
  return "Low - just getting started";
}

// ---------- Domain helpers ----------
// TLDs that can never be public websites - local/reserved namespaces.
// All of .arpa is blocked too (infrastructure only, covers home.arpa).
const RESERVED_TLDS = new Set([
  "localhost",
  "local",
  "test",
  "internal",
  "invalid",
  "example",
  "arpa",
]);

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

// Returns the hostname to query DR for, or null when the URL can't have a
// public rating: non-http(s) schemes, localhost and other single-label hosts,
// IP literals, and reserved TLDs. Note: URL.hostname never includes the port,
// so localhost:3000, localhost:8080 etc. all collapse to "localhost" here.
export function domainFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "").replace(/\.$/, "");
    if (host.startsWith("[")) return null; // IPv6 literal, e.g. [::1]
    if (!host.includes(".")) return null;  // localhost, bare intranet names
    if (IPV4_RE.test(host)) return null;
    const tld = host.slice(host.lastIndexOf(".") + 1);
    if (RESERVED_TLDS.has(tld)) return null;
    // Subdomains are passed through as-is: the Ahrefs endpoint resolves them
    // to the registrable domain itself, at the cost of a separate cache entry
    // (proper eTLD+1 collapsing would require the Public Suffix List).
    return host;
  } catch {
    return null;
  }
}
