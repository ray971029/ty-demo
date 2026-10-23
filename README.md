# typhoon-data

GitHub Actions 每 30 分鐘用 Puppeteer（無頭 Chrome）抓一次 NCDR 各國颱風預報路徑 KML，
內容有變才 commit 到 `data/multityroute.kml`。網頁再從這個檔案讀取，就不會被 NCDR 的跨來源限制擋下。

## 設定
1. 把整個資料夾放進你的 GitHub repo（根目錄要有 `package.json`、`scripts/`、`.github/workflows/`）。
2. Settings → Actions → General → Workflow permissions 選 **Read and write permissions**。
3. Actions 分頁 → Fetch typhoon KML → Run workflow，手動跑一次確認成功。
4. 資料網址：`https://raw.githubusercontent.com/<帳號>/<repo>/main/data/multityroute.kml`
   填進 `typhoon-tracker.html` 最上面的 `MULTI_ROUTE_DATA_URL`。
