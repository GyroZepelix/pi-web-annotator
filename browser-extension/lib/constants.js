(function (root, factory) {
  const api = factory();
  root.PiAnnotatorConstants = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  return Object.freeze({
    STATE_KEY: "piWebAnnotatorSessionV1",
    STATE_VERSION: 1,
    GENERATOR_NAME: "pi-web-annotator",
    GENERATOR_VERSION: "0.1.0",
    BRIDGE_URL: "http://127.0.0.1:43127/",
    BRIDGE_PROTOCOL_VERSION: 1,
    EXTENSION_ID: "kemcbalaoccidjnoggajcgjhjlpibbkg",
    EXTENSION_ORIGIN: "chrome-extension://kemcbalaoccidjnoggajcgjhjlpibbkg",
    LIMITS: Object.freeze({
      commentCharacters: 4000,
      visibleTextCharacters: 2000,
      outerHtmlCharacters: 16000,
      selectorCharacters: 2000,
      attributeCount: 32,
      attributeValueCharacters: 500,
      annotations: 100,
      imageBytes: 2_500_000,
      totalImageBytes: 5_000_000,
      bundleBytes: 7_000_000,
      bridgePayloadBytes: 9_500_000,
      sessionStorageBudgetBytes: 9_000_000
    })
  });
});
