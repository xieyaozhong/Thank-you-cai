# 謝謝你，菜！顧客端＋攤主端

這個版本將網站拆成兩個獨立入口：

- `customer.html`：顧客瀏覽商品、送出訂單、查看本機同步狀態。
- `owner.html`：攤主登入後查看所有顧客訂單、訂單總覽、更新狀態、同步商品設定。
- `index.html`：角色入口選擇頁。

## 雲端訂單

跨裝置訂單使用 Supabase。公開前端只使用 **publishable key**，不應放入 secret/service-role key。資料表已啟用 Row Level Security：匿名顧客只能新增訂單；只有登記在 `owner_accounts` 的登入使用者才能讀取與更新訂單。

1. 建立 Supabase 專案。
2. 在 SQL Editor 執行 `SUPABASE_SETUP.sql`。
3. 在 Authentication 建立攤主帳號，並依 SQL 檔末尾說明加入 `owner_accounts`。
4. 在 GitHub repository 的 `Settings → Secrets and variables → Actions → Variables` 新增：
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
5. 重新執行 Pages workflow 或推送一次 `main`。

未設定雲端時，顧客端仍可使用本機菜籃與訂單，但會明確標示「離線模式」，攤主端不會假裝已同步。

## 隱私與安全

- 顧客聯絡方式只寫入受 RLS 保護的 `orders` 表。
- 攤主端需要 Supabase email/password 登入。
- secret/service-role key 絕對不可放進 `cloud-config.js` 或 GitHub Pages。
- 目前沒有金流功能；訂單狀態為待確認、已確認、備貨中、可取貨、已完成或已取消。
