// Silo Background - NIP-46 via nostr-tools (BunkerSigner.fromBunker + connect)
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import { SimplePool } from 'nostr-tools/pool';

const STORAGE_KEY = 'silo_bunker_url_parsed';
const LOCAL_SECRET_KEY = 'silo_local_secret';

let bunkerSigner = null;
let pool = null;

browser.runtime.onInstalled.addListener(async () => {
  console.log('Silo extension installed');
  const result = await browser.storage.local.get(LOCAL_SECRET_KEY);
  if (!result[LOCAL_SECRET_KEY]) {
    const secretKey = generateSecretKey();
    await browser.storage.local.set({
      [LOCAL_SECRET_KEY]: Array.from(secretKey).join(',')
    });
  }
});

async function getLocalSecretKey() {
  const result = await browser.storage.local.get(LOCAL_SECRET_KEY);
  if (!result[LOCAL_SECRET_KEY]) throw new Error('No local secret key');
  return new Uint8Array(result[LOCAL_SECRET_KEY].split(',').map(Number));
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);
  switch (message.type) {
    case 'BUNKER_CONNECTED':
      handleBunkerConnected(message.bunker).then(sendResponse).catch((e) => sendResponse({ error: e.message }));
      return true;
    case 'BUNKER_DISCONNECTED':
      handleBunkerDisconnected();
      break;
    case 'GET_BUNKER':
      getBunker().then(sendResponse);
      return true;
    case 'NIP46_REQUEST':
      handleNip46Request(message.request).then(sendResponse).catch((e) => sendResponse({ error: e.message }));
      return true;
    default:
      console.warn('Unknown message type:', message.type);
  }
});

async function handleBunkerConnected(bunker) {
  console.log('Connecting to bunker:', bunker);
  // Persist config first so ensureBunkerConnected() can restore after service worker restart
  await browser.storage.local.set({ [STORAGE_KEY]: bunker });
  try {
    const localSecret = await getLocalSecretKey();
    if (!pool) pool = new SimplePool();

    const bp = await parseBunkerInput(bunker.url);
    if (!bp) throw new Error('Invalid bunker URL');

    if (bunker.relay) bp.relays = [bunker.relay];
    if (bunker.secret != null) bp.secret = bunker.secret;

    bunkerSigner = BunkerSigner.fromBunker(localSecret, bp, {
      pool,
      onauth: (url) => {
        browser.tabs.create({ url }).catch(() => {});
      }
    });
    await bunkerSigner.connect();

    console.log('Connected to bunker successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to connect to bunker:', error);
    throw error;
  }
}

async function handleBunkerDisconnected() {
  console.log('Disconnecting from bunker');
  if (bunkerSigner) {
    await bunkerSigner.close();
    bunkerSigner = null;
  }
  if (pool) {
    pool.close([]);
    pool = null;
  }
  await browser.storage.local.remove(STORAGE_KEY).catch(() => {});
}

async function getBunker() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

/** Reconnect from stored config when service worker was restarted (bunkerSigner is null). */
async function ensureBunkerConnected() {
  if (bunkerSigner) return;
  const bunker = await getBunker();
  if (!bunker) throw new Error('No bunker configured. Please connect first.');
  await handleBunkerConnected(bunker);
}

function paramsToArray(method, params) {
  if (Array.isArray(params)) return params;
  if (params == null || typeof params !== 'object') return [];
  if (method === 'sign_event') return [params];
  if (method === 'nip04_encrypt' && params.pubkey != null) return [params.pubkey, params.content];
  if (method === 'nip04_decrypt' && params.pubkey != null) return [params.pubkey, params.content];
  if (method === 'connect') return [params.pubkey, params.relay].filter((x) => x != null);
  if (method === 'delegate' && params.delegate != null) return [params.delegate];
  return [];
}

async function handleNip46Request(request) {
  await ensureBunkerConnected();
  const { method, params } = request;
  const p = paramsToArray(method, params);

  switch (method) {
    case 'get_public_key':
      return await bunkerSigner.getPublicKey();
    case 'sign_event':
      return await bunkerSigner.signEvent(p[0]);
    case 'get_relays':
      return await bunkerSigner.bp.relays;
    case 'nip04_encrypt':
      return await bunkerSigner.nip04Encrypt(p[0], p[1]);
    case 'nip04_decrypt':
      return await bunkerSigner.nip04Decrypt(p[0], p[1]);
    case 'connect':
      return { success: true };
    case 'ping':
      try {
        await bunkerSigner.ping();
        return true;
      } catch {
        return false;
      }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
