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
    { name: 'INDIEVOX', domain: 'indievox.com' },
    { name: 'Billboard Live TAIPEI', domain: 'billboardlivetaipei.tw' },
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
            location: z.string().describe('該場次的具體地點，如 "台北小巨蛋"'),
            date: z.array(z.string()).describe('該場次的日期陣列 ["YYYY/MM/DD"]'),
            url: z.string().describe('該場次的購票連結 (不同場次連結可能不同)'),
        })).describe('將相同活動但不同地點/時間的場次合併於此'),
        category: EventCategoryEnum.describe('活動的主類別，請根據標題與內容判斷'),
        tags: z.array(z.string()).describe('額外的關鍵字標籤，例如 ["搖滾", "韓團"] 或 ["油畫", "攝影"]').optional(),
        url: z.string().describe('活動網址'),
        source: z.enum(['KKTIX', '寬宏', '遠大', '年代', 'Billboard Live TAIPEI', '其他']),
    })),
});

async function main() {
    const { startDate, endDate, searchString } = getDynamicDateParams();
    console.log(`🔍 搜尋時間範圍: ${startDate} ~ ${endDate}`);

    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

    const searchPromises = TARGET_SITES.map(async (site) => {
        const query = `site:${site.domain} ( ${searchString} )`;
        try {
            const result = await tvly.search(query, { maxResults: 15, search_depth: site.name === 'Billboard Live TAIPEI' ? "advanced" : "basic", });
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
        .map((r, i) => `[ID:${i}] 標題: ${r.title}\n來源: ${r.url}\n內文摘要: ${r.content.slice(0, 500)}`)
        .join('\n\n---\n\n');

    const result = await generateObject({
        model: googleAI('gemini-2.5-flash'),
        schema: EventSchema,
        prompt: `
     你是一個嚴格的資料過濾員。
      
      【任務目標】
      從提供的 Raw Data 中提取符合時間範圍的活動。
      
      【資料聚合規則 (Aggregation)】
      如果你發現多個搜尋結果其實是「同一個巡迴」或「同一個展覽」的不同場地/時間：
      1. 請將它們合併為一個 Event 物件。
      2. 標題 (title) 請使用最通用的名稱 (去除地點後綴)。
      3. 將各個場地的資訊放入 sessions 陣列中。
      4. sessions 陣列中的 location 請使用最通用的名稱 (去除地點後綴)。
      5. 若資料來源是 Billboard Live TAIPEI，則 sessions 陣列中的 location 請使用 "BILLBOARD LIVE TAIPEI"。
        
      【當下時間】
      今天是 ${startDate}。
      目標範圍：${startDate} ~ ${endDate}。
      
      【日期格式嚴格要求】
      請將活動日期轉換為 JSON String Array：
      1. **單日活動**：陣列只有一個元素。範例：["2026/02/15"]
      2. **連續/區間活動**：陣列有兩個元素。範例：["2026/02/15", "2026/03/10"]
      3. **年份修正**：請根據當前年份 (${new Date().getFullYear()}) 自動補全。
      
      【過濾規則】
      1. 嚴格檢查日期：內文若沒寫日期，或日期不在範圍內，直接捨棄。
      2. 去除雜訊：如果是 "會員登入頁"、"購票須知"、"過期活動"，直接捨棄。
    
      【分類邏輯】
      1. **演唱會**：包含 "巡迴"、"Live"、"演唱會"、"見面會"、"音樂祭"。
      2. **展覽**：包含 "特展"、"展覽"、"美術館"、"博覽會"、"快閃店"。
      3. **表演藝術**：包含 "舞台劇"、"音樂劇"、"舞蹈"、"馬戲"、"脫口秀"、"相聲"。
      4. **生活休閒**：包含 "市集"、"講座"、"工作坊"、"路跑"、"營隊"。
      5. **其他**：無法歸類於上述者。
      
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
