# DR Lens - Privacy Policy

Last updated: 2026-06-11

## What the extension does

DR Lens shows the Ahrefs Domain Rating of the website in the current browser tab.
To do that, it needs to know the hostname of the page you are viewing.

## Data that leaves your browser

- When you visit a public website in the active tab, the extension sends the
  **hostname only** (for example `example.com`) to the Ahrefs API at
  `api.ahrefs.com` to look up its Domain Rating. The full URL, page path, query
  parameters, page content, and your identity are never sent.
- Lookups are cached locally for 24 hours, so repeat visits to the same domain
  do not trigger new requests.
- Local and private hosts are never sent anywhere: `localhost` (on any port),
  IP addresses, single-label intranet names, and reserved namespaces such as
  `.local`, `.test`, `.internal`, and `.home.arpa` are filtered out before any
  network request.
- Only the visible (active) tab triggers lookups. Background tabs do not.

Ahrefs receives these hostname lookups as the API operator. Their handling of
requests is governed by the [Ahrefs privacy policy](https://ahrefs.com/privacy).

## Data stored locally

- Cached ratings (`domain -> rating, timestamp`) in `chrome.storage.local` on
  your device. Expired entries are deleted automatically once a day.

## What the extension does NOT do

- No analytics, tracking, or telemetry of any kind.
- No collection of browsing history. URLs are read in memory solely to derive
  the hostname and are not stored or transmitted.
- No accounts, no cookies, no fingerprinting.
- No data is sold or shared with anyone other than the API request described
  above.

## Contact

Questions about this policy: open an issue at
https://github.com/kkomelin/dr-lens/issues
