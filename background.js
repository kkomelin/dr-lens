// DR Lens — background service worker (Manifest V3)
// Fetches Ahrefs free Domain Rating and draws it into the toolbar icon, per tab.

const API = "https://api.ahrefs.com/v3/public/domain-rating-free";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — DR changes slowly
const ERROR_TTL = 10 * 60 * 1000;      // retry failed lookups after 10 min
const inFlight = new Map();            // domain -> Promise

// ---------- Color scale ----------
function colorFor(dr) {
  if (dr >= 80) return "#7c5cff"; // elite — purple
  if (dr >= 60) return "#1fa971"; // strong — green
  if (dr >= 40) return "#2f8fd6"; // decent — blue
  if (dr >= 20) return "#e08a2e"; // building — orange
  return "#8a8f9c";               // low — gray
}

// ---------- Icon drawing ----------
function drawIcon(text, bg) {
  const sizes = [16, 32];
  const imageData = {};
  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");

    // rounded square background
    const r = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();

    // number
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // shrink font for 3-char strings like "100"
    const base = text.length >= 3 ? 0.52 : text.length === 2 ? 0.64 : 0.72;
    ctx.font = `bold ${Math.round(size * base)}px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`;
    ctx.fillText(text, size / 2, size / 2 + size * 0.04);

    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  return imageData;
}

function setIcon(tabId, text, bg, title) {
  chrome.action.setIcon({ tabId, imageData: drawIcon(text, bg) }).catch(() => {});
  if (title) chrome.action.setTitle({ tabId, title }).catch(() => {});
}

function setIdle(tabId, title) {
  setIcon(tabId, "·", "#262a36", title || "DR Lens — no domain here");
}

// ---------- Domain helpers ----------
function domainFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ---------- Cache ----------
async function cacheGet(domain) {
  const key = "dr:" + domain;
  const obj = await chrome.storage.local.get(key);
  const entry = obj[key];
  if (!entry) return null;
  const ttl = entry.error ? ERROR_TTL : CACHE_TTL;
  if (Date.now() - entry.t > ttl) return null;
  return entry;
}

async function cacheSet(domain, entry) {
  await chrome.storage.local.set({ ["dr:" + domain]: { ...entry, t: Date.now() } });
}

// ---------- Fetch ----------
async function fetchDR(domain) {
  const cached = await cacheGet(domain);
  if (cached) return cached;

  if (inFlight.has(domain)) return inFlight.get(domain);

  const p = (async () => {
    try {
      const res = await fetch(`${API}?target=${encodeURIComponent(domain)}&output=json`, {
        headers: { Accept: "application/json" },
      });
      if (res.status === 429) {
        const entry = { error: "rate_limited" };
        await cacheSet(domain, entry);
        return entry;
      }
      if (!res.ok) {
        const entry = { error: "http_" + res.status };
        await cacheSet(domain, entry);
        return entry;
      }
      const data = await res.json();
      const dr = Math.round(data?.domain_rating?.domain_rating ?? NaN);
      if (Number.isNaN(dr)) {
        const entry = { error: "no_data" };
        await cacheSet(domain, entry);
        return entry;
      }
      const entry = { dr };
      await cacheSet(domain, entry);
      return entry;
    } catch {
      const entry = { error: "network" };
      await cacheSet(domain, entry);
      return entry;
    } finally {
      inFlight.delete(domain);
    }
  })();

  inFlight.set(domain, p);
  return p;
}

// ---------- Main update ----------
async function updateTab(tabId, url) {
  const domain = domainFromUrl(url);
  if (!domain) {
    setIdle(tabId);
    return;
  }

  // show a "loading" state only if nothing cached
  const cached = await cacheGet(domain);
  if (!cached) setIcon(tabId, "…", "#262a36", `DR Lens — checking ${domain}`);

  const entry = await fetchDR(domain);

  if (entry.error) {
    if (entry.error === "rate_limited") {
      setIcon(tabId, "!", "#c25555", `DR Lens — rate limited, retrying later (${domain})`);
    } else {
      setIcon(tabId, "?", "#5a5f6e", `DR Lens — couldn't fetch DR for ${domain}`);
    }
    return;
  }

  setIcon(tabId, String(entry.dr), colorFor(entry.dr), `${domain} — Domain Rating ${entry.dr}`);
}

async function refreshActiveTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url) await updateTab(tabId, tab.url);
  } catch {
    /* tab gone */
  }
}

// ---------- Events ----------
chrome.tabs.onActivated.addListener(({ tabId }) => refreshActiveTab(tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // update on navigation start (url change) and on load complete
  if (changeInfo.url || changeInfo.status === "complete") {
    updateTab(tabId, changeInfo.url || tab.url);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab) updateTab(tab.id, tab.url);
});

// Popup asks for current data / force refresh
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "getDR") {
      const domain = domainFromUrl(msg.url);
      if (!domain) return sendResponse({ domain: null });
      const entry = await fetchDR(domain);
      sendResponse({ domain, ...entry });
    } else if (msg.type === "refreshDR") {
      const domain = domainFromUrl(msg.url);
      if (!domain) return sendResponse({ domain: null });
      await chrome.storage.local.remove("dr:" + domain);
      const entry = await fetchDR(domain);
      if (msg.tabId) updateTab(msg.tabId, msg.url);
      sendResponse({ domain, ...entry });
    }
  })();
  return true; // async response
});

// Initialize icon for the active tab on startup / install
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) updateTab(tab.id, tab.url);
}
chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
