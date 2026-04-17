---
description: 每週手動建置流程 — 抓取最新活動資料並產生靜態網站
---

# 每週建置流程

此工作流負責抓取最新活動資料（Tavily 搜尋 + Gemini AI 彙整）並建置靜態站點。

## 前置條件

確認 `.env` 包含以下環境變數：
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `TAVILY_API_KEY`

## 步驟

// turbo
1. 確認環境變數已設定（不顯示值）：

```bash
grep -c 'API_KEY' .env
```

預期輸出數量 ≥ 2。若不足，提醒使用者補齊後才能繼續。

// turbo
2. 安裝依賴（若 `node_modules` 不存在或過舊）：

```bash
npm install
```

3. 抓取最新活動資料：

```bash
npm run fetch-events
```

此步驟會：
- 透過 Tavily 搜尋 KKTIX、寬宏、年代、遠大、iNDIEVOX、Billboard Live Taipei、華山文創園區的活動
- 透過 Gemini AI 彙整並結構化活動資料
- 輸出至 `public/events.json`

**成功標誌**：終端顯示 `✅ 已寫入 N 筆活動到 .../public/events.json`

// turbo
4. 驗證活動資料已更新：

```bash
cat public/events.json | head -5 && echo "..." && echo "Total events: $(cat public/events.json | grep -c '"title"')"
```

確認活動數量合理（通常 > 10 筆），且日期在未來兩個月範圍內。

5. 建置靜態站點：

```bash
npm run build
```

此步驟執行 `next build`，輸出靜態檔案到 `out/` 目錄。

**成功標誌**：終端顯示 `Export successful` 或類似訊息，且 `out/` 目錄已產生。

// turbo
6. 驗證建置產物：

```bash
ls -la out/ && echo "--- index.html preview ---" && head -3 out/index.html
```

確認 `out/` 目錄包含 `index.html`、`events.json` 等檔案。

7. 提交並推送變更：

```bash
git add public/events.json out/
git commit -m "chore: update events data $(date +%Y-%m-%d)"
git push origin main
```

推送後 GitHub Actions 會自動部署到 GitHub Pages。

## 故障排除

| 問題 | 解法 |
|------|------|
| `fetch-events` API 額度用盡 | 檢查 Tavily / Gemini 用量，等待額度重置 |
| `fetch-events` 輸出 0 筆活動 | 檢查搜尋日期範圍是否正確、目標網站是否可連線 |
| `next build` 失敗 | 執行 `npm run dev` 檢查是否有語法錯誤 |
| `events.json` 格式異常 | 手動檢視 JSON 結構，確認符合 `EventSchema` |
