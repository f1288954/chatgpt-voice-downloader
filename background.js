// 儲存狀態
let currentToken = null;
let savedRequests = [];
let lastPlayedMessage = null;

// 監聽消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('背景: 收到消息:', request);
  
  try {
    if (request.action === 'updateToken') {
      currentToken = request.token;
      console.log('背景: 更新授權令牌:', currentToken ? (currentToken.substring(0, 15) + '...') : '無效令牌');
      
      // 測試：驗證令牌格式
      const tokenType = currentToken && currentToken.startsWith('Bearer ') ? 'Bearer令牌' : '非標準格式';
      console.log('背景: 令牌類型驗證:', tokenType);
      
      sendResponse({status: 'ok'});
    } 
    else if (request.action === 'updateRequests') {
      savedRequests = request.requests;
      console.log('背景: 更新請求列表');
      sendResponse({status: 'ok'});
    }
    else if (request.action === 'updateLastPlayed') {
      lastPlayedMessage = request.message;
      console.log('背景: 更新最後播放的消息:', lastPlayedMessage);
      sendResponse({status: 'ok'});
    }
    else if (request.action === 'getRequests') {
      console.log('背景: 發送請求列表');
      sendResponse({requests: savedRequests});
    }
    else if (request.action === 'getToken') {
      console.log('背景: 發送授權令牌');
      sendResponse({token: currentToken});
    }
    else if (request.action === 'getLastPlayed') {
      console.log('背景: 發送最後播放的消息');
      sendResponse(lastPlayedMessage);
    }
    else if (request.action === 'downloadAudio') {
      console.log('背景: 開始下載', { messageId: request.messageId, conversationId: request.conversationId });
      downloadAudio(request.messageId, request.conversationId)
        .then(result => {
          console.log('背景: 下載結果:', result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('背景: 下載錯誤:', error);
          sendResponse({status: 'error', message: error.message});
        });
      return true; // 異步回應
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
  
  try {
    // 檢查是否有令牌
    if (!currentToken) {
      throw new Error('沒有可用的授權令牌，請先播放語音');
    }
    
    // 嘗試不同的基礎URL
    const baseUrls = [
      'https://chatgpt.com/backend-api/synthesize',
      'https://chat.openai.com/backend-api/synthesize',
      'https://chat.openai.com/backend-api/conversation/gen_title/synthesize'
    ];
    
    // 嘗試不同的聲音和格式組合
    const voices = ['cove', 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const formats = ['aac', 'mp3', 'opus'];
    
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
    
    // 確定文件格式（從內容類型獲取，或使用請求中的格式）
    let fileFormat = 'aac'; // 預設格式
    if (contentType.includes('audio/aac') || contentType.includes('audio/x-aac')) {
      fileFormat = 'aac';
    } else if (contentType.includes('audio/mp3') || contentType.includes('audio/mpeg')) {
      fileFormat = 'mp3';
    } else if (contentType.includes('audio/opus')) {
      fileFormat = 'opus';
    } else if (successUrl.includes('format=')) {
      // 從URL中提取格式
      const formatMatch = successUrl.match(/format=([^&]+)/);
      if (formatMatch && formatMatch[1]) {
        fileFormat = formatMatch[1];
      }
    }
    
    console.log('背景: 決定使用文件格式:', fileFormat);
    
    // 獲取二進制數據
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // 將二進制數據轉換為base64
    let binaryString = '';
    bytes.forEach(byte => binaryString += String.fromCharCode(byte));
    const base64 = btoa(binaryString);
    
    // 創建data URL
    const dataUrl = `data:${contentType};base64,${base64}`;
    
    console.log('背景: 開始下載...');
    
    // 使用data URL進行下載
    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: dataUrl,
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
    
    return {status: 'downloading'};
  } catch (error) {
    console.error('背景: 下載失敗:', error);
    throw error;
  }
}

// 擴充功能安裝/更新時清除數據
chrome.runtime.onInstalled.addListener(function() {
  savedRequests = [];
  currentToken = null;
  lastPlayedMessage = null;
  console.log('擴充功能已安裝/更新，數據已重置');
});

console.log('背景腳本已載入');
