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
      requestsList.innerHTML = '<li class="no-requests">尚無請求歷史</li>';
    }
    
    // 獲取最後播放的訊息
    const lastPlayedResponse = await chrome.runtime.sendMessage({action: 'getLastPlayed'});
    
    if (lastPlayedResponse && lastPlayedResponse.messageId) {
      displayLastPlayed(lastPlayedResponse);
    } else {
      lastPlayedSection.style.display = 'none';
    }
  } catch (error) {
    console.error('載入請求失敗:', error);
    requestsList.innerHTML = '<li class="no-requests">無法載入請求歷史</li>';
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
    messageIdText.textContent = `訊息 ID: ${request.messageId.substring(0, 10)}...`;
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'mini-download-btn';
    downloadButton.textContent = '下載';
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
  lastPlayedInfo.textContent = `最後播放: ${message.timestamp}`;
  
  downloadLastBtn.onclick = () => {
    downloadAudio(message.messageId, message.conversationId);
  };
}

// 下載音頻
async function downloadAudio(messageId, conversationId) {
  try {
    showStatus('正在下載...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'downloadAudio',
      messageId: messageId,
      conversationId: conversationId
    });
    
    if (response && response.status === 'downloading') {
      showStatus('下載已開始');
    } else if (response && response.status === 'error') {
      showStatus(`下載失敗: ${response.message}`, true);
    }
  } catch (error) {
    console.error('下載失敗:', error);
    showStatus('下載失敗', true);
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
      showStatus('請輸入訊息 ID 和對話 ID', true);
      return;
    }
    
    downloadAudio(messageId, conversationId);
  });
  
  // 定期刷新請求列表
  setInterval(loadRequests, 5000);
});
