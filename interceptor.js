// 保存原始 fetch
const originalFetch = window.fetch;
let lastRequestInfo = null;

// 重寫 fetch
window.fetch = async function(...args) {
  const [resource, config] = args;
  
  // 檢查是否是合成請求
  if (resource && typeof resource === 'string' && resource.includes('synthesize')) {
    console.log('頁面: 攔截到合成請求:', resource);
    
    try {
      // 獲取授權頭
      const authHeader = config?.headers?.Authorization || 
                        (config?.headers ? config.headers.get('Authorization') : null);
      
      // 新增：記錄授權令牌是否獲取成功
      console.log('頁面: 授權令牌狀態:', authHeader ? '成功獲取' : '未獲取到', authHeader ? '令牌前15個字符: ' + authHeader.substring(0, 15) + '...' : '');
      
      if (authHeader) {
        // 提取 URL 參數
        const url = new URL(resource, window.location.origin);
        const messageId = url.searchParams.get('message_id');
        const conversationId = url.searchParams.get('conversation_id');
        
        if (messageId && conversationId) {
          // 發送到內容腳本
          window.postMessage({
            type: 'VOICE_DOWNLOADER_REQUEST',
            data: {
              url: resource,
              token: authHeader,
              messageId,
              conversationId
            }
          }, '*');
          
          lastRequestInfo = {
            messageId,
            conversationId,
            timestamp: new Date().toLocaleString()
          };
        }
      }
    } catch (error) {
      console.error('頁面: 攔截錯誤:', error);
    }
  }
  
  // 調用原始 fetch
  return originalFetch.apply(this, args);
};

// 攔截 XHR 請求
const originalXHR = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  if (url && typeof url === 'string' && url.includes('synthesize')) {
    console.log('頁面: 攔截到 XHR 合成請求:', url);
    
    // 保存原始 send
    const originalSend = this.send;
    this.send = function(body) {
      // 保存原始 setRequestHeader
      const originalSetRequestHeader = this.setRequestHeader;
      let authHeader = null;
      
      // 重寫 setRequestHeader 來捕獲授權頭
      this.setRequestHeader = function(name, value) {
        if (name.toLowerCase() === 'authorization') {
          authHeader = value;
          console.log('頁面: 通過 XHR 成功捕獲授權令牌，前15個字符:', authHeader.substring(0, 15) + '...');
        }
        return originalSetRequestHeader.apply(this, arguments);
      };
      
      // 設置完成後的回調
      this.addEventListener('loadend', function() {
        if (authHeader) {
          try {
            // 提取 URL 參數
            const parsedUrl = new URL(url, window.location.origin);
            const messageId = parsedUrl.searchParams.get('message_id');
            const conversationId = parsedUrl.searchParams.get('conversation_id');
            
            if (messageId && conversationId) {
              // 發送到內容腳本
              window.postMessage({
                type: 'VOICE_DOWNLOADER_REQUEST',
                data: {
                  url,
                  token: authHeader,
                  messageId,
                  conversationId
                }
              }, '*');
              
              lastRequestInfo = {
                messageId,
                conversationId,
                timestamp: new Date().toLocaleString()
              };
            }
          } catch (error) {
            console.error('頁面: XHR 攔截錯誤:', error);
          }
        } else {
          console.warn('頁面: XHR 請求完成，但未捕獲到授權令牌');
        }
      });
      
      return originalSend.apply(this, arguments);
    };
  }
  
  return originalXHR.apply(this, arguments);
};

// 向內容腳本發送最後一個請求的信息
window.addEventListener('VOICE_DOWNLOADER_GET_LAST_REQUEST', function() {
  window.postMessage({
    type: 'VOICE_DOWNLOADER_LAST_REQUEST',
    data: lastRequestInfo
  }, '*');
});

console.log('攔截器腳本已成功加載');
