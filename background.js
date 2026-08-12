// DR Lens — background service worker (Manifest V3)
// Fetches Ahrefs free Domain Rating and draws it into the toolbar icon, per tab.

import { colorFor, domainFromUrl } from "./common.js";

const API = "https://api.ahrefs.com/v3/public/domain-rating-free";
const CACHE_TTL = 24 * 60 * 60 * 1000;   // 24h — DR changes slowly
const ERROR_TTL = 10 * 60 * 1000;        // retry failed lookups after 10 min
const NETWORK_ERROR_TTL = 30 * 1000;     // offline blips recover fast
const FETCH_TIMEOUT = 10 * 1000;
const inFlight = new Map();              // domain -> Promise
const lastHandled = new Map();           // tabId -> last URL we updated for

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

// ---------- Cache ----------
function ttlFor(entry) {
  if (!entry.error) return CACHE_TTL;
  return entry.error === "network" ? NETWORK_ERROR_TTL : ERROR_TTL;
}

async function cacheGet(domain) {
  const key = "dr:" + domain;
  const obj = await chrome.storage.local.get(key);
  const entry = obj[key];
  if (!entry) return null;
  if (Date.now() - entry.t > ttlFor(entry)) return null;
  return entry;
}

async function cacheSet(domain, entry) {
  await chrome.storage.local.set({ ["dr:" + domain]: { ...entry, t: Date.now() } });
}

// Drop expired dr:* entries so storage doesn't grow without bound.
async function cleanupCache() {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const stale = Object.keys(all).filter((k) => {
    if (!k.startsWith("dr:")) return false;
    const entry = all[k];
    return !entry || typeof entry.t !== "number" || now - entry.t > ttlFor(entry);
  });
  if (stale.length) await chrome.storage.local.remove(stale);
}

// ---------- Fetch ----------
// force=true skips both the cache and any in-flight request, so the popup's
// Refresh button always hits the network instead of reusing a stale promise.
async function fetchDR(domain, force = false) {
  if (!force) {
    const cached = await cacheGet(domain);
    if (cached) return cached;

    if (inFlight.has(domain)) return inFlight.get(domain);
  }

  const p = (async () => {
    try {
      const { apiKey } = await chrome.storage.local.get("apiKey");
      // Not cached: the moment the user saves a key, lookups should work.
      if (!apiKey) return { error: "no_key" };
      const res = await fetch(`${API}?target=${encodeURIComponent(domain)}&output=json`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (res.status === 401 || res.status === 403) {
        const entry = { error: "auth" };
        await cacheSet(domain, entry);
        return entry;
      }
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
      // A forced fetch may have replaced our entry; only remove our own.
      if (inFlight.get(domain) === p) inFlight.delete(domain);
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

  // The tab may have navigated elsewhere while we were fetching; don't
  // overwrite the icon with a rating for the previous domain.
  try {
    const tab = await chrome.tabs.get(tabId);
    if (domainFromUrl(tab.url) !== domain) return;
  } catch {
    return; // tab gone
  }

  if (entry.error) {
    if (entry.error === "rate_limited") {
      setIcon(tabId, "!", "#c25555", `DR Lens — rate limited, retrying later (${domain})`);
    } else if (entry.error === "no_key") {
      setIcon(tabId, "!", "#e08a2e", "DR Lens — free Ahrefs API key needed, click for setup");
    } else if (entry.error === "auth") {
      setIcon(tabId, "!", "#e08a2e", "DR Lens — Ahrefs rejected the API key, check it in settings");
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
  // Only the visible tab: background tabs (session restore, middle-clicked
  // links) would burn the anonymous API rate limit. They get their icon via
  // onActivated when the user switches to them.
  if (!tab.active) return;
  // update on navigation start (url change) and on load complete
  if (changeInfo.url || changeInfo.status === "complete") {
    const url = changeInfo.url || tab.url;
    // skip the duplicate "complete" pass when the URL hasn't changed
    if (changeInfo.status === "complete" && lastHandled.get(tabId) === url) return;
    lastHandled.set(tabId, url);
    updateTab(tabId, url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => lastHandled.delete(tabId));

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab) updateTab(tab.id, tab.url);
});

// Popup asks for current data / force refresh; options page reports a key change
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "keyChanged") {
    // The options page already cleared the dr:* cache; redraw the visible
    // tab of every window so stale "key needed" icons don't stick around.
    chrome.tabs.query({ active: true }).then((tabs) => {
      for (const tab of tabs) updateTab(tab.id, tab.url);
    });
    sendResponse({ ok: true });
    return false;
  }
  if (msg?.type !== "getDR" && msg?.type !== "refreshDR") return false;
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
      const entry = await fetchDR(domain, true);
      if (msg.tabId) updateTab(msg.tabId, msg.url);
      sendResponse({ domain, ...entry });
    }
  })();
  return true; // async response
});

// Expired cache entries are skipped on read but still take up storage;
// sweep them once a day.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cache-cleanup") cleanupCache();
});

// Initialize icon for the active tab on startup / install
async function init() {
  chrome.alarms.create("cache-cleanup", { periodInMinutes: 24 * 60 });
  cleanupCache();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) updateTab(tab.id, tab.url);
}
chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
