# Silo - Nostr Remote Signer

A browser extension that implements NIP-07 and NIP-46, allowing you to use a remote signer (bunker) with any Nostr client in your browser.

## Features

- **NIP-07 Compliance**: Exposes `window.nostr` to web pages
- **NIP-46 Integration**: Connect to remote signers (bunkers)
- **Simple UI**: Easy to configure and use
- **Secure**: Your private keys stay on the remote signer

## Installation

### From Source

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `silo` folder

## Usage

1. Click the Silo extension icon in your browser
2. Enter your bunker URL (from nsec.app, nostrme.com, etc.)
3. Click "Connect"
4. Any Nostr client that supports NIP-07 will now use your remote signer

## Bunker URLs

You can get a bunker URL from:

- [nsec.app](https://nsec.app)
- [nostrme.com](https://nostrme.com)
- [NIP-46 Bunkers](https://github.com/nostr-protocol/nips/blob/master/46.md)

The URL typically looks like:
```
bunker://npub1...relay=wss://relay.example.com&secret=...
```

## How It Works

1. **Popup** (`popup/`): UI for entering/configuring the bunker URL
2. **Background** (`background/`): Service worker handling NIP-46 communication
3. **Content Script** (`content/`): Injects `window.nostr` into web pages

## NIP-07 Methods Implemented

- `getPublicKey()` - Get the public key of the connected signer
- `signEvent(event)` - Sign a Nostr event
- `getRelays()` - Get the relay list from the signer
- `encrypt(pubkey, content)` - Encrypt content (NIP-04)
- `decrypt(pubkey, content)` - Decrypt content (NIP-04)

## NIP-46 Integration

The extension communicates with the bunker via NIP-46 JSON-RPC:
- Requests are forwarded from the content script to the background script
- The background script makes HTTP requests to the bunker endpoint
- Responses are returned to the content script

## License

MIT
