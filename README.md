# 謝謝你，菜！獨立靜態版

這是一個不需要 ChatGPT、後端、資料庫、API、Node.js 或建置工具的純靜態網站。

## 直接發布到 GitHub Pages

1. 建立一個 GitHub repository。
2. 將 ZIP 內的所有檔案直接放到 repository 根目錄；請保留 `.nojekyll`。
3. 到 repository 的 `Settings → Pages`。
4. 在 `Build and deployment` 選擇 `Deploy from a branch`。
5. 選擇 `main` 分支與 `/(root)`，儲存後等待 GitHub 提供網址。

`index.html` 必須和 `app.js`、`styles.css`、`manifest.webmanifest`、`og.png` 放在同一層。

## 本機使用

直接開啟 `index.html` 即可使用。網站的菜籃、訂單預覽、點數與抽卡收藏只保存在目前瀏覽器的 `localStorage`，不會送到任何伺服器。

## 資源說明

- `index.html`：菜攤前台頁面。
- `owner.html`：獨立攤主頁面，部署後網址為網站根目錄加上 `/owner.html`。
- `catalog.js`、`catalog-extra.js`：前台與攤主頁共用的 40 種蔬果目錄與像素圖。
- `owner.js`、`owner.css`：攤主公告、價格、庫存、上架狀態與本機訂單摘要。
- `styles.css`：完整響應式樣式與扭蛋動畫。
- `app.js`：商品、購物車、本機訂單與抽卡功能。
- `manifest.webmanifest`：可安裝網站資訊，使用相對路徑。
- `og.png`：社群分享圖片。
- `.nojekyll`：讓 GitHub Pages 直接提供靜態檔案。
- `LICENSE`：MIT 授權。

像素蔬果圖由 JavaScript 與 CSS 繪製。網站沒有外部字型或音效檔，也沒有 CDN、GPT、外部雲端站點或 API 依賴。

這個版本只會建立本機訂單預覽，不會送出真實訂單或收集付款資料。

## 攤主頁面連結

本機可直接開啟 `owner.html`。部署到 GitHub Pages 後，連結格式為：`https://你的帳號.github.io/你的專案/owner.html`。首頁頂部與頁尾都已加入「攤主頁面」入口。

攤主設定使用同網域瀏覽器的 `localStorage`，沒有登入、伺服器或跨裝置同步功能。
