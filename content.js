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

// 掃描頁面中的消息 ID
function scanMessageIds() {
  // 尋找所有訊息容器
  const messageElements = document.querySelectorAll('[data-message-id], [data-testid*="message"]');
  console.log('內容腳本: 找到可能的訊息元素:', messageElements.length);
  
  // 處理每個找到的元素
  messageElements.forEach(element => {
    let messageId = element.getAttribute('data-message-id');
    
    // 如果沒有直接的 data-message-id，嘗試從其他屬性找
    if (!messageId) {
      // 從 data-testid 嘗試提取
      const testId = element.getAttribute('data-testid');
      if (testId && testId.includes('message')) {
        // 嘗試從內部找 ID
        const idElement = element.querySelector('[id^="message-"]');
        if (idElement) {
          messageId = idElement.id.replace('message-', '');
        }
      }
      
      // 如果還是沒找到，檢查元素是否有 ID 屬性
      if (!messageId && element.id && element.id.includes('message')) {
        messageId = element.id.replace(/^.*?-/, '');
      }
    }
    
    // 如果找到了 ID，存到映射中
    if (messageId) {
      console.log('內容腳本: 找到訊息 ID:', messageId);
      messageIdMap[element.outerHTML] = messageId;
    }
  });
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
      console.log('內容腳本: 保存授權令牌');
      
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
  }
});

// 為每個語音按鈕添加下載按鈕
function addDownloadButtons() {
  // 掃描訊息 ID
  scanMessageIds();
  
  // 查找所有語音按鈕
  console.log('內容腳本: 尋找語音按鈕');
  const audioButtons = document.querySelectorAll('button[aria-label*="Voice"], button[aria-label*="Listen"], button[aria-label*="Play"]');
  console.log('內容腳本: 找到語音按鈕數量:', audioButtons.length);
  
  audioButtons.forEach(button => {
    // 檢查是否已經添加了下載按鈕
    if (button.nextElementSibling && button.nextElementSibling.classList.contains('voice-download-btn')) {
      return;
    }
    
    // 在每個按鈕旁邊創建一個下載按鈕
    const downloadButton = document.createElement('button');
    downloadButton.innerText = '↓';
    downloadButton.title = '下載這段語音';
    downloadButton.className = 'voice-download-btn';
    downloadButton.style.cssText = `
      background: none;
      border: none;
      font-size: 14px;
      cursor: pointer;
      color: #8e8ea0;
      padding: 4px 8px;
      margin-left: 4px;
      border-radius: 4px;
      transition: background-color 0.2s, color 0.2s;
    `;
    
    // 滑鼠懸停效果
    downloadButton.addEventListener('mouseover', () => {
      downloadButton.style.backgroundColor = '#f0f0f0';
      downloadButton.style.color = '#000';
    });
    
    downloadButton.addEventListener('mouseout', () => {
      downloadButton.style.backgroundColor = 'transparent';
      downloadButton.style.color = '#8e8ea0';
    });
    
    // 點擊事件
    downloadButton.addEventListener('click', (e) => {
      // 阻止冒泡，以免觸發原始語音按鈕
      e.stopPropagation();
      e.preventDefault();
      
      // 查找包含消息ID的元素
      let messageContainer = button.closest('[data-message-id]');
      let messageId = null;
      
      // 如果找不到直接的 data-message-id，嘗試其他方法
      if (!messageContainer) {
        // 嘗試向上查找可能的訊息容器
        messageContainer = button.closest('[data-testid*="message"]') || 
                          button.closest('.message') || 
                          button.closest('.text-message-container');
        
        // 如果找到容器，嘗試從映射中獲取 ID
        if (messageContainer) {
          messageId = messageIdMap[messageContainer.outerHTML];
        }
        
        // 如果仍然沒有 ID，嘗試從最接近的 ID 元素獲取
        if (!messageId) {
          const idElement = messageContainer?.querySelector('[id^="message-"]');
          if (idElement) {
            messageId = idElement.id.replace('message-', '');
          }
        }
      } else {
        messageId = messageContainer.getAttribute('data-message-id');
      }
      
      // 從 URL 獲取對話 ID
      const conversationId = window.location.pathname.split('/').pop();
      
      if (messageId && conversationId) {
        console.log('內容腳本: 下載請求:', { messageId, conversationId });
        
        // 檢查令牌
        if (!authorizationToken) {
          showNotification('請先播放語音，然後再嘗試下載', true);
          return;
        }
        
        // 發送下載請求到背景腳本
        chrome.runtime.sendMessage({
          action: 'downloadAudio',
          messageId: messageId,
          conversationId: conversationId
        }, (response) => {
          if (response && response.status === 'downloading') {
            showNotification('正在下載語音');
          } else if (response && response.status === 'error') {
            showNotification(`下載失敗: ${response.message}`, true);
          }
        });
        
        // 記錄最後播放的消息
        lastPlayedMessage = {
          messageId: messageId,
          conversationId: conversationId,
          timestamp: new Date().toLocaleString()
        };
        
        // 更新背景腳本中的最後播放消息
        chrome.runtime.sendMessage({
          action: 'updateLastPlayed',
          message: lastPlayedMessage
        });
      } else {
        showNotification('找不到訊息 ID 或對話 ID', true);
        console.log('內容腳本: 找不到訊息 ID，嘗試使用手動輸入');
        
        // 如果無法自動獲取 ID，添加一個簡單的輸入框讓用戶手動輸入
        const inputMessageId = prompt('無法自動獲取訊息 ID，請手動輸入:');
        if (inputMessageId && conversationId) {
          chrome.runtime.sendMessage({
            action: 'downloadAudio',
            messageId: inputMessageId,
            conversationId: conversationId
          }, (response) => {
            if (response && response.status === 'downloading') {
              showNotification('正在下載語音');
            } else if (response && response.status === 'error') {
              showNotification(`下載失敗: ${response.message}`, true);
            }
          });
        }
      }
    });
    
    // 插入下載按鈕
    button.parentNode.insertBefore(downloadButton, button.nextSibling);
    console.log('內容腳本: 已添加下載按鈕');
  });
}

