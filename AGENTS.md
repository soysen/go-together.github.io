# 這週去哪玩 — AI Agent 專案指引

## 專案概述

「這週去哪玩」是一個台灣活動資訊聚合網站，每週自動從多個售票平台抓取活動資料，經 AI 彙整後產生靜態頁面，部署至 GitHub Pages。

## 技術架構

| 層級 | 技術 |
|------|------|
| 框架 | Next.js 16（App Router, Static Export） |
| 語言 | TypeScript |
| 樣式 | TailwindCSS 4 |
| 資料來源 | Tavily Search API → Gemini AI 結構化 |
| 部署 | `out/` → GitHub Actions → GitHub Pages |

## 檔案結構

```
app/
├── page.tsx          # 主頁面（活動列表 + 篩選）
├── layout.tsx        # 根 layout
├── components/       # UI 元件（SidePanel 等）
├── api/              # API routes（開發階段用）
scripts/
└── fetch-events.ts   # 資料抓取腳本（Tavily + Gemini）
public/
└── events.json       # 建置時產生的活動資料
.github/workflows/
└── static.yml        # GitHub Pages 部署 workflow
```

## 開發慣例

### 語言
- UI 文字使用**繁體中文**
- 程式碼註解與 commit message 使用英文或中文皆可
- 變數名稱使用英文

### 樣式
- 使用 TailwindCSS utility classes
- 自訂色票定義在 CSS 中（`bg-menu`, `bg-mint`, `bg-gold`）
- 支援 dark mode（使用 `dark:` prefix）

### 資料流
1. `scripts/fetch-events.ts` 從售票平台搜尋活動
2. Gemini AI 將原始搜尋結果結構化為 `EventSchema`
3. 輸出至 `public/events.json`
4. `next build` 產生靜態站點至 `out/`
5. 推送至 `main` 後 GitHub Actions 自動部署

### 活動分類
固定五類：`演唱會`、`展覽`、`表演藝術`、`生活休閒`、`其他`

### 資料來源
KKTIX、寬宏、年代、遠大、iNDIEVOX、Billboard Live Taipei、華山文創園區

## 常用指令

```bash
npm run dev            # 開發模式
npm run fetch-events   # 抓取最新活動資料
npm run build          # 建置靜態站點（自動先執行 fetch-events）
```

## 每週建置

使用 `/weekly-build` workflow 執行每週建置流程，詳見 `.agents/workflows/weekly-build.md`。

## Agent Skills

已安裝 7 個 agent-skills（`.agents/skills/`），涵蓋 UI 開發、除錯、效能優化、code review 等面向。

> **⚠️ 重要 Agent 開發規範：防範 LLM 幻覺與資料驗證**
> 當 Agent 被指派實作或修改「牽涉到外部 API 或 LLM 結構化輸出（如 `fetch-events.ts`）」的功能時，必須：
> 1. 主動將資料視為不可信任 (Untrusted Data)。
> 2. 實作完成後，強制自主執行 `@[/code-review-and-quality]`。
> 3. 特別查驗「**外部防護 (Security)**」與「**邊緣情況 (Correctness)**」，確保具備程式端 (TypeScript/Zod) 的二次強制過濾機制，絕不可單方面信賴 LLM 輸出的邏輯正確性。
