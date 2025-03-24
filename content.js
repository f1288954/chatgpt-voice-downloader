// 全局變量
let authorizationToken = null;
let lastPlayedMessage = null;
let messageIdMap = {}; // 用於存儲訊息元素與其 ID 的映射

// 監聽來自背景腳本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('內容腳本: 收到消息:', request);
  
  if (request.action === 'getLastPlayed') {
    sendResponse(lastPlayedMessage);
  }
  
  return true;
});

// 顯示通知
function showNotification(message, isError = false) {
  const existing = document.getElementById('voice-downloader-notification');
  if (existing) {
    existing.remove();
  }
  
  const notification = document.createElement('div');
  notification.id = 'voice-downloader-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 15px;
    border-radius: 4px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    transition: opacity 0.3s;
    background-color: ${isError ? '#f44336' : '#4caf50'};
    color: white;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// 注入攔截器腳本
function injectInterceptorScript() {
  if (document.querySelector('#voice-downloader-interceptor')) {
    console.log('內容腳本: 攔截器腳本已經存在');
    return;
  }
  
  console.log('內容腳本: 注入攔截器腳本');
  
  try {
    const script = document.createElement('script');
    script.id = 'voice-downloader-interceptor';
    script.src = chrome.runtime.getURL('interceptor.js');
    script.onload = function() {
      console.log('內容腳本: 攔截器腳本成功加載');
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('內容腳本: 注入攔截器腳本失敗:', error);
  }
}

// 掃描頁面中的消息 ID
function scanMessageIds() {
  console.log('內容腳本: 掃描頁面中的訊息 ID');
  
  try {
    // ChatGPT UI 中的消息容器
    const messageElements = document.querySelectorAll('[data-message-id], [data-testid="conversation-turn"]');
    
    console.log('內容腳本: 找到可能的訊息元素:', messageElements.length);
    
    messageElements.forEach(element => {
      let messageId = null;
      
      // 嘗試獲取 data-message-id 屬性
      if (element.hasAttribute('data-message-id')) {
        messageId = element.getAttribute('data-message-id');
      } 
      // 嘗試從 data-testid="conversation-turn" 元素中獲取 ID
      else if (element.hasAttribute('data-testid') && element.getAttribute('data-testid') === 'conversation-turn') {
        // 在子元素中尋找包含 ID 的元素
        const idElement = element.querySelector('[id^="message-"]');
        if (idElement) {
          const idMatch = idElement.id.match(/message-(.*)/);
          if (idMatch && idMatch[1]) {
            messageId = idMatch[1];
          }
        }
      }
      
      if (messageId && !messageIdMap[messageId]) {
        console.log('內容腳本: 找到訊息 ID:', messageId);
        messageIdMap[messageId] = element;
      }
    });
  } catch (error) {
    console.error('內容腳本: 掃描訊息 ID 時出錯:', error);
  }
}

// 監聽來自注入腳本的消息
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  
  if (event.data && event.data.type === 'VOICE_DOWNLOADER_REQUEST') {
    console.log('內容腳本: 收到合成請求數據:', event.data.data);
    
    const { url, token, messageId, conversationId } = event.data.data;
    
    // 保存授權令牌
    if (token) {
      authorizationToken = token;
      console.log('內容腳本: 保存授權令牌，長度:', token.length);
      
      // 發送到背景腳本
      chrome.runtime.sendMessage({
        action: 'updateToken',
        token: token
      });
    }
    
    // 保存請求
    if (messageId && conversationId) {
      const request = {
        url: url,
        messageId: messageId,
        conversationId: conversationId,
        timestamp: new Date().toLocaleString()
      };
      
      // 發送到背景腳本
      chrome.runtime.sendMessage({
        action: 'updateRequests',
        requests: [request] // 每次只發送最新的一個請求
      });
      
      // 顯示通知
      showNotification(`已捕獲語音請求: ID ${messageId.substring(0, 8)}...`);
    }
  } else if (event.data && event.data.type === 'VOICE_DOWNLOADER_LAST_REQUEST') {
    console.log('內容腳本: 收到最後一個請求數據:', event.data.data);
    
    if (event.data.data) {
      lastPlayedMessage = event.data.data;
      
      // 發送到背景腳本
      chrome.runtime.sendMessage({
        action: 'updateLastPlayed',
        message: lastPlayedMessage
      });
    }
  } else if (event.data && event.data.type === 'VOICE_DOWNLOADER_TOKEN') {
    // 處理僅發送令牌的消息
    if (event.data.data && event.data.data.token) {
      const token = event.data.data.token;
      console.log('內容腳本: 收到令牌更新，長度:', token.length);
      
      // 保存令牌
      authorizationToken = token;
      
      // 發送到背景腳本
      chrome.runtime.sendMessage({
        action: 'updateToken',
        token: token
      });
    }
  }
});

