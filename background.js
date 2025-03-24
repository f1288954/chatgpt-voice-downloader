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
      console.log('背景: 更新授權令牌');
      sendResponse({status: 'ok'});
    } 
    else if (request.action === 'updateRequests') {
      savedRequests = request.requests;
      console.log('背景: 更新請求列表');
      sendResponse({status: 'ok'});
    }
    else if (request.action === 'updateLastPlayed') {
      lastPlayedMessage = request.message;
      console.log('背景: 更新最後播放的消息');
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
      console.log('背景: 開始下載');
      downloadAudio(request.messageId, request.conversationId)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({status: 'error', message: error.message}));
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
    // 嘗試不同的聲音和格式組合
    const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const formats = ['mp3', 'aac', 'opus'];
    
    // 首先嘗試使用 alloy 聲音和 mp3 格式
    let url = `https://chat.openai.com/backend-api/synthesize?message_id=${messageId}&conversation_id=${conversationId}&voice=alloy&format=mp3`;
    
    // 檢查是否有令牌
    if (!currentToken) {
      throw new Error('沒有可用的授權令牌，請先播放語音');
    }
    
    console.log('背景: 使用URL:', url);
    console.log('背景: 使用令牌:', currentToken.substring(0, 15) + '...');
    
    // 嘗試下載
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': currentToken,
        'Accept': 'audio/*',
        'User-Agent': navigator.userAgent,
        'Referer': 'https://chat.openai.com/',
        'Origin': 'https://chat.openai.com'
      }
    });
    
    // 如果失敗，嘗試其他聲音和格式組合
    if (!response.ok) {
      console.log(`背景: 初始嘗試失敗 (${response.status})，嘗試其他組合...`);
      
      for (let voice of voices) {
        for (let format of formats) {
          if (voice === 'alloy' && format === 'mp3') continue; // 跳過已嘗試的組合
          
          url = `https://chat.openai.com/backend-api/synthesize?message_id=${messageId}&conversation_id=${conversationId}&voice=${voice}&format=${format}`;
          
          console.log(`背景: 嘗試 ${voice}/${format} 組合...`);
          
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
          
          if (response.ok) {
            console.log(`背景: 成功使用 ${voice}/${format} 組合`);
            break;
          }
        }
        
        if (response.ok) break;
      }
    }
    
    if (!response.ok) {
      throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
    }
    
    console.log('背景: 音頻獲取成功');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    console.log('背景: 開始下載...');
    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: objectUrl,
        filename: `chatgpt-voice-${messageId.substring(0, 8)}.mp3`,
        saveAs: false
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

// 擴充功能安裝/更新時清除數據
chrome.runtime.onInstalled.addListener(function() {
  savedRequests = [];
  currentToken = null;
  lastPlayedMessage = null;
  console.log('擴充功能已安裝/更新，數據已重置');
});

console.log('背景腳本已載入');
