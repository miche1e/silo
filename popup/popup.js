// Silo Popup - Handles NIP-46 bunker configuration

const STATUS_CONNECTED = 'connected';
const STATUS_DISCONNECTED = 'disconnected';
const STORAGE_KEY = 'silo_bunker_url';

// DOM elements
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const bunkerInput = document.getElementById('bunker-url');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Silo popup: DOMContentLoaded');
  await loadConfig();
  setupEventListeners();
  console.log('Silo popup: init done');
});

// Load saved configuration
async function loadConfig() {
  try {
    console.log('Silo popup: loadConfig');
    const result = await browser.storage.local.get(STORAGE_KEY);
    const bunkerUrl = result[STORAGE_KEY];
    console.log('Silo popup: loadConfig result', { hasBunkerUrl: !!bunkerUrl });
    if (bunkerUrl) {
      bunkerInput.value = bunkerUrl;
      setStatus(STATUS_CONNECTED, 'Connected to remote signer');
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'block';
    } else {
      setStatus(STATUS_DISCONNECTED, 'Not configured');
      connectBtn.style.display = 'block';
      disconnectBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Silo popup: loadConfig failed', error);
    setStatus(STATUS_DISCONNECTED, 'Error loading config');
  }
}

// Setup event listeners
function setupEventListeners() {
  console.log('Silo popup: setupEventListeners', { connectBtn: !!connectBtn, disconnectBtn: !!disconnectBtn });
  connectBtn.addEventListener('click', () => {
    console.log('Silo popup: Connect button clicked');
    connect();
  });
  disconnectBtn.addEventListener('click', disconnect);

  bunkerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      console.log('Silo popup: Enter in bunker input');
      connect();
    }
  });
}

// Parse bunker URL
function parseBunkerUrl(url) {
  try {
    console.log('Silo popup: parseBunkerUrl', url?.slice(0, 50));
    // Handle bunker:// format
    if (url.startsWith('bunker://')) {
      const parsed = new URL(url);
      return {
        url: url,
        pubkey: parsed.hostname || parsed.pathname.slice(1),
        relay: parsed.searchParams.get('relay'),
        secret: parsed.searchParams.get('secret')
      };
    }
    
    // Handle https:// format
    if (url.startsWith('https://') || url.startsWith('http://')) {
      const parsed = new URL(url);
      return {
        url: url,
        pubkey: parsed.searchParams.get('pubkey') || parsed.pathname.slice(1),
        relay: parsed.searchParams.get('relay'),
        secret: parsed.searchParams.get('secret')
      };
    }
    
    throw new Error('Invalid bunker URL format');
  } catch (error) {
    console.warn('Silo popup: parseBunkerUrl error', error);
    throw new Error('Invalid bunker URL. Must start with bunker:// or https://');
  }
}

// Connect to bunker
async function connect() {
  const url = bunkerInput.value.trim();
  console.log('Silo popup: connect()', { url: url || '(empty)', length: url.length });

  if (!url) {
    console.log('Silo popup: connect aborted, no URL');
    setStatus(STATUS_DISCONNECTED, 'Please enter a bunker URL');
    return;
  }

  try {
    // Validate and parse the URL
    const bunker = parseBunkerUrl(url);
    console.log('Silo popup: parseBunkerUrl ok', { url: bunker.url, hasRelay: !!bunker.relay });

    // Save to storage
    await browser.storage.local.set({
      [STORAGE_KEY]: bunker.url,
      [STORAGE_KEY + '_parsed']: bunker
    });
    console.log('Silo popup: storage saved');

    // Notify background script
    const response = await browser.runtime.sendMessage({
      type: 'BUNKER_CONNECTED',
      bunker: bunker
    });
    console.log('Silo popup: BUNKER_CONNECTED response', response);

    if (response && response.error) {
      setStatus(STATUS_DISCONNECTED, response.error);
      return;
    }
    setStatus(STATUS_CONNECTED, 'Connected to remote signer');
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
    console.log('Silo popup: connect done, UI updated');
  } catch (error) {
    console.error('Silo popup: connect failed', error);
    setStatus(STATUS_DISCONNECTED, error.message);
  }
}

// Disconnect from bunker
async function disconnect() {
  console.log('Silo popup: disconnect()');
  try {
    await browser.storage.local.remove([
      STORAGE_KEY,
      STORAGE_KEY + '_parsed'
    ]);
    
    // Notify background script
    await browser.runtime.sendMessage({
      type: 'BUNKER_DISCONNECTED'
    });
    
    bunkerInput.value = '';
    setStatus(STATUS_DISCONNECTED, 'Disconnected');
    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
    console.log('Silo popup: disconnect done');
  } catch (error) {
    console.error('Silo popup: disconnect failed', error);
  }
}

// Update status display
function setStatus(status, text) {
  statusEl.className = 'status ' + status;
  statusTextEl.textContent = text;
}
