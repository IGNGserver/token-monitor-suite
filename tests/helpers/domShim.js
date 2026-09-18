// Minimal DOM shim so the shared UI's plain-JS modules can be unit-tested
// without pulling a browser environment into the test suite.
//
// It deliberately implements only what the shared UI actually touches: element
// identity via getElementById, classList, dataset, text/HTML assignment, and
// event registration. Anything a test does not exercise is left as a no-op so a
// new call site fails loudly in the test using it rather than silently passing.

function createClassList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
    toggle: (name, force) => {
      const next = force === undefined ? !classes.has(name) : Boolean(force);
      if (next) classes.add(name);
      else classes.delete(name);
      return next;
    },
    contains: (name) => classes.has(name),
    get size() { return classes.size; },
    toString: () => [...classes].join(' ')
  };
}

function createElement(tagName, id = '') {
  const listeners = new Map();
  const element = {
    tagName: String(tagName || 'div').toUpperCase(),
    id,
    dataset: {},
    style: {
      _props: new Map(),
      setProperty(name, value) { this._props.set(name, value); },
      getPropertyValue(name) { return this._props.get(name) ?? ''; },
      removeProperty(name) { this._props.delete(name); }
    },
    hidden: false,
    disabled: false,
    value: '',
    checked: false,
    children: [],
    parentNode: null,
    _text: '',
    _html: '',
    set textContent(value) { this._text = value === undefined || value === null ? '' : String(value); },
    get textContent() { return this._text; },
    set innerHTML(value) { this._html = value === undefined || value === null ? '' : String(value); },
    get innerHTML() { return this._html; },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      const type = typeof event === 'string' ? event : event?.type;
      for (const handler of listeners.get(type) || []) handler.call(this, event);
      return true;
    },
    setAttribute(name, value) { this[name] = value; },
    getAttribute(name) { return this[name] === undefined ? null : this[name]; },
    removeAttribute(name) { delete this[name]; },
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); return node; },
    insertBefore(node) { this.children.push(node); return node; },
    replaceChildren(...nodes) { this.children = nodes; this._html = ''; },
    remove() {},
    contains() { return false },
    matches() { return false },
    closest() { return null },
    querySelector() { return null },
    querySelectorAll() { return [] },
    focus() {},
    blur() {},
    scrollIntoView() {},
    scrollTo() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  };
  element.classList = createClassList();
  return element;
}

/**
 * Install a document/window/etc. onto a target object (default: globalThis).
 * Returns the created document so a test can reach specific elements.
 */
function installDom(target = globalThis) {
  const elements = new Map();
  const document = {
    documentElement: createElement('html'),
    body: createElement('body'),
    title: '',
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement('div', id));
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    createElement: (tag) => createElement(tag),
    createTextNode: (text) => ({ textContent: String(text) })
  };
  document.documentElement.dataset = {};

  const store = () => {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => { map.set(key, String(value)); },
      removeItem: (key) => { map.delete(key); },
      _map: map
    };
  };

  target.document = document;
  target.window = target;
  target.history = { pushState() {}, replaceState() {} };
  target.location = { pathname: '/', search: '', hash: '', origin: 'http://localhost', host: 'localhost' };
  target.localStorage = store();
  target.sessionStorage = store();
  target.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  target.addEventListener = () => {};
  target.removeEventListener = () => {};
  target.requestAnimationFrame = () => 0;
  target.cancelAnimationFrame = () => {};
  target.setTimeout = target.setTimeout || setTimeout;
  return document;
}

module.exports = { installDom, createElement };
