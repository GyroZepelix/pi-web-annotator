(function (root, factory) {
  const constants = root.PiAnnotatorConstants || (typeof require === "function" ? require("./constants.js") : null);
  const api = factory(constants);
  root.PiAnnotatorSelectors = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants) {
  "use strict";

  if (!constants) throw new Error("PiAnnotatorConstants is required");
  const { LIMITS } = constants;
  const SAFE_ATTRIBUTE = /^(?:id|class|role|name|type|alt|title|data-testid|aria-[a-z0-9_.:-]+)$/i;
  const FORBIDDEN_ELEMENTS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
  const FORBIDDEN_ATTRIBUTES = /^(?:on|value$|checked$|selected$|style$|srcdoc$|nonce$)/i;

  function bounded(value, maximum) {
    const characters = Array.from(String(value || ""));
    return { value: characters.slice(0, maximum).join(""), truncated: characters.length > maximum };
  }

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return String(value).replace(/(^-?\d)|[^a-zA-Z0-9_-]/g, (match, digit) => digit ? `\\3${digit} ` : `\\${match}`);
  }

  function cssSelector(element) {
    if (element.id) return bounded(`#${cssEscape(element.id)}`, LIMITS.selectorCharacters);
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1) {
      let part = current.localName;
      if (!part) break;
      const parent = current.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((child) => child.localName === current.localName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      const candidate = parts.join(" > ");
      if (candidate.length >= LIMITS.selectorCharacters || current === current.ownerDocument.documentElement) break;
      current = parent;
    }
    return bounded(parts.join(" > "), LIMITS.selectorCharacters);
  }

  function xpathLiteral(value) {
    if (!value.includes('"')) return `"${value}"`;
    if (!value.includes("'")) return `'${value}'`;
    return `concat(${value.split('"').map((part, index, all) => `${index ? ', \'"\', ' : ''}"${part}"${index === all.length - 1 ? "" : ""}`).join("")})`;
  }

  function xpathSelector(element) {
    if (element.id) return bounded(`//*[@id=${xpathLiteral(element.id)}]`, LIMITS.selectorCharacters);
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1) {
      const parent = current.parentElement;
      let index = 1;
      if (parent) {
        for (const sibling of parent.children) {
          if (sibling === current) break;
          if (sibling.localName === current.localName) index += 1;
        }
      }
      parts.unshift(`${current.localName}[${index}]`);
      current = parent;
    }
    return bounded(`/${parts.join("/")}`, LIMITS.selectorCharacters);
  }

  function safeAttributes(element) {
    const items = {};
    let truncated = false;
    for (const attribute of Array.from(element.attributes || [])) {
      const name = attribute.name.toLowerCase();
      if (!SAFE_ATTRIBUTE.test(name) || FORBIDDEN_ATTRIBUTES.test(name) || name.startsWith("data-pi-web-annotator")) continue;
      if (Object.keys(items).length >= LIMITS.attributeCount) {
        truncated = true;
        break;
      }
      items[name] = bounded(attribute.value, LIMITS.attributeValueCharacters);
    }
    return { items, truncated };
  }

  function sanitizedOuterHtml(element) {
    const clone = element.cloneNode(true);
    const descendants = [clone, ...Array.from(clone.querySelectorAll("*"))];
    for (const node of descendants) {
      if (FORBIDDEN_ELEMENTS.has(node.tagName)) {
        if (node === clone) return bounded(`<${element.localName}></${element.localName}>`, LIMITS.outerHtmlCharacters);
        node.remove();
        continue;
      }
      for (const attribute of Array.from(node.attributes || [])) {
        if (!SAFE_ATTRIBUTE.test(attribute.name) || FORBIDDEN_ATTRIBUTES.test(attribute.name) || attribute.name.startsWith("data-pi-web-annotator")) {
          node.removeAttribute(attribute.name);
        }
      }
      if (["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(node.tagName)) node.textContent = "";
    }
    return bounded(clone.outerHTML, LIMITS.outerHtmlCharacters);
  }

  function isSelectable(element) {
    return Boolean(element && element.nodeType === 1 && !FORBIDDEN_ELEMENTS.has(element.tagName) && !element.closest("[data-pi-web-annotator-control]"));
  }

  function safeVisibleText(element, view) {
    if (["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(element.tagName)) return "";
    const source = view || window;
    const document = element.ownerDocument;
    const nodeFilter = source.NodeFilter || globalThis.NodeFilter;
    if (!document || !nodeFilter || typeof document.createTreeWalker !== "function") return "";
    const walker = document.createTreeWalker(element, nodeFilter.SHOW_TEXT);
    const pieces = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest("input, textarea, select, option, script, style, noscript, template, [data-pi-web-annotator-control]")) continue;
      if (typeof source.getComputedStyle === "function") {
        const style = source.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") continue;
      }
      pieces.push(node.nodeValue || "");
    }
    return pieces.join(" ").replace(/\s+/g, " ").trim();
  }

  function captureTarget(element, view) {
    if (!isSelectable(element)) throw new Error("This element cannot be annotated.");
    const rect = element.getBoundingClientRect();
    const source = view || window;
    const visibleText = safeVisibleText(element, source);
    return {
      css: cssSelector(element),
      xpath: xpathSelector(element),
      tag_name: element.localName.toLowerCase(),
      visible_text: bounded(visibleText, LIMITS.visibleTextCharacters),
      attributes: safeAttributes(element),
      outer_html: sanitizedOuterHtml(element),
      bounding_rect: {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left
      },
      scroll: { x: Math.max(0, source.scrollX || 0), y: Math.max(0, source.scrollY || 0) },
      viewport: { width: source.innerWidth, height: source.innerHeight },
      device_pixel_ratio: source.devicePixelRatio || 1
    };
  }

  return Object.freeze({ bounded, captureTarget, cssSelector, isSelectable, safeAttributes, safeVisibleText, sanitizedOuterHtml, xpathSelector });
});
