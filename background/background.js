// Silo Background - Service Worker for NIP-46 remote signing
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'
import { SimplePool } from 'nostr-tools/pool'
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'

const STORAGE_KEY = 'silo_bunker_url_parsed'
const LOCAL_SECRET_KEY = 'silo_local_secret'

// Store active connections
let bunkerSigner = null
let pool = null

// Initialize
browser.runtime.onInstalled.addListener(async () => {
  console.log('Silo extension installed')
  
  // Generate or retrieve local secret key for NIP-46 communication
  const result = await browser.storage.local.get(LOCAL_SECRET_KEY)
  if (!result[LOCAL_SECRET_KEY]) {
    // Generate a new local secret key
    const secretKey = generateSecretKey()
    await browser.storage.local.set({
      [LOCAL_SECRET_KEY]: Array.from(secretKey).join(',')
    })
  }
})

// Get local secret key
async function getLocalSecretKey() {
  const result = await browser.storage.local.get(LOCAL_SECRET_KEY)
  if (!result[LOCAL_SECRET_KEY]) {
    throw new Error('No local secret key found')
  }
  const keyArray = result[LOCAL_SECRET_KEY].split(',').map(Number)
  return new Uint8Array(keyArray)
}

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type)
  
  switch (message.type) {
    case 'BUNKER_CONNECTED':
      handleBunkerConnected(message.bunker).then(sendResponse)
      return true
      
    case 'BUNKER_DISCONNECTED':
      handleBunkerDisconnected()
      break
      
    case 'GET_BUNKER':
      getBunker().then(sendResponse)
      return true
      
    case 'NIP46_REQUEST':
      handleNip46Request(message.request).then(sendResponse).catch(e => sendResponse({ error: e.message }))
      return true
      
    default:
      console.warn('Unknown message type:', message.type)
  }
})

// Handle bunker connection
async function handleBunkerConnected(bunker) {
  console.log('Connecting to bunker:', bunker)
  
  try {
    // Get local secret key
    const localSecret = await getLocalSecretKey()
    
    // Initialize pool
    if (!pool) {
      pool = new SimplePool()
    }
    
    // Parse the bunker URL
    const bunkerPointer = await parseBunkerInput(bunker.url)
    
    if (!bunkerPointer) {
      throw new Error('Invalid bunker URL')
    }
    
    // Add relay if specified
    if (bunker.relay) {
      bunkerPointer.relays = [bunker.relay]
    }
    
    // Create the bunker signer
    bunkerSigner = new BunkerSigner(localSecret, bunkerPointer, {
      pool,
      secret: bunker.secret
    })
    
    // Connect to the bunker
    await bunkerSigner.connect()
    
    console.log('Connected to bunker successfully')
    return { success: true }
    
  } catch (error) {
    console.error('Failed to connect to bunker:', error)
    throw error
  }
}

// Handle bunker disconnection
async function handleBunkerDisconnected() {
  console.log('Disconnecting from bunker')
  
  if (bunkerSigner) {
    bunkerSigner.close()
    bunkerSigner = null
  }
  
  if (pool) {
    pool.close()
    pool = null
  }
}

// Get current bunker configuration
async function getBunker() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY)
    return result[STORAGE_KEY] || null
  } catch (error) {
    console.error('Failed to get bunker:', error)
    return null
  }
}

// Handle NIP-46 requests from content script
async function handleNip46Request(request) {
  if (!bunkerSigner) {
    throw new Error('No bunker configured. Please connect first.')
  }
  
  console.log('NIP-46 request:', request.method, request.params)
  
  try {
    let result
    
    switch (request.method) {
      case 'get_public_key':
        result = await bunkerSigner.getPublicKey()
        break
        
      case 'sign_event':
        result = await bunkerSigner.signEvent(request.params[0])
        break
        
      case 'get_relays':
        result = await bunkerSigner.getRelays()
        break
        
      case 'nip04_encrypt':
        result = await bunkerSigner.nip04.encrypt(request.params[0], request.params[1])
        break
        
      case 'nip04_decrypt':
        result = await bunkerSigner.nip04.decrypt(request.params[0], request.params[1])
        break
        
      case 'connect':
        // Already connected, just acknowledge
        result = { success: true }
        break
        
      case 'ping':
        try {
          await bunkerSigner.ping()
          result = true
        } catch (e) {
          result = false
        }
        break
        
      default:
        // Try calling as a generic method on the signer
        if (typeof bunkerSigner[request.method] === 'function') {
          result = await bunkerSigner[request.method](...request.params)
        } else {
          throw new Error(`Unknown method: ${request.method}`)
        }
    }
    
    return result
    
  } catch (error) {
    console.error('NIP-46 request failed:', error)
    throw error
  }
}