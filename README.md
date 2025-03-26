# ChatGPT Voice Downloader

## 專案概述
這是一個 Chrome 擴充功能，專門用於下載 ChatGPT 的語音回應檔案。擴充功能透過攔截網頁請求來獲取必要的資訊，包括 Conversation ID、Message ID 和授權令牌，然後使用這些資訊來下載語音檔案。

## 當前問題
目前擴充功能可以成功獲取 Conversation ID 和 Message ID，但在下載語音檔案時遇到問題。可能的原因包括：
1. 授權令牌獲取或使用不正確
2. 下載請求格式不符合 ChatGPT API 的要求
3. 檔案處理或儲存過程中出現錯誤

## 代碼結構

### manifest.json
- 定義擴充功能的基本資訊和權限
- 指定背景腳本、內容腳本和彈出視窗

### content.js
- **核心功能**：攔截網頁請求，提取 Message ID 和授權令牌
- **關鍵部分**：
  - `injectInterceptor()`: 注入 JavaScript 以攔截 fetch 請求
  - `window.addEventListener('message')`: 接收攔截到的請求資訊
  - `addDownloadButtons()`: 為語音訊息添加下載按鈕

### background.js
- **核心功能**：處理下載請求，管理授權資訊
- **關鍵部分**：
  - `chrome.webRequest.onBeforeSendHeaders.addListener`: 監聽網絡請求
  - `downloadAudio()`: 下載語音檔案的主要函數
  - 消息處理系統，用於與內容腳本和彈出視窗通信

### popup.js/html
- **核心功能**：提供用戶界面，顯示請求歷史
- **關鍵部分**：
  - 顯示已捕獲的請求列表
  - 提供手動下載選項

## 技術實現細節

### 請求攔截機制
擴充功能使用兩種方法攔截請求：
1. 在內容腳本中注入代碼攔截 `fetch` 請求
2. 使用 Chrome 的 `webRequest` API 在背景腳本中監聽請求

### 授權處理
- 從攔截的請求中提取授權令牌
- 在背景腳本中保存令牌以供下載使用

### 下載流程
1. 獲取 Message ID 和 Conversation ID
2. 構建下載 URL
3. 使用保存的授權令牌發送請求
4. 使用 Chrome 的 `downloads` API 保存檔案

## 調試指南

### 常見問題
1. **授權問題**：檢查令牌是否正確獲取和使用
2. **請求格式**：確認下載 URL 格式是否正確
3. **錯誤處理**：查看控制台錯誤日誌

### 調試步驟
1. 開啟 Chrome 開發者工具，查看控制台輸出
2. 檢查網絡請求，特別是與 `synthesize` 相關的請求
3. 確認授權令牌是否成功傳遞
4. 檢查下載函數中的錯誤處理

## 開發規範

### 重要指引
1. **不要替換現有的核心功能代碼**，特別是網絡請求攔截部分
2. **先分析問題**，不要直接修改代碼
3. **提出具體的解決方案**並等待確認後再進行修改
4. **保留詳細的日誌輸出**以便於調試

## 未來改進方向
1. 改進錯誤處理和用戶反饋
2. 增加批量下載功能
3. 支援更多語音格式和選項
4. 優化用戶界面體驗

## 開發日誌

### 2025-03-25 開發記錄

#### 今日工作摘要

今天我們將專案從最新版本回退到 4bee18b 版本（"回復到 1a22b8b: 最佳工作版本-下載功能優化"），因為這個版本能正確捕獲 Message ID、Conversation ID 和授權令牌。在後續版本中，雖然新增了一些功能，但核心功能出現問題。

#### 執行操作
1. 查看現有代碼
2. 確認專案版本歷史
3. 將專案回退到 4bee18b 版本
4. 解決 Chrome 擴充功能加載問題

#### 項目現狀
- 目前代碼庫處於 4bee18b 版本（detached HEAD 狀態）
- 主要功能檔案：interceptor.js, content.js, background.js
- 核心功能：攔截 ChatGPT 語音請求並下載對應音頻檔案

#### 關鍵文件功能摘要

##### interceptor.js
- 攔截網頁發起的 fetch 和 XHR 請求
- 從 URL 參數中提取 messageId 和 conversationId
- 從請求頭中捕獲授權令牌 (Authorization Token)
- 將這些資訊通過 postMessage 發送給 content.js

##### content.js
- 接收 interceptor.js 傳來的資訊
- 處理授權令牌和請求數據
- 通過 chrome.runtime.sendMessage 將資訊轉發給 background.js

##### background.js
- 接收並處理 content.js 傳來的資訊
- 使用獲取的 messageId、conversationId 和授權令牌下載語音檔案
- 管理下載歷史記錄

#### 後續工作方向

1. **測試當前版本**：
   - 確認在 Chrome 中正確加載擴充功能
   - 測試語音下載功能是否正常工作
   - 驗證授權令牌、messageId 和 conversationId 是否正確捕獲

2. **可能的改進**：
   - 改進錯誤處理：添加更詳細的錯誤日誌和用戶提示
   - 優化 UI：改進擴充功能的用戶界面
   - 支援更多格式：考慮添加更多音頻格式的支援

#### 重要提示

- 專案使用 Git 進行版本控制，當前在 4bee18b 版本（detached HEAD 狀態）
- 如需保存更改，應創建新分支：`git switch -c <新分支名稱>`
- Chrome 擴充功能可能存在快取問題，如遇到問題請完全移除後重新加載

#### 下次開發時的快速引導信息

```
ChatGPT Voice Downloader 擴充功能開發
目前狀態：處於 4bee18b 版本（回退到最佳工作版本）
主要功能：攔截 ChatGPT 語音請求、提取授權令牌和參數、下載語音檔案
核心文件：interceptor.js (攔截請求)、content.js (中轉資訊)、background.js (下載處理)
關鍵挑戰：確保授權令牌正確捕獲、解決"Failed to Fetch"錯誤
工作目錄：/Users/jo/Desktop/🤖 工程師jojo/chatgpt_voice_downloader_V2/
