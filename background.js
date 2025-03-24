// 儲存狀態
let currentToken = null;
let savedRequests = [];
let lastPlayedMessage = null;

// 監聽消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('背景: 收到消息:', request.action);
  
  try {
    if (request.action === 'updateToken') {
      updateToken(request.token);
      console.log('背景: 令牌已更新，長度:', currentToken ? currentToken.length : 0);
      console.log('背景: 令牌前20個字符:', currentToken ? currentToken.substring(0, 20) + '...' : 'null');
      sendResponse({status: 'success'});
    }
    else if (request.action === 'getToken') {
      console.log('背景: 發送令牌，是否存在:', !!currentToken);
      sendResponse({token: currentToken});
    }
    else if (request.action === 'updateRequests') {
      savedRequests = request.requests;
      console.log('背景: 請求列表已更新');
      sendResponse({status: 'ok'});
    }
    else if (request.action === 'getRequests') {
      console.log('背景: 發送請求列表');
      sendResponse({requests: savedRequests});
    }
    else if (request.action === 'updateLastPlayed') {
      lastPlayedMessage = request.message;
      console.log('背景: 最後播放的消息已更新:', lastPlayedMessage);
      sendResponse({status: 'ok'});
    }
    else if (request.action === 'getLastPlayed') {
      console.log('背景: 發送最後播放的消息');
      sendResponse(lastPlayedMessage);
    }
    else if (request.action === 'downloadAudio') {
      console.log('背景: 收到下載請求');
      
      if (!currentToken) {
        console.error('背景: 令牌缺失，無法下載');
        sendResponse({status: 'error', message: '授權令牌缺失，請先在 ChatGPT 頁面播放語音'});
        return true;
      }
      
      // 啟動下載過程
      downloadAudio(request.messageId, request.conversationId)
        .then(result => {
          console.log('背景: 下載啟動成功');
          sendResponse({status: 'downloading'});
        })
        .catch(error => {
          console.error('背景: 下載過程錯誤:', error.message);
          sendResponse({status: 'error', message: error.message});
        });
      
      return true; // 保持消息通道開啟以支持異步回應
    }
  } catch (error) {
    console.error('背景: 處理消息錯誤:', error);
    sendResponse({status: 'error', message: error.message});
  }
  
  return true; // 保持連接開啟以支持異步回應
});

// 下載功能
async function downloadAudio(messageId, conversationId) {
  console.log('背景: 下載音頻:', { messageId, conversationId });
  console.log('背景: 使用令牌:', currentToken ? '存在 (長度: ' + currentToken.length + ')' : '不存在');
  
  try {
    // 檢查是否有令牌
    if (!currentToken) {
      throw new Error('沒有可用的授權令牌，請先播放語音');
    }
    
    console.log('背景: 令牌長度:', currentToken.length);
    
    // 嘗試不同的基礎URL
    const baseUrls = [
      'https://chat.openai.com/backend-api/synthesize',
      'https://chat.openai.com/backend-api/conversation/gen_title/synthesize',
      'https://chatgpt.com/backend-api/synthesize'
    ];
    
    // 嘗試不同的聲音和格式組合
    const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const formats = ['mp3', 'aac', 'opus'];
    
    let response = null;
    let successUrl = '';
    
    // 嘗試所有可能的組合
    for (const baseUrl of baseUrls) {
      for (const voice of voices) {
        for (const format of formats) {
          const url = `${baseUrl}?message_id=${messageId}&conversation_id=${conversationId}&voice=${voice}&format=${format}`;
          
          console.log(`背景: 嘗試 ${baseUrl} 使用 ${voice}/${format} 組合...`);
          
          try {
            response = await fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': currentToken,
                'Accept': 'audio/*',
                'User-Agent': navigator.userAgent,
                'Referer': 'https://chat.openai.com/',
                'Origin': 'https://chat.openai.com'
              }
            });
            
            console.log(`背景: ${voice}/${format} 嘗試結果:`, response.status);
            
            if (response.ok) {
              console.log(`背景: 成功使用 ${voice}/${format} 組合`);
              successUrl = url;
              break;
            }
          } catch (fetchError) {
            console.error(`背景: 嘗試 ${voice}/${format} 時出錯:`, fetchError);
          }
        }
        
        if (response && response.ok) break;
      }
      
      if (response && response.ok) break;
    }
    
    if (!response || !response.ok) {
      throw new Error(`下載失敗: ${response ? response.status + ' ' + response.statusText : '無回應'}`);
    }
    
    console.log('背景: 音頻獲取成功，使用URL:', successUrl);
    
    // 檢查響應類型
    const contentType = response.headers.get('content-type');
    console.log('背景: 響應內容類型:', contentType);
    
    // 獲取 blob
    const blob = await response.blob();
    console.log('背景: blob 大小:', blob.size, 'bytes');
    
    if (blob.size < 100) {
      // 內容太小，可能是錯誤
      const text = await blob.text();
      console.error('背景: 響應內容太小，可能是錯誤:', text);
      throw new Error(`下載失敗: 返回內容太小 (${blob.size} bytes)`);
    }
    
    const objectUrl = URL.createObjectURL(blob);
    
    // 確定文件格式
    const fileFormat = contentType.includes('aac') ? 'aac' : 
                      contentType.includes('opus') ? 'opus' : 'mp3';
    
    console.log('背景: 開始下載...');
    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: objectUrl,
        filename: `chatgpt-voice-${messageId.substring(0, 8)}.${fileFormat}`,
        saveAs: true  // 顯示保存對話框
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      });
    });
    
    console.log('背景: 下載開始，ID:', downloadId);
    
    // 清理對象URL
    URL.revokeObjectURL(objectUrl);
    
    return {status: 'downloading'};
  } catch (error) {
    console.error('背景: 下載失敗:', error);
    throw error;
  }
}

// 更新授權令牌
function updateToken(token) {
  if (token) {
    console.log('背景腳本: 收到令牌更新，長度:', token.length);
    currentToken = token;
    
    // 持久化存儲令牌
    chrome.storage.local.set({ voiceDownloaderToken: token });
  } else {
    console.log('背景腳本: 收到空令牌更新');
  }
}

// 載入先前保存的令牌
function loadSavedToken() {
  chrome.storage.local.get('voiceDownloaderToken', (result) => {
    if (result.voiceDownloaderToken) {
      currentToken = result.voiceDownloaderToken;
      console.log('背景腳本: 從存儲中加載令牌，長度:', currentToken.length);
    } else {
      console.log('背景腳本: 存儲中沒有令牌');
    }
  });
}

// 擴充功能安裝/更新時清除數據
chrome.runtime.onInstalled.addListener(function() {
  savedRequests = [];
  currentToken = null;
  lastPlayedMessage = null;
  console.log('擴充功能已安裝/更新，數據已重置');
});

// 初始化
function initialize() {
  loadSavedToken();
  
  console.log('背景腳本: 初始化完成');
}

// 啟動
initialize();

console.log('背景腳本已載入');
