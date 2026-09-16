"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Selectors = require("../../browser-extension/lib/selectors.js");
const { LIMITS } = require("../../browser-extension/lib/constants.js");

test("captured attribute evidence uses an explicit privacy-aware allowlist", () => {
  const element = {
    attributes: [
      { name: "id", value: "account-form" },
      { name: "aria-label", value: "Account" },
      { name: "data-testid", value: "account" },
      { name: "value", value: "private current value" },
      { name: "onclick", value: "sendSecrets()" },
      { name: "style", value: "background:url(secret)" },
      { name: "href", value: "https://example.test/?token=secret" },
      { name: "data-pi-web-annotator-control", value: "true" }
    ]
  };
  assert.deepEqual(Selectors.safeAttributes(element), {
    items: {
      id: { value: "account-form", truncated: false },
      "aria-label": { value: "Account", truncated: false },
      "data-testid": { value: "account", truncated: false }
    },
    truncated: false
  });
});

test("visible text omits descendant form values and hidden text", () => {
  const publicParent = { closest: () => null };
  const formParent = { closest: (selector) => selector.includes("textarea") ? {} : null };
  const hiddenParent = { closest: () => null };
  const nodes = [
    { nodeValue: "Visible label", parentElement: publicParent },
    { nodeValue: "private current value", parentElement: formParent },
    { nodeValue: "hidden copy", parentElement: hiddenParent }
  ];
  const document = {
    createTreeWalker() {
      let index = 0;
      return { nextNode: () => nodes[index++] || null };
    }
  };
  const view = {
    NodeFilter: { SHOW_TEXT: 4 },
    getComputedStyle(parent) {
      return { display: parent === hiddenParent ? "none" : "block", visibility: "visible" };
    }
  };
  assert.equal(Selectors.safeVisibleText({ tagName: "DIV", ownerDocument: document }, view), "Visible label");
  assert.equal(Selectors.safeVisibleText({ tagName: "TEXTAREA", ownerDocument: document }, view), "");
});

test("bounded captured strings mark truncation explicitly", () => {
  const result = Selectors.bounded("x".repeat(LIMITS.visibleTextCharacters + 1), LIMITS.visibleTextCharacters);
  assert.equal(result.value.length, LIMITS.visibleTextCharacters);
  assert.equal(result.truncated, true);
});

test("attribute count and values are bounded with explicit markers", () => {
  const attributes = Array.from({ length: LIMITS.attributeCount + 1 }, (_, index) => ({
    name: `aria-label${index}`,
    value: "x".repeat(LIMITS.attributeValueCharacters + 1)
  }));
  const result = Selectors.safeAttributes({ attributes });
  assert.equal(Object.keys(result.items).length, LIMITS.attributeCount);
  assert.equal(result.truncated, true);
  assert.equal(result.items["aria-label0"].truncated, true);
});