// 使用 MutationObserver 監聽 DOM 變化以添加下載按鈕
function setupObserver() {
  console.log('內容腳本: 設置 MutationObserver');
  
  const observer = new MutationObserver((mutations) => {
    let shouldAddButtons = false;
    
    // 檢查是否有新的語音按鈕被添加
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const hasAudioButtons = node.querySelector('button[aria-label*="Voice"], button[aria-label*="Listen"], button[aria-label*="Play"]');
            if (hasAudioButtons) {
              shouldAddButtons = true;
              break;
            }
          }
        }
      }
      
      if (shouldAddButtons) break;
    }
    
    // 如果發現新的語音按鈕，添加下載按鈕
    if (shouldAddButtons) {
      console.log('內容腳本: 檢測到語音按鈕，添加下載按鈕');
      addDownloadButtons();
    }
  });
  
  // 開始觀察整個文檔
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 直接向頁面發送自定義事件來獲取最後一個請求信息
function checkLastRequest() {
  window.dispatchEvent(new CustomEvent('VOICE_DOWNLOADER_GET_LAST_REQUEST'));
}

// 初始化函數
function initialize() {
  console.log('內容腳本: 初始化');
  
  // 注入網絡攔截器
  injectInterceptor();
  
  // 設置 MutationObserver
  setupObserver();
  
  // 初始添加下載按鈕
  setTimeout(() => {
    addDownloadButtons();
  }, 1000);
  
  // 定期檢查並添加下載按鈕
  setInterval(() => {
    addDownloadButtons();
    checkLastRequest();
  }, 3000);
}

// 當頁面完全加載後初始化
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}

console.log('內容腳本已載入');
