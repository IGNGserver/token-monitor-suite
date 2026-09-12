'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  QODER_COOKIE_CAPTURE_ERROR,
  parseQoderCookieHeader,
  parseQoderCookieInput,
  parseQoderCurlCommand,
  parseQoderHttpRequest,
  qoderCookieCaptureCapabilities
} = require('../../src/shared/qoderCookieCapture');

test('Qoder cookie capture accepts a plain Cookie header and infers the selected site', () => {
  assert.deepEqual(parseQoderCookieHeader('Cookie: session=abc; csrf=xyz', { site: 'cn' }), {
    cookie: 'session=abc; csrf=xyz',
    site: 'cn',
    source: 'manual'
  });
});

test('Qoder cookie capture accepts constrained curl and HTTP request forms', () => {
  const curl = parseQoderCurlCommand(
    "curl 'https://qoder.com/account/usage' -H 'Cookie: session=abc' -H 'Accept: application/json' --compressed"
  );
  assert.equal(curl.cookie, 'session=abc');
  assert.equal(curl.site, 'global');

  const parentDomainCurl = parseQoderCurlCommand(
    "curl 'https://qoder.com/account/usage' -H 'Host: .qoder.com' -H 'Cookie: session=parent'"
  );
  assert.equal(parentDomainCurl.cookie, 'session=parent');
  assert.equal(parentDomainCurl.site, 'global');

  const request = parseQoderHttpRequest([
    'GET /api/v2/me/usages/big_model_credits HTTP/1.1',
    'Host: .qoder.com.cn',
    'Cookie: session=cn-cookie',
    '',
    ''
  ].join('\r\n'));
  assert.deepEqual(request, {
    cookie: 'session=cn-cookie',
    site: 'cn',
    source: 'manual-http',
    host: 'qoder.com.cn'
  });
});

test('Qoder cookie capture rejects unsafe or ambiguous inputs without echoing secrets', () => {
  const rejected = [
    () => parseQoderCookieInput('curl https://qoder.com -H "Cookie: session=abc"; touch /tmp/pwned'),
    () => parseQoderCurlCommand('curl https://qoder.com https://qoder.com.cn -b session=abc'),
    () => parseQoderCurlCommand('curl https://evil-qoder.com -b session=abc'),
    () => parseQoderCurlCommand('curl https://qoder.com -d session=abc'),
    () => parseQoderHttpRequest('GET https://qoder.com/account HTTP/1.1\nHost: qoder.com.cn\nCookie: session=abc\n\n'),
    () => parseQoderCookieHeader('Cookie: session=abc', { site: 'https://evil-qoder.com' })
  ];
  for (const action of rejected) {
    assert.throws(action, (error) => {
      assert.equal(error.code, QODER_COOKIE_CAPTURE_ERROR);
      assert.doesNotMatch(error.message, /session=abc|evil-qoder/);
      return true;
    });
  }
});

test('Qoder automatic capture is declared only for macOS Chrome', () => {
  assert.deepEqual(qoderCookieCaptureCapabilities('linux'), { manual: true, auto: false, browser: null });
  assert.deepEqual(qoderCookieCaptureCapabilities('darwin'), { manual: true, auto: true, browser: 'chrome' });
});
