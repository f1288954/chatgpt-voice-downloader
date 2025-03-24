# ChatGPT Voice Downloader

## Project Overview
This Chrome extension is designed to download voice responses from ChatGPT. The extension works by intercepting web requests to obtain necessary information, including Conversation ID, Message ID, and authorization token, then uses this information to download the audio files.

## Current Issues
Currently, the extension can successfully obtain Conversation ID and Message ID, but encounters problems when downloading audio files. Possible causes include:
1. Incorrect acquisition or use of the authorization token
2. Download request format not meeting ChatGPT API requirements
3. Errors in file processing or storage

## Code Structure

### manifest.json
- Defines basic extension information and permissions
- Specifies background scripts, content scripts, and popup

### content.js
- **Core functionality**: Intercepts web requests, extracts Message ID and authorization token
- **Key components**:
  - `injectInterceptor()`: Injects JavaScript to intercept fetch requests
  - `window.addEventListener('message')`: Receives intercepted request information
  - `addDownloadButtons()`: Adds download buttons to voice messages

### background.js
- **Core functionality**: Handles download requests, manages authorization information
- **Key components**:
  - `chrome.webRequest.onBeforeSendHeaders.addListener`: Monitors network requests
  - `downloadAudio()`: Main function for downloading audio files
  - Message handling system for communication with content scripts and popup

### popup.js/html
- **Core functionality**: Provides user interface, displays request history
- **Key components**:
  - Displays list of captured requests
  - Provides manual download options

## Technical Implementation Details

### Request Interception Mechanism
The extension uses two methods to intercept requests:
1. Injects code in the content script to intercept `fetch` requests
2. Uses Chrome's `webRequest` API to monitor requests in the background script

### Authorization Handling
- Extracts authorization token from intercepted requests
- Saves token in the background script for download use

### Download Process
1. Obtains Message ID and Conversation ID
2. Constructs download URL
3. Sends request using saved authorization token
4. Saves file using Chrome's `downloads` API

## Debugging Guide

### Common Issues
1. **Authorization issues**: Check if token is correctly acquired and used
2. **Request format**: Confirm download URL format is correct
3. **Error handling**: Check console error logs

### Debugging Steps
1. Open Chrome developer tools to view console output
2. Check network requests, especially those related to `synthesize`
3. Confirm if authorization token is successfully passed
4. Check error handling in the download function

## Development Guidelines

### Important Guidelines
1. **Do not replace existing core functionality code**, especially network request interception parts
2. **Analyze the problem first**, don't directly modify code
3. **Propose specific solutions** and wait for confirmation before making changes
4. **Maintain detailed log output** for debugging purposes

## Future Improvements
1. Improve error handling and user feedback
2. Add batch download functionality
3. Support more audio formats and options
4. Optimize user interface experience
