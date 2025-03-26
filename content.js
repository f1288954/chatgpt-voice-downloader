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

// 注入腳本來攔截 fetch 請求
function injectInterceptor() {
  console.log('內容腳本: 注入攔截器');
  
  // 使用外部腳本而不是內聯腳本
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('interceptor.js');
  script.onload = function() {
    console.log('內容腳本: 攔截器腳本已成功加載');
    // 腳本加載後可以移除，因為它已經執行了
    this.remove();
  };
  
  // 將腳本插入到頁面
  (document.head || document.documentElement).appendChild(script);
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
      console.log('內容腳本: 保存授權令牌，前15個字符:', token.substring(0, 15) + '...');
      
      // 發送到背景腳本
      chrome.runtime.sendMessage({
        action: 'updateToken',
        token: token
      }, response => {
        if (response && response.status === 'ok') {
          console.log('內容腳本: 授權令牌已成功發送到背景腳本');
        } else {
          console.warn('內容腳本: 發送授權令牌到背景腳本時出現問題:', response);
        }
      });
    } else {
      console.warn('內容腳本: 收到的請求數據中沒有授權令牌');
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
      showNotification(`Voice request captured: ID ${messageId.substring(0, 8)}...`);
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
  }
});

// 直接向頁面發送自定義事件來獲取最後一個請求信息
function checkLastRequest() {
  window.dispatchEvent(new CustomEvent('VOICE_DOWNLOADER_GET_LAST_REQUEST'));
}

// 初始化函數
function initialize() {
  console.log('內容腳本: 初始化');
  
  // 注入網絡攔截器
  injectInterceptor();
  
  // 定期檢查最後請求
  setInterval(() => {
    checkLastRequest();
  }, 3000);
}

// 當頁面完全加載後初始化
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', () => {
    initialize();
  });
}

console.log('內容腳本已載入');
