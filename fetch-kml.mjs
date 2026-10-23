// 用無頭瀏覽器抓 NCDR 各國颱風預報路徑 KML，存成 data/multityroute.kml
// 本機測試：node scripts/fetch-kml.mjs
// 可用環境變數：KML_URL（改抓別的網址）、PUPPETEER_EXECUTABLE_PATH（指定 Chrome）
import puppeteer from 'puppeteer';
import { mkdir, writeFile, readdir, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const URL_ = process.env.KML_URL || 'https://satis.ncdr.nat.gov.tw/kml/multityroute.aspx';
const ORIGIN = new URL(URL_).origin + '/';
const OUT = new URL('../data/multityroute.kml', import.meta.url);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const looksLikeKml = t => typeof t === 'string' && /<kml[\s>]/i.test(t) && /<Placemark/i.test(t);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
let text = null;
const errors = [];
try {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' });

  // 做法 1：直接開網址，讀回應本文（KML 被當成檔案下載時會丟 ERR_ABORTED，改走做法 2）
  try {
    const resp = await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60000 });
    if (resp) {
      console.log('做法 1 HTTP', resp.status(), resp.headers()['content-type'] || '');
      const t = await resp.text();
      if (looksLikeKml(t)) text = t; else errors.push('做法 1：內容不是 KML（前 120 字：' + t.slice(0, 120).replace(/\s+/g, ' ') + '）');
    }
  } catch (e) { errors.push('做法 1：' + e.message); }

  // 做法 2：先到網站首頁取得同源環境，再用 fetch 抓（不受跨來源限制）
  if (!text) {
    try {
      await page.goto(ORIGIN, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      const t = await page.evaluate(async u => {
        const r = await fetch(u, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }, URL_);
      if (looksLikeKml(t)) text = t; else errors.push('做法 2：內容不是 KML');
    } catch (e) { errors.push('做法 2：' + e.message); }
  }

  // 做法 3：伺服器把 KML 當「附件下載」送出時，讓瀏覽器直接下載到暫存資料夾再讀檔
  if (!text) {
    try {
      const dir = await mkdtemp(path.join(tmpdir(), 'kml-'));
      const cdp = await browser.target().createCDPSession();
      await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
      const p2 = await browser.newPage();
      await p2.setUserAgent(UA);
      await p2.goto(URL_, { timeout: 60000 }).catch(() => {}); // 下載會讓 goto 以 ERR_ABORTED 結束，屬正常
      for (let i = 0; i < 30 && !text; i++) {
        await new Promise(r => setTimeout(r, 500));
        const files = (await readdir(dir)).filter(f => !f.endsWith('.crdownload'));
        if (files.length) { const t = await readFile(path.join(dir, files[0]), 'utf8'); if (looksLikeKml(t)) text = t; else errors.push('做法 3：下載內容不是 KML'); break; }
      }
      if (!text && !errors.some(e => e.startsWith('做法 3'))) errors.push('做法 3：沒有下載到檔案');
    } catch (e) { errors.push('做法 3：' + e.message); }
  }
} finally {
  await browser.close();
}

if (!text) {
  console.error('抓取失敗：\n - ' + errors.join('\n - '));
  process.exit(1); // 讓 Actions 顯示失敗；舊檔案不會被覆蓋
}
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(OUT, text, 'utf8');
console.log('已寫入 data/multityroute.kml（' + text.length + ' 字元）');
