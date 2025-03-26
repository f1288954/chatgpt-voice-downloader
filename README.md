# ChatGPT Voice Downloader

A Chrome extension that lets you download voice responses from ChatGPT.

## Features

- Automatically captures voice synthesis requests from ChatGPT
- Downloads voice responses in high-quality audio format
- Simple and clean user interface
- Works with both chat.openai.com and chatgpt.com domains

## How It Works

This extension works by:
1. Intercepting network requests to capture Authorization tokens and Message IDs
2. Automatically filling the interface with the latest captured voice data
3. Allowing one-click downloads of voice responses

## Installation

### From Chrome Web Store
*Coming soon*

### Manual Installation
1. Clone this repository or download as ZIP
2. Go to Chrome Extensions (chrome://extensions/)
3. Enable "Developer Mode"
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your toolbar

## Usage

1. Visit ChatGPT and interact normally
2. When a voice response is played, the extension will automatically capture it
3. Click the extension icon to open the popup
4. Click "Download" on any captured voice response
5. For advanced options, click "Show advanced options"

## Project Structure

- `manifest.json` - Extension configuration
- `background.js` - Background service worker for handling requests and downloads
- `content.js` - Content script injected into ChatGPT page
- `interceptor.js` - Script that intercepts fetch requests
- `popup.html/js` - Extension popup interface

## Development

### Key Technical Components

- **Request Interception**: Injects code to intercept fetch requests and extract authorization tokens
- **Token Management**: Captures and manages authorization tokens from multiple sources
- **Audio Download**: Uses Data URL approach to properly download audio with authorization
- **UI Design**: Simplified UI with automatic ID filling and advanced options

### Version Tags

- `v1.0-full-working` - Base version with full working functionality
- `v1.1-eng-working` - English UI translation
- `v1.2-improved-ui` - Improved UI with auto-fill and simplified interface

## Troubleshooting

If you encounter issues:
1. Make sure you're logged into ChatGPT
2. Check that the extension has permissions for ChatGPT domains
3. Try refreshing the page and playing a voice response again
4. For persistent problems, try removing and re-adding the extension

## Contributions

Contributions are welcome! Feel free to submit issues or pull requests.

## License

MIT License

---

*Note: This extension is not affiliated with or endorsed by OpenAI.*
