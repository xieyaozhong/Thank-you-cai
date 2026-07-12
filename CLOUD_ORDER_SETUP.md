# 雲端訂單啟用說明

顧客端與攤主端已拆分，跨裝置訂單使用 Supabase。

1. 建立 Supabase 專案。
2. 在 SQL Editor 執行儲存庫根目錄的 `SUPABASE_SETUP.sql`。
3. 在 Authentication 建立攤主帳號，並把使用者 UUID 加入 `owner_accounts`。
4. 在 GitHub repository 的 `Settings → Secrets and variables → Actions → Variables` 建立 `SUPABASE_URL` 與 `SUPABASE_PUBLISHABLE_KEY`。
5. 重新執行 `Publish GitHub Pages` workflow。

公開網站只可使用 publishable key；不可放入 secret 或 service-role key。