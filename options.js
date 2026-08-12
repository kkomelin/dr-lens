// DR Lens - options page: stores the user's Ahrefs API key locally.

const $ = (id) => document.getElementById(id);

async function load() {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (apiKey) $("key").value = apiKey;
}

$("toggle").addEventListener("click", () => {
  const hidden = $("key").type === "password";
  $("key").type = hidden ? "text" : "password";
  $("toggle").textContent = hidden ? "Hide" : "Show";
});

async function save() {
  const key = $("key").value.trim();
  if (key) {
    await chrome.storage.local.set({ apiKey: key });
  } else {
    await chrome.storage.local.remove("apiKey");
  }

  // Drop all cached lookups: entries cached before the key change may be
  // auth/no-data errors that would otherwise linger for their TTL.
  const all = await chrome.storage.local.get(null);
  const drKeys = Object.keys(all).filter((k) => k.startsWith("dr:"));
  if (drKeys.length) await chrome.storage.local.remove(drKeys);

  // Redraw toolbar icons with the new key. The catch matters: sendMessage
  // rejects if the service worker isn't awake to answer.
  try {
    await chrome.runtime.sendMessage({ type: "keyChanged" });
  } catch {
    /* worker asleep; icons refresh on the next tab event */
  }

  $("status").textContent = key ? "Saved" : "Key removed";
  // Close the settings dialog once the save is visible; keep it open after
  // a removal so the instructions stay on screen.
  if (key) {
    setTimeout(() => window.close(), 600);
  } else {
    setTimeout(() => ($("status").textContent = ""), 2000);
  }
}

$("save").addEventListener("click", save);
$("key").addEventListener("keydown", (e) => {
  if (e.key === "Enter") save();
});

load();
