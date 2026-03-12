// Bridge: receives NIP-07 requests from main-world script and forwards to background.
const SCRIPT_SOURCE = 'silo-nip07';
const SCRIPT_RESPONSE = 'silo-nip07-response';

console.log('Silo: bridge loaded');

function reply(id, error, result) {
  try {
    window.postMessage({ source: SCRIPT_RESPONSE, id, error, result }, '*');
  } catch (_) {}
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.source !== SCRIPT_SOURCE) return;
  const { id, method, params } = event.data;
  console.log('Silo: request', { id, method, params });
  try {
    if (!browser?.runtime?.id) {
      reply(id, 'Extension context invalidated. Reload the page.');
      return;
    }
    browser.runtime.sendMessage({ type: 'NIP46_REQUEST', request: { method, params: params || {} } })
      .then((response) => {
        if (response && response.error) {
          reply(id, response.error);
          console.warn('Silo: backend error', response.error);
        } else {
          reply(id, null, response);
          console.log('Silo: response', { id, method, result: response });
        }
      })
      .catch((e) => {
        reply(id, e.message || 'Extension context invalidated. Reload the page.');
        console.warn('Silo: sendMessage failed', e);
      });
  } catch (e) {
    reply(id, e.message || 'Extension context invalidated. Reload the page.');
    console.warn('Silo: sendMessage failed', e);
  }
});
