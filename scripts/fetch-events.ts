/**
 * Pre-build script: fetches events from Tavily + Google AI and saves to public/events.json
 * Run with: npx tsx scripts/fetch-events.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(__dirname, '../.env') });

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { tavily } from '@tavily/core';
import { z } from 'zod';
import { writeFileSync } from 'fs';

const googleAI = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

const TARGET_SITES = [
    { name: 'KKTIX', domain: 'kktix.com' },
    { name: '寬宏', domain: 'kham.com.tw' },
    { name: '年代', domain: 'ticket.com.tw' },
    { name: '遠大', domain: 'ticketplus.com.tw' },
    { name: 'iNDIEVOX', domain: 'indievox.com' },
    { name: 'BILLBOARD LIVE TAIPEI', domain: 'billboardlivetaipei.tw' },
    { name: '華山文創園區', domain: 'huashan1914.com' },
];

const EventCategoryEnum = z.enum([
    '演唱會', '展覽', '表演藝術', '生活休閒', '其他'
]);

function getDynamicDateParams() {
  const now = new Date();

  // 新增一個格式化工具，確保月份與日期補零
  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
  };

  // 使用 formatDate 來產出 YYYY/MM/DD
  const startDate = formatDate(now);

  const futureDate = new Date(now);
  futureDate.setMonth(now.getMonth() + 2);
  const endDate = formatDate(futureDate);

  const monthKeywords = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setMonth(now.getMonth() + i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    monthKeywords.push(`"${year} ${month}月"`);
  }

  const searchString = monthKeywords.join(' OR ');

  return { startDate, endDate, searchString };
}

const EventSchema = z.object({
    events: z.array(z.object({
        description: z.string().describe('簡短介紹'),
        title: z.string().describe('活動的主標題，請移除 "台北站"、"高雄場" 等後綴，保留核心名稱。例如："五月天 [回到那一天] 巡迴演唱會"'),
        image_url: z.string().optional(), // 如果有的話
        sessions: z.array(z.object({
          location: z.string().describe('該場次的具體展演場館名稱。必須盡可能保留完整名稱（如 "台北流行音樂中心"、"Legacy Taichung"）。若原文僅標示城市（如 "台北"）則填城市名，若完全未提及則填 "未知" 或 null。'),
          date: z.array(z.string()).describe('該場次的日期陣列 ["YYYY/MM/DD"]'),
          url: z.string().describe('該場次的購票連結 (不同場次連結可能不同)'),
        })).describe('將相同活動但不同地點/時間的場次合併於此'),
        category: EventCategoryEnum.describe('活動的主類別，請根據標題與內容判斷'),
        tags: z.array(z.string()).describe('額外的關鍵字標籤，例如 ["搖滾", "韓團"] 或 ["油畫", "攝影"]').optional(),
        url: z.string().describe('活動網址'),
        source: z.enum(['KKTIX', '寬宏', '遠大', '年代', 'iNDIEVOX', 'BILLBOARD LIVE TAIPEI', '華山文創園區', '其他']),
    })),
});

async function main() {
    const { startDate, endDate, searchString } = getDynamicDateParams();
    console.log(`🔍 搜尋時間範圍: ${startDate} ~ ${endDate}`);

    const tvly = tavily({ apiKey: "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" });

    const searchPromises = TARGET_SITES.map(async (site) => {
        const query = `site:${site.domain} ( ${searchString} )`;
        try {
            const result = await tvly.search(query, { maxResults: 15, search_depth: site.name === 'BILLBOARD LIVE TAIPEI' ? "advanced" : "basic" });
            return result.results;
        } catch (e) {
            console.error(`❌ 搜尋 ${site.name} 失敗:`, e);
            return [];
        }
    });

    const allRawResults = (await Promise.all(searchPromises)).flat();
    const uniqueResults = Array.from(
        new Map(allRawResults.map(item => [item.url, item])).values()
    );

    console.log(`📦 共取得 ${uniqueResults.length} 筆不重複結果`);

    const searchContext = uniqueResults
        .map((r, i) => `[ID:${i}] 標題: ${r.title}\n來源: ${r.url}\n內文摘要: ${r.content.slice(0, 1000)}`)
        .join('\n\n---\n\n');

    const result = await generateObject({
        model: googleAI('gemini-2.5-flash'),
        schema: EventSchema,
        prompt: `
            你是一個嚴謹的活動資料提取員。

            【任務目標】
            從提供的 Raw Data 中提取符合時間範圍的活動資訊。

            【資料聚合規則 (Aggregation)】
            若多個搜尋結果為「同一個巡迴/展覽」的不同場地或時間：
            1. 合併為單一 Event 物件。
            2. 主標題 (title) 使用最通用名稱，去除地點後綴（如「台北站」）。
            3. 場次資訊放入 sessions 陣列。
            4. sessions 陣列的 location 必須提取「完整的展演場館名稱」（如 "Zepp New Taipei"、"台北小巨蛋"）。若僅提及城市填寫城市名，完全無資訊填寫 "未知"。絕對不可自行簡化場館名。
            5. 特殊指定：若來源為 Billboard Live TAIPEI 或 華山文創園區，location 請直接填寫 "BILLBOARD LIVE TAIPEI" 或 "華山文創園區"。

            【時間範圍】
            今天日期：${startDate}
            目標範圍：${startDate} ~ ${endDate}
            
            【日期格式嚴格要求】
            請將活動日期轉換為 JSON String Array：
            1. **單日活動**：陣列只有一個元素。
                範例：["2026-02-15"]
            2. **連續/區間活動**：陣列有兩個元素，代表 [開始日期, 結束日期]。
                範例：["2026-02-15", "2026-03-10"]

            【過濾規則】
            1. 嚴格捨棄：內文未提及日期、日期不在目標範圍內。
            2. 雜訊排除：純粹的 "會員登入頁"、"購票須知"、"過期活動"。

            【分類邏輯】
            1. 演唱會：包含 巡迴、Live、演唱會、見面會、音樂祭。
            2. 展覽：包含 特展、展覽、美術館、博覽會、快閃店。
            3. 表演藝術：包含 舞台劇、音樂劇、舞蹈、馬戲、脫口秀、相聲。
            4. 生活休閒：包含 市集、講座、工作坊、路跑、營隊。
            5. 其他：無法歸類者。

            【待處理資料】
            ${searchContext}
        `,
    });

    const events = result.object.events;
    events.sort((a, b) => {
        const dateA = new Date(a.sessions[0]?.date[0]).valueOf();
        const dateB = new Date(b.sessions[0]?.date[0]).valueOf();
        return dateA - dateB;
    });

    const outPath = resolve(__dirname, '../public/events.json');
    writeFileSync(outPath, JSON.stringify({ events }, null, 2), 'utf-8');
    console.log(`✅ 已寫入 ${events.length} 筆活動到 ${outPath}`);
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
