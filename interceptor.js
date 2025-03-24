// 保存原始 fetch
const originalFetch = window.fetch;
let lastRequestInfo = null;
let authToken = null; // 全局保存授權令牌

// 重寫 fetch
window.fetch = async function(...args) {
  const [resource, config] = args;
  
  try {
    // 檢查是否有授權頭，並從所有請求中捕獲它
    if (config && config.headers) {
      let token = null;
      
      // 嘗試從 Headers 對象中獲取
      if (config.headers instanceof Headers) {
        token = config.headers.get('Authorization');
      } 
      // 嘗試從普通對象中獲取
      else if (typeof config.headers === 'object') {
        token = config.headers.Authorization || config.headers.authorization;
      }
      
      if (token) {
        authToken = token;
        console.log('頁面: 從請求中捕獲授權令牌，長度:', token.length);
        
        // 發送到內容腳本
        window.postMessage({
          type: 'VOICE_DOWNLOADER_TOKEN',
          data: {
            token: token
          }
        }, '*');
      }
    }
    
    // 檢查是否是合成請求
    if (resource && typeof resource === 'string' && resource.includes('synthesize')) {
      console.log('頁面: 攔截到合成請求:', resource);
      
      try {
        // 獲取授權頭
        const authHeader = config?.headers?.Authorization || 
                          (config?.headers instanceof Headers ? config.headers.get('Authorization') : null) || 
                          authToken; // 使用最近捕獲的令牌
        
        if (authHeader) {
          console.log('頁面: 找到授權頭，長度:', authHeader.length);
          
          // 提取 URL 參數
          const url = new URL(resource, window.location.origin);
          const messageId = url.searchParams.get('message_id');
          const conversationId = url.searchParams.get('conversation_id');
          
          if (messageId && conversationId) {
            console.log('頁面: 找到消息和對話ID:', messageId.substring(0, 8) + '...', conversationId.substring(0, 8) + '...');
            
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
          } else {
            console.log('頁面: URL參數中未找到消息ID或對話ID');
          }
        } else {
          console.log('頁面: 未找到授權頭');
        }
      } catch (error) {
        console.error('頁面: 攔截錯誤:', error);
      }
    }
  } catch (error) {
    console.error('頁面: 全局攔截錯誤:', error);
  }
  
  // 調用原始 fetch
  return originalFetch.apply(this, args);
};

// 攔截所有 XMLHttpRequest 來獲取授權令牌
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
  if (name.toLowerCase() === 'authorization' && value) {
    authToken = value;
    console.log('頁面 (XHR): 捕獲授權令牌，長度:', value.length);
    
    // 發送到內容腳本
    window.postMessage({
      type: 'VOICE_DOWNLOADER_TOKEN',
      data: {
        token: value
      }
    }, '*');
  }
  
  return originalXHRSetRequestHeader.apply(this, arguments);
};

// 重寫 XMLHttpRequest 的 open 方法以攔截請求
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  // 檢查是否是 AudioPlayer 請求
  if (url && typeof url === 'string' && url.includes('synthesize')) {
    console.log('頁面 (XHR): 攔截到合成請求:', url);
    
    try {
      const parsedUrl = new URL(url, window.location.origin);
      const messageId = parsedUrl.searchParams.get('message_id');
      const conversationId = parsedUrl.searchParams.get('conversation_id');
      
      if (messageId && conversationId) {
        console.log('頁面 (XHR): 找到消息和對話ID:', messageId, conversationId);
        
        // 為這個 XHR 添加事件監聽器以捕獲頭信息
        this.addEventListener('readystatechange', function() {
          if (this.readyState === this.DONE) {
            // 嘗試獲取 Authorization 頭（如果在此之前已經捕獲）
            const token = authToken;
            
            if (token) {
              console.log('頁面 (XHR): 使用已捕獲的授權頭，長度:', token.length);
              
              // 發送到內容腳本
              window.postMessage({
                type: 'VOICE_DOWNLOADER_REQUEST',
                data: {
                  url: url,
                  token: token,
                  messageId,
                  conversationId
                }
              }, '*');
            }
          }
        });
        
        lastRequestInfo = {
          messageId,
          conversationId,
          timestamp: new Date().toLocaleString()
        };
      }
    } catch (error) {
      console.error('頁面 (XHR): 攔截錯誤:', error);
    }
  }
  
  return originalXHROpen.apply(this, [method, url, ...rest]);
};

// 捕獲所有請求中的 Authorization 頭
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
      try {
        // 嘗試讀取請求頭，這可能會在某些瀏覽器中因安全限制而失敗
        if (entry.name && typeof entry.name === 'string') {
          console.log('頁面: 檢測到網絡請求:', entry.name);
          
          // 檢查是否是 OpenAI API 請求
          if (entry.name.includes('openai.com') || entry.name.includes('chat.openai.com')) {
            console.log('頁面: 檢測到 OpenAI API 請求:', entry.name);
          }
        }
      } catch (error) {
        console.error('頁面: PerformanceObserver 錯誤:', error);
      }
    }
  }
});

try {
  observer.observe({ entryTypes: ['resource'] });
} catch (error) {
  console.error('頁面: 無法設置 PerformanceObserver:', error);
}

// 向內容腳本發送最後一個請求的信息
window.addEventListener('VOICE_DOWNLOADER_GET_LAST_REQUEST', function() {
  if (lastRequestInfo) {
    console.log('頁面: 發送最後請求信息:', lastRequestInfo);
    window.postMessage({
      type: 'VOICE_DOWNLOADER_LAST_REQUEST',
      data: lastRequestInfo
    }, '*');
    
    // 如果有令牌，也發送令牌
    if (authToken) {
      console.log('頁面: 同時發送授權令牌');
      window.postMessage({
        type: 'VOICE_DOWNLOADER_TOKEN',
        data: {
          token: authToken
        }
      }, '*');
    }
  } else {
    console.log('頁面: 沒有最後請求信息可發送');
  }
});

// 主動嘗試從頁面中獲取令牌
function extractTokenFromDOM() {
  try {
    // 嘗試從 localStorage 中獲取
    const localStorageData = window.localStorage.getItem('____d__chat');
    if (localStorageData) {
      try {
        const data = JSON.parse(localStorageData);
        if (data && data.props && data.props.pageProps && data.props.pageProps.accessToken) {
          authToken = 'Bearer ' + data.props.pageProps.accessToken;
          console.log('頁面: 從 localStorage 中獲取到令牌');
          
          window.postMessage({
            type: 'VOICE_DOWNLOADER_TOKEN',
            data: {
              token: authToken
            }
          }, '*');
          
          return;
        }
      } catch (e) {
        console.error('頁面: 解析 localStorage 數據失敗:', e);
      }
    }
    
    // 其他可能存儲令牌的位置...
  } catch (error) {
    console.error('頁面: 嘗試提取令牌時出錯:', error);
  }
}

// 初始嘗試提取令牌
setTimeout(extractTokenFromDOM, 1000);

// 每隔幾秒鐘主動發送令牌（如果有）
setInterval(function() {
  if (authToken) {
    console.log('頁面: 定期發送授權令牌');
    window.postMessage({
      type: 'VOICE_DOWNLOADER_TOKEN',
      data: {
        token: authToken
      }
    }, '*');
  } else {
    // 如果沒有找到令牌，嘗試再次提取
    extractTokenFromDOM();
  }
}, 10000);

console.log('攔截器腳本已成功加載');
