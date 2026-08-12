import { colorFor, tierFor } from "./common.js";

const $ = (id) => document.getElementById(id);

function render(res) {
  $("setup").hidden = true;
  if (!res || !res.domain) {
    $("domain").textContent = "No domain on this page";
    $("score").textContent = "·";
    $("score").style.color = "";
    $("tier").textContent = "";
    $("fill").style.width = "0";
    return;
  }
  $("domain").textContent = res.domain;
  if (res.error) {
    const needsKey = res.error === "no_key" || res.error === "auth";
    $("score").textContent = needsKey || res.error === "rate_limited" ? "!" : "?";
    $("score").style.color = needsKey ? "#e08a2e" : "#c25555";
    $("tier").textContent =
      res.error === "rate_limited"
        ? "Rate limited by the API — try again in a few minutes"
        : res.error === "no_key"
          ? "Ahrefs now requires a free API key"
          : res.error === "auth"
            ? "Ahrefs rejected the API key — check it in settings"
            : "Couldn't fetch the rating";
    $("fill").style.width = "0";
    $("setup").hidden = !needsKey;
    return;
  }
  const dr = res.dr;
  const c = colorFor(dr);
  $("score").textContent = dr;
  $("score").style.color = c;
  $("fill").style.background = c;
  $("fill").style.width = dr + "%";
  $("tier").textContent = tierFor(dr);
}

async function load(force) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  $("score").textContent = "…";
  $("score").style.color = "";
  try {
    const res = await chrome.runtime.sendMessage({
      type: force ? "refreshDR" : "getDR",
      url: tab.url,
      tabId: tab.id,
    });
    render(res);
  } catch {
    // service worker unreachable / message channel closed
    $("score").textContent = "?";
    $("score").style.color = "#c25555";
    $("tier").textContent = "Extension error - try reopening the popup";
    $("fill").style.width = "0";
  }
}

$("refresh").addEventListener("click", () => load(true));
$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("setup").addEventListener("click", () => chrome.runtime.openOptionsPage());
load(false);
