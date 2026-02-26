import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { tavily } from '@tavily/core';
import { z } from 'zod';

const TARGET_SITES = [
  { name: 'KKTIX', domain: 'kktix.com' },
  { name: '寬宏', domain: 'kham.com.tw' },
  { name: '年代', domain: 'ticket.com.tw' },
  { name: '遠大', domain: 'ticketplus.com.tw' },
  { name: 'iNDIEVOX', domain: 'indievox.com' },
  { name: 'BILLBOARD LIVE TAIPEI', domain: 'billboardlivetaipei.tw' },
  { name: '華山文創園區', domain: 'huashan1914.com' },
];
export const EventCategoryEnum = z.enum([
  '演唱會',
  '展覽',
  '表演藝術', // 包含舞台劇、音樂劇、舞蹈、脫口秀
  '生活休閒', // 包含市集、講座、體驗活動
  '其他'
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

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const { startDate, endDate, searchString } = getDynamicDateParams();

    console.log(`正在搜尋時間範圍: ${startDate} ~ ${endDate}`);
    console.log(`搜尋關鍵字: ${searchString}`);

    // ===== Step 1: 先用 Tavily 搜尋 =====
    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
    // ===== Step 1: 平行搜尋 (Parallel Search) =====
    // 策略：與其發一個大 request，不如發 5 個小 request，確保每個網站都有資料
    const searchPromises = TARGET_SITES.map(async (site) => {
      // 針對該網站的最佳化 Query
      // 例: site:kktix.com 演唱會 ( "2026 2月" OR ... )
      const query = `site:${site.domain} ( ${searchString} )`;

      try {
        const result = await tvly.search(query, {
          // 這裡不需要 includeDomains 了，因為 query 裡已經用 site: 鎖定
          maxResults: 15, // 每個網站只抓 6 筆最準的，5個站就有 30 筆
          search_depth: site.name === 'BILLBOARD LIVE TAIPEI' ? "advanced" : "basic", // 省錢用 basic，如果要深挖改用 "advanced"
        });
        return result.results;
      } catch (e) {
        console.error(`搜尋 ${site.name} 失敗:`, e);
        return []; // 失敗回傳空陣列，不要讓整個 Promise.all 炸掉
      }
    });

    // 等待所有搜尋完成並攤平陣列 (Flat)
    const allRawResults = (await Promise.all(searchPromises)).flat();

    // ===== Step 1.5: 去重 (Deduplication) =====
    // 有時同一個活動會有不同 URL (例如 kktix.com/events/123 與 kktix.com/events/123/register)
    // 簡單用 URL 去重可以節省 LLM Token
    const uniqueResults = Array.from(
      new Map(allRawResults.map(item => [item.url, item])).values()
    );
    // ===== Step 2: 整理 Context 給 LLM =====
    // 這裡加一點 prompt engineering，幫 LLM 預處理內容
    const searchContext = uniqueResults
      .map((r, i) => {
        // 截斷過長的內容，保留 Token 給更多活動
        const contentSnippet = r.content.slice(0, 1000);
        return `[ID:${i}] 標題: ${r.title}\n來源: ${r.url}\n內文摘要: ${contentSnippet}`;
      })
      .join('\n\n---\n\n');

    console.log(`[Tavily] 搜尋結果: ${searchContext}`);

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
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

    console.log(`[LLM] 整理完成，共 ${result.object.events.length} 筆活動`);
    return Response.json(result.object);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API Error]', message);

    if (message.includes('quota') || message.includes('429') || message.includes('exceeded')) {
      return Response.json(
        { error: 'QUOTA_EXCEEDED', message: 'API 額度已用完，請稍後再試或更換 API Key。' },
        { status: 429 }
      );
    }

    return Response.json(
      { error: 'INTERNAL_ERROR', message: `伺服器錯誤：${message}` },
      { status: 500 }
    );
  }
}