'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const script = fs.readFileSync('public-language-toggle.js', 'utf8');

test('public landing page exposes an accessible language switch without hiding it on mobile', () => {
  assert.match(html, /id="public-language-toggle"/);
  assert.match(html, /data-i18n-skip="true"/);
  assert.match(html, /public-language-toggle\.js\?v=20261119-language1/);
  assert.match(css, /\.public-language-toggle\{min-width:82px/);
  assert.match(css, /\.navlinks \.public-language-toggle\{display:inline-flex/);
});

test('language toggle offers Arabic from English and asks the existing i18n system to switch', () => {
  const calls = [];
  let onClick;
  const attributes = {};
  const toggle = {
    textContent: '',
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener(name, callback) { if (name === 'click') onClick = callback; }
  };
  const i18n = {
    current: 'en',
    lang() { return this.current; },
    set(next) { calls.push(next); this.current = next; }
  };
  vm.runInNewContext(script, {
    document: { getElementById: id => id === 'public-language-toggle' ? toggle : null },
    window: { IZZY_I18N: i18n }
  });
  assert.equal(toggle.textContent, 'العربية');
  assert.equal(attributes.lang, 'ar');
  assert.equal(attributes['aria-label'], 'Switch to Arabic');
  assert.equal(typeof onClick, 'function');
  onClick();
  assert.deepEqual(calls, ['ar']);
});

test('language toggle offers English from Arabic and keeps its label in the target language', () => {
  const attributes = {};
  const toggle = {
    textContent: '',
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener() {}
  };
  const i18n = { lang: () => 'ar', set() {} };
  vm.runInNewContext(script, {
    document: { getElementById: id => id === 'public-language-toggle' ? toggle : null },
    window: { IZZY_I18N: i18n }
  });
  assert.equal(toggle.textContent, 'English');
  assert.equal(attributes.lang, 'en');
  assert.equal(attributes['aria-label'], 'التبديل إلى الإنجليزية');
});
