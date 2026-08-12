# Changelog

## 1.1.0 - 2026-08-12

- Ahrefs now requires a free API key for Domain Rating lookups (the previously
  keyless endpoint started returning 403), so ratings stopped working. Get a
  free key at [Account settings -> API keys](https://app.ahrefs.com/account/api-keys)
  and paste it into the extension settings.
- New settings page storing the key on your device only; it is sent only to
  `api.ahrefs.com`.
- The toolbar icon and popup now show "key needed" and "key rejected" states
  with a Set API key button; the popup gains a settings gear.

## 1.0.1 - 2026-06-14

- Info popover in the popup explaining what Domain Rating is.

## 1.0.0 - 2026-06-11

- Initial release: DR of the current site drawn into the toolbar icon per tab,
  color-coded by tier; popup with exact score, tier description, and Refresh;
  24-hour local cache; local and private hosts never sent to the API.
