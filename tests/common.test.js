// Run with: npm test (or: node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { colorFor, tierFor, domainFromUrl } from "../common.js";

test("domainFromUrl: normal sites", () => {
  assert.equal(domainFromUrl("https://example.com/page"), "example.com");
  assert.equal(domainFromUrl("http://example.com"), "example.com");
  assert.equal(domainFromUrl("https://www.example.com"), "example.com");
  assert.equal(domainFromUrl("https://blog.example.com"), "blog.example.com");
  assert.equal(domainFromUrl("https://example.co.uk/a?b=c"), "example.co.uk");
  assert.equal(domainFromUrl("https://example.com."), "example.com"); // trailing dot
});

test("domainFromUrl: non-http(s) schemes", () => {
  assert.equal(domainFromUrl("chrome://extensions"), null);
  assert.equal(domainFromUrl("about:blank"), null);
  assert.equal(domainFromUrl("file:///tmp/index.html"), null);
  assert.equal(domainFromUrl("ftp://example.com"), null);
  assert.equal(domainFromUrl("not a url"), null);
  assert.equal(domainFromUrl(undefined), null);
});

test("domainFromUrl: localhost on any port", () => {
  assert.equal(domainFromUrl("http://localhost"), null);
  assert.equal(domainFromUrl("http://localhost:3000"), null);
  assert.equal(domainFromUrl("http://localhost:8080/app"), null);
  assert.equal(domainFromUrl("https://localhost:5173"), null);
  assert.equal(domainFromUrl("http://www.localhost"), null);
});

test("domainFromUrl: IP literals", () => {
  assert.equal(domainFromUrl("http://127.0.0.1"), null);
  assert.equal(domainFromUrl("http://127.0.0.1:8000"), null);
  assert.equal(domainFromUrl("http://192.168.1.1"), null);
  assert.equal(domainFromUrl("http://10.0.0.5:3000"), null);
  assert.equal(domainFromUrl("http://[::1]:8080"), null);
  assert.equal(domainFromUrl("http://[2001:db8::1]"), null);
});

test("domainFromUrl: single-label and reserved hosts", () => {
  assert.equal(domainFromUrl("http://intranet"), null);
  assert.equal(domainFromUrl("http://myserver:8080"), null);
  assert.equal(domainFromUrl("http://app.local"), null);
  assert.equal(domainFromUrl("http://site.test"), null);
  assert.equal(domainFromUrl("http://service.internal"), null);
  assert.equal(domainFromUrl("http://router.home.arpa"), null);
  assert.equal(domainFromUrl("http://foo.localhost"), null);
  assert.equal(domainFromUrl("http://thing.invalid"), null);
  assert.equal(domainFromUrl("http://demo.example"), null);
});

test("colorFor: tier boundaries", () => {
  assert.equal(colorFor(100), "#7c5cff");
  assert.equal(colorFor(80), "#7c5cff");
  assert.equal(colorFor(79), "#1fa971");
  assert.equal(colorFor(60), "#1fa971");
  assert.equal(colorFor(59), "#2f8fd6");
  assert.equal(colorFor(40), "#2f8fd6");
  assert.equal(colorFor(39), "#e08a2e");
  assert.equal(colorFor(20), "#e08a2e");
  assert.equal(colorFor(19), "#8a8f9c");
  assert.equal(colorFor(0), "#8a8f9c");
});

test("tierFor: matches colorFor boundaries", () => {
  assert.match(tierFor(80), /^Elite/);
  assert.match(tierFor(60), /^Strong/);
  assert.match(tierFor(40), /^Decent/);
  assert.match(tierFor(20), /^Building/);
  assert.match(tierFor(0), /^Low/);
});