// 為每個語音按鈕添加下載按鈕
function addDownloadButtons() {
  console.log('內容腳本: 尋找語音按鈕');
  
  const audioButtons = document.querySelectorAll('button[aria-label*="Voice"], button[aria-label*="語音"], button[aria-label*="voice"]');
  console.log('內容腳本: 找到語音按鈕數量:', audioButtons.length);
  
  audioButtons.forEach(button => {
    // 檢查是否已經添加了下載按鈕
    if (button.parentElement.querySelector('.voice-downloader-btn')) {
      return;
    }
    
    // 尋找消息容器
    let messageContainer = button.closest('[data-message-id], [data-testid="conversation-turn"]');
    if (!messageContainer) return;
    
    // 獲取消息 ID
    let messageId = null;
    
    if (messageContainer.hasAttribute('data-message-id')) {
      messageId = messageContainer.getAttribute('data-message-id');
    } else {
      // 嘗試從 conversation-turn 中獲取 ID
      const idElement = messageContainer.querySelector('[id^="message-"]');
      if (idElement) {
        const idMatch = idElement.id.match(/message-(.*)/);
        if (idMatch && idMatch[1]) {
          messageId = idMatch[1];
        }
      }
    }
    
    if (!messageId) return;
    
    // 獲取對話 ID
    const conversationId = window.location.pathname.split('/').pop();
    if (!conversationId) return;
    
    // 創建下載按鈕
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'voice-downloader-btn';
    downloadBtn.title = '下載語音';
    downloadBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16L12 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 13L12 16L15 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 20H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    // 設置樣式
    downloadBtn.style.cssText = `
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      margin-left: 4px;
      border-radius: 4px;
      color: inherit;
      opacity: 0.7;
      transition: opacity 0.2s, background-color 0.2s;
    `;
    
    // 懸停效果
    downloadBtn.addEventListener('mouseover', () => {
      downloadBtn.style.opacity = '1';
      downloadBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    });
    
    downloadBtn.addEventListener('mouseout', () => {
      downloadBtn.style.opacity = '0.7';
      downloadBtn.style.backgroundColor = 'transparent';
    });
    
    // 點擊事件
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('內容腳本: 下載按鈕被點擊，訊息ID:', messageId, '對話ID:', conversationId);
      
      // 檢查令牌
      if (!authorizationToken) {
        console.error('內容腳本: 授權令牌缺失');
        showNotification('授權令牌缺失，請先播放語音', true);
        
        // 嘗試通過點擊語音按鈕來獲取令牌
        button.click();
        return;
      }
      
      // 發送下載請求到背景腳本
      chrome.runtime.sendMessage({
        action: 'downloadAudio',
        messageId: messageId,
        conversationId: conversationId
      }, (response) => {
        if (response && response.status === 'downloading') {
          showNotification('下載已開始');
        } else if (response && response.status === 'error') {
          showNotification(`下載失敗: ${response.message}`, true);
        } else {
          showNotification('下載請求發送失敗', true);
        }
      });
    });
    
    // 將按鈕添加到語音按鈕旁邊
    button.parentElement.appendChild(downloadBtn);
  });
}

// 使用 MutationObserver 監聽 DOM 變化以添加下載按鈕
function setupObserver() {
  console.log('內容腳本: 設置 MutationObserver');
  
  const observer = new MutationObserver((mutations) => {
    let shouldAddButtons = false;
    let shouldScanIds = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector('button[aria-label*="Voice"], button[aria-label*="語音"], button[aria-label*="voice"]')) {
              shouldAddButtons = true;
            }
            
            if (node.hasAttribute && (node.hasAttribute('data-message-id') || 
                (node.hasAttribute('data-testid') && node.getAttribute('data-testid') === 'conversation-turn'))) {
              shouldScanIds = true;
            }
          }
        }
      }
    }
    
    if (shouldScanIds) {
      scanMessageIds();
    }
    
    if (shouldAddButtons) {
      addDownloadButtons();
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

// 直接向頁面發送自定義事件來獲取最後一個請求信息
function checkLastRequest() {
  window.dispatchEvent(new Event('VOICE_DOWNLOADER_GET_LAST_REQUEST'));
}

// 初始化函數
function initialize() {
  console.log('內容腳本: 初始化');
  
  // 注入攔截器腳本
  injectInterceptorScript();
  
  // 掃描消息 ID
  scanMessageIds();
  
  // 添加下載按鈕
  addDownloadButtons();
  
  // 設置觀察者
  setupObserver();
  
  // 檢查最後的請求
  setTimeout(checkLastRequest, 1000);
  
  // 定期檢查最後的請求
  setInterval(checkLastRequest, 5000);
}

// 當頁面完全加載後初始化
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}

console.log('內容腳本已載入');
