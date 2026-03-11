// Silo Content Script - NIP-07 implementation (window.nostr)
// This script injects the nostr object into the page

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.nostr) {
    console.log('Silo: nostr already defined');
    return;
  }
  
  console.log('Silo: Injecting NIP-07...');
  
  // NIP-07 implementation using NIP-46 backend
  const nostr = {
    // Get the public key of the connected signer
    getPublicKey: async function() {
      return await this._call('get_public_key');
    },
    
    // Sign an event (NIP-01)
    signEvent: async function(event) {
      // Add pubkey and created_at if not present
      const pubkey = await this.getPublicKey();
      event.pubkey = pubkey;
      event.created_at = Math.floor(Date.now() / 1000);
      event.id = this.getEventHash(event);
      
      // Sign via NIP-46
      const signedEvent = await this._call('sign_event', event);
      return signedEvent;
    },
    
    // Get relay list (NIP-01)
    getRelays: async function() {
      return await this._call('get_relays');
    },
    
    // Connect to a bunker (NIP-46)
    connect: async function(pubkey, relay) {
      return await this._call('connect', { pubkey, relay });
    },
    
    // Encrypt content (NIP-04)
    encrypt: async function(pubkey, content) {
      return await this._call('nip04_encrypt', { pubkey, content });
    },
    
    // Decrypt content (NIP-04)
    decrypt: async function(pubkey, content) {
      return await this._call('nip04_decrypt', { pubkey, content });
    },
    
    // NIP-26 delegation
    delegate: async function(delegatePubkey) {
      return await this._call('delegate', { delegate: delegatePubkey });
    },
    
    // Ping the signer
    ping: async function() {
      try {
        return await this._call('ping');
      } catch (e) {
        return false;
      }
    },
    
    // Internal: Call the background script
    _call: async function(method, params = {}) {
      return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({
          type: 'NIP46_REQUEST',
          request: { method, params }
        }, (response) => {
          if (browser.runtime.lastError) {
            reject(new Error(browser.runtime.lastError.message));
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
    },
    
    // Utility: Compute event hash (NIP-01)
    getEventHash: function(event) {
      // Simplified - in production use @noble/hashes
      const data = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
      ]);
      
      // This is a placeholder - real implementation needs SHA-256
      // Using browser.subtle crypto would be better
      return 'sha256-placeholder-' + btoa(data).slice(0, 64);
    }
  };
  
  // Expose nostr to the window object
  Object.defineProperty(window, 'nostr', {
    value: nostr,
    writable: false,
    configurable: false
  });
  
  console.log('Silo: NIP-07 injected successfully');
  
  // Notify that we're ready
  window.dispatchEvent(new CustomEvent('nostr:ready'));
})();
