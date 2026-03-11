// Silo Background - Service Worker for NIP-46 remote signing

const STORAGE_KEY = 'silo_bunker_url_parsed';

// Store active connections
let bunkerConnection = null;

// Initialize
browser.runtime.onInstalled.addListener(() => {
  console.log('Silo extension installed');
});

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);
  
  switch (message.type) {
    case 'BUNKER_CONNECTED':
      handleBunkerConnected(message.bunker);
      break;
      
    case 'BUNKER_DISCONNECTED':
      handleBunkerDisconnected();
      break;
      
    case 'GET_BUNKER':
      getBunker().then(sendResponse);
      return true; // async response
      
    case 'NIP46_REQUEST':
      handleNip46Request(message.request).then(sendResponse);
      return true; // async response
      
    default:
      console.warn('Unknown message type:', message.type);
  }
});

// Handle bunker connection
async function handleBunkerConnected(bunker) {
  console.log('Connecting to bunker:', bunker);
  bunkerConnection = bunker;
  
  // Could establish WebSocket connection to relay here if needed
}

// Handle bunker disconnection
async function handleBunkerDisconnected() {
  console.log('Disconnecting from bunker');
  bunkerConnection = null;
}

// Get current bunker configuration
async function getBunker() {
  if (bunkerConnection) {
    return bunkerConnection;
  }
  
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || null;
  } catch (error) {
    console.error('Failed to get bunker:', error);
    return null;
  }
}

// Handle NIP-46 requests from content script
async function handleNip46Request(request) {
  const bunker = await getBunker();
  
  if (!bunker) {
    throw new Error('No bunker configured');
  }
  
  console.log('NIP-46 request:', request.method);
  
  try {
    // Build the NIP-46 request
    const response = await sendNip46Request(bunker, request);
    return response;
  } catch (error) {
    console.error('NIP-46 request failed:', error);
    throw error;
  }
}

// Send NIP-46 request to bunker
async function sendNip46Request(bunker, request) {
  // NIP-46 uses JSON-RPC over HTTP/WebSocket
  // The bunker should expose an HTTP endpoint
  
  const rpcRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: request.method,
    params: request.params || []
  };
  
  // Determine the bunker endpoint
  // Could be direct HTTP or via a relay
  let endpoint = bunker.url;
  
  // If it's a bunker:// URL, we need to convert to HTTP
  if (bunker.url.startsWith('bunker://')) {
    // Parse the bunker URL
    const parsed = new URL(bunker.url);
    endpoint = `https://${parsed.hostname}/api/nip46`;
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bunker.secret && { 'Authorization': `Bearer ${bunker.secret}` })
      },
      body: JSON.stringify(rpcRequest)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message || 'NIP-46 error');
    }
    
    return result.result;
    
  } catch (error) {
    console.error('NIP-46 request failed:', error);
    throw error;
  }
}

// Example NIP-46 methods that need to be handled:
// - get_public_key
// - sign_event
// -nip04_encrypt
// - nip04_decrypt
// - get_relays
// - connect
// - ping
