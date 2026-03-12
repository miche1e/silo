// Runs in MAIN world (page context) - NIP-07: window.nostr
// Cannot use browser.* here; we bridge via postMessage to the content script.

(function () {
  'use strict';
  if (window.nostr) {
    console.log('Silo: window.nostr already defined, skipping');
    return;
  }

  const SCRIPT_RESPONSE = 'silo-nip07-response';
  let id = 0;
  const pending = {};

  window.addEventListener('message', function (ev) {
    const d = ev.data;
    if (!d || d.source !== SCRIPT_RESPONSE || d.id == null || !pending[d.id]) return;
    const p = pending[d.id];
    delete pending[d.id];
    console.log('Silo: received response', { id: d.id, error: d.error, hasResult: !!d.result });
    if (d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
  });

  function getEventHash(event) {
    const data = JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
    return 'sha256-placeholder-' + btoa(data).slice(0, 64);
  }

  function _call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const reqId = ++id;
      pending[reqId] = { resolve, reject };
      console.log('Silo: _call', { reqId, method, params });
      window.postMessage({ source: 'silo-nip07', id: reqId, method, params }, '*');
    });
  }

  window.nostr = {
    getPublicKey: () => _call('get_public_key'),
    signEvent: async (event) => {
      const pubkey = await window.nostr.getPublicKey();
      event.pubkey = pubkey;
      event.created_at = Math.floor(Date.now() / 1000);
      event.id = getEventHash(event);
      return _call('sign_event', event);
    },
    getRelays: () => _call('get_relays'),
    connect: (pubkey, relay) => _call('connect', { pubkey, relay }),
    encrypt: (pubkey, content) => _call('nip04_encrypt', { pubkey, content }),
    decrypt: (pubkey, content) => _call('nip04_decrypt', { pubkey, content }),
    delegate: (delegatePubkey) => _call('delegate', { delegate: delegatePubkey }),
    ping: () => _call('ping').catch(() => false),
  };

  console.log('Silo: window.nostr installed');
  window.dispatchEvent(new CustomEvent('nostr:ready'));
})();
