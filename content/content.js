// Bridge: receives NIP-07 requests from main-world script and forwards to background.
const SCRIPT_SOURCE = 'silo-nip07';
const SCRIPT_RESPONSE = 'silo-nip07-response';

console.log('Silo: bridge loaded');

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.source !== SCRIPT_SOURCE) return;
  const { id, method, params } = event.data;
  console.log('Silo: request', { id, method, params });
  browser.runtime.sendMessage(
    { type: 'NIP46_REQUEST', request: { method, params: params || {} } },
    (response) => {
      const payload = { source: SCRIPT_RESPONSE, id };
      if (browser.runtime.lastError) {
        payload.error = browser.runtime.lastError.message;
        console.warn('Silo: bridge error', browser.runtime.lastError.message);
      } else if (response && response.error) {
        payload.error = response.error;
        console.warn('Silo: backend error', response.error);
      } else {
        payload.result = response;
        console.log('Silo: response', { id, method, result: response });
      }
      window.postMessage(payload, '*');
    }
  );
});
