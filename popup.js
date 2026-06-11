function colorFor(dr) {
  if (dr >= 80) return "#7c5cff";
  if (dr >= 60) return "#1fa971";
  if (dr >= 40) return "#2f8fd6";
  if (dr >= 20) return "#e08a2e";
  return "#8a8f9c";
}

function tierFor(dr) {
  if (dr >= 80) return "Elite — top-tier backlink profile";
  if (dr >= 60) return "Strong — well-established authority";
  if (dr >= 40) return "Decent — solid and growing";
  if (dr >= 20) return "Building — early authority";
  return "Low — just getting started";
}

const $ = (id) => document.getElementById(id);

function render(res) {
  if (!res || !res.domain) {
    $("domain").textContent = "No domain on this page";
    $("score").textContent = "·";
    $("tier").textContent = "";
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
  const res = await chrome.runtime.sendMessage({
    type: force ? "refreshDR" : "getDR",
    url: tab.url,
    tabId: tab.id,
  });
  render(res);
}

$("refresh").addEventListener("click", () => load(true));
load(false);
