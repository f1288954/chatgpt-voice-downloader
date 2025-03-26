// DOM 元素
const messageIdInput = document.getElementById('message-id');
const conversationIdInput = document.getElementById('conversation-id');
const downloadBtn = document.getElementById('download-btn');
const requestsList = document.getElementById('requests-list');
const lastPlayedSection = document.getElementById('last-played-section');
const lastPlayedInfo = document.getElementById('last-played-info');
const downloadLastBtn = document.getElementById('download-last-btn');
const statusText = document.getElementById('status-text');

// 顯示狀態訊息
function showStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.className = isError ? 'error' : 'success';
  statusText.style.display = 'block';
  
  setTimeout(() => {
    statusText.style.opacity = '0';
    setTimeout(() => {
      statusText.style.display = 'none';
      statusText.style.opacity = '1';
    }, 500);
  }, 3000);
}

// 載入請求歷史
async function loadRequests() {
  try {
    // 直接從背景腳本獲取數據
    const requestsResponse = await chrome.runtime.sendMessage({action: 'getRequests'});
    
    if (requestsResponse && requestsResponse.requests && requestsResponse.requests.length > 0) {
      displayRequests(requestsResponse.requests);
    } else {
      requestsList.innerHTML = '<li class="no-requests">No request history yet</li>';
    }
    
    // 獲取最後播放的訊息
    const lastPlayedResponse = await chrome.runtime.sendMessage({action: 'getLastPlayed'});
    
    if (lastPlayedResponse && lastPlayedResponse.messageId) {
      displayLastPlayed(lastPlayedResponse);
    } else {
      lastPlayedSection.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load request history:', error);
    requestsList.innerHTML = '<li class="no-requests">Failed to load request history</li>';
    lastPlayedSection.style.display = 'none';
  }
}

// 顯示請求歷史
function displayRequests(requests) {
  requestsList.innerHTML = '';
  
  requests.forEach(request => {
    const li = document.createElement('li');
    li.className = 'request-item';
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = request.timestamp;
    
    const messageIdText = document.createElement('div');
    messageIdText.className = 'message-id';
    messageIdText.textContent = `Message ID: ${request.messageId.substring(0, 10)}...`;
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'mini-download-btn';
    downloadButton.textContent = 'Download';
    downloadButton.addEventListener('click', () => {
      downloadAudio(request.messageId, request.conversationId);
    });
    
    li.appendChild(timestamp);
    li.appendChild(messageIdText);
    li.appendChild(downloadButton);
    requestsList.appendChild(li);
  });
}

// 顯示最後播放的訊息
function displayLastPlayed(message) {
  lastPlayedSection.style.display = 'block';
  lastPlayedInfo.textContent = `Last played: ${message.timestamp}`;
  
  downloadLastBtn.onclick = () => {
    downloadAudio(message.messageId, message.conversationId);
  };
}

// 下載音頻
async function downloadAudio(messageId, conversationId) {
  try {
    showStatus('Downloading...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'downloadAudio',
      messageId: messageId,
      conversationId: conversationId
    });
    
    if (response && response.status === 'downloading') {
      showStatus('Download started');
    } else if (response && response.status === 'error') {
      showStatus(`Download failed: ${response.message}`, true);
    }
  } catch (error) {
    console.error('Download failed:', error);
    showStatus('Download failed', true);
  }
}

// 從 URL 填充對話 ID
function fillConversationIdFromUrl() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0 && tabs[0].url) {
      const url = tabs[0].url;
      if (url.includes('/c/')) {
        const urlParts = url.split('/');
        conversationIdInput.value = urlParts[urlParts.length - 1];
      }
    }
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 從 URL 填充對話 ID
  fillConversationIdFromUrl();
  
  // 載入請求歷史
  loadRequests();
  
  // 設置下載按鈕
  downloadBtn.addEventListener('click', () => {
    const messageId = messageIdInput.value.trim();
    const conversationId = conversationIdInput.value.trim();
    
    if (!messageId || !conversationId) {
      showStatus('Please enter Message ID and Conversation ID', true);
      return;
    }
    
    downloadAudio(messageId, conversationId);
  });
  
  // 定期刷新請求列表
  setInterval(loadRequests, 5000);
});
