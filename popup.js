import { colorFor, tierFor } from "./common.js";

const $ = (id) => document.getElementById(id);

function render(res) {
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
    $("score").textContent = res.error === "rate_limited" ? "!" : "?";
    $("score").style.color = "#c25555";
    $("tier").textContent =
      res.error === "rate_limited"
        ? "Rate limited by the API — try again in a few minutes"
        : "Couldn't fetch the rating";
    $("fill").style.width = "0";
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
load(false);
