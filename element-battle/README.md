# 元素大亂鬥｜Periodic Table Battle

一個以 HTML5、CSS3、Vanilla JavaScript 製作的國中元素週期表雙人對戰遊戲。

目前第一版支援：

- 同機雙人對戰
- Supabase Realtime 兩台裝置連線
- 簡單／中等／困難三種難度
- 7 HP 制度
- 答對攻擊對手、答錯傷害自己
- 兩位玩家同時作答
- 120 ms 同步判定視窗：雙方幾乎同時耗盡 HP 時可判定平手
- 隨機動物角色
- 雷射、受擊、花瓣雨、勝利動畫
- Web Audio API 音效
- MathJax 3 動態數學式
- Cr、Cu 特殊電子組態題
- 平板桌遊模式：左側 +90°、右側 -90°
- 手機、平板、桌機 Responsive Design
- `prefers-reduced-motion` 與手動減少動畫模式

---

## 1. 專案結構

```text
/
├── index.html
├── README.md
├── .nojekyll
├── css/
│   └── style.css
└── js/
    ├── config.js
    ├── config.example.js
    ├── data.js
    ├── questions.js
    ├── audio.js
    ├── effects.js
    ├── network.js
    └── game.js
```

---

## 2. 本機測試

不建議直接雙擊 `index.html` 以 `file://` 開啟；請用一個簡單 HTTP server。

Python：

```bash
python3 -m http.server 8080
```

再開啟：

```text
http://localhost:8080
```

VS Code 也可以使用 Live Server。

---

## 3. 設定 Supabase 連線對戰

本版本使用 **Supabase Realtime Broadcast + Presence**，不需要建立遊戲資料表，也不需要 SQL migration。

### Step 1：建立 Supabase Project

到 Supabase 建立一個 Project。

### Step 2：取得連線資訊

從 Supabase Project 的 Connect／API 設定取得：

- Project URL
- Publishable key（新版通常為 `sb_publishable_...`）

### Step 3：修改 `js/config.js`

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_YOUR_KEY'
};
```

> Publishable key 是設計給瀏覽器端使用的公開金鑰。**不要**把 `secret` 或舊版 `service_role` key 放進 GitHub 或前端 JavaScript。

### Step 4：確認 Realtime 可用

本遊戲的房間使用公開 Realtime channel：

```text
element-battle:ABC123
```

玩家不需要登入帳號。

房主使用 Player 1；第一位成功加入房間的玩家成為 Player 2。第三位玩家會收到「房間已滿」。

---

## 4. 連線同步設計

為避免兩台裝置同時修改 HP 造成競爭條件，本遊戲採用：

```text
Player 1／房主 = authoritative host
```

Player 2 作答後只傳送：

```text
answer_event
```

房主統一處理：

```text
作答結果
↓
傷害計算
↓
HP / Combo
↓
勝負判定
↓
Broadcast canonical state
```

因此雙方顯示的 HP 由房主同步，不是兩邊各自計算。

雙方答案若在約 120 ms 判定視窗內抵達，會一起結算，因此存在：

```text
Player 1 HP = 0
Player 2 HP = 0
→ 平手
```

的情況。

目前設計適合教室活動與一般同儕競賽，不是反作弊競技伺服器。Player 2 的「答案是否正確」仍由自己的瀏覽器判定後傳給房主。若未來要做正式排行榜，需要把題目與答案判定移到 Edge Function／伺服器端。

---

## 5. GitHub Pages 部署

1. 建立 GitHub Repository。
2. 把整個專案上傳到 repository root。
3. 開啟：

```text
Settings → Pages
```

4. Source 選擇：

```text
Deploy from a branch
```

5. Branch 選擇：

```text
main / root
```

完成後 GitHub Pages 即可直接載入本遊戲。

所有路徑都使用相對路徑，因此 repository 名稱不需要寫死在程式碼中。

---

## 6. WordPress 嵌入

若遊戲已部署到 GitHub Pages，可以在 WordPress 使用 Custom HTML：

```html
<iframe
  src="https://YOURNAME.github.io/YOUR-REPOSITORY/"
  width="100%"
  height="900"
  style="border:0; border-radius:16px; overflow:hidden;"
  allow="autoplay"
  loading="lazy">
</iframe>
```

建議遊戲獨立放在 GitHub Pages，再用 iframe 嵌入 WordPress，而不是把所有 JavaScript 直接貼進 WordPress 編輯器。

---

## 7. 題庫位置

### 元素資料

```text
js/data.js
```

每個元素資料包含：

```js
{
  atomicNumber,
  symbol,
  name,
  period,
  group,
  shells,
  massNumber,
  commonIon
}
```

目前包含前 36 號元素，以及國中常見的 Ag、Sn、I、Au、Hg、Pb。

### 題目產生器

```text
js/questions.js
```

入口：

```js
generateQuestion(difficulty, recentKeys)
```

支援：

```text
easy
medium
hard
```

---

## 8. 難度設計

### 簡單

- 中文名稱 → 元素符號
- 元素符號 → 中文名稱

### 中等

- 原子序
- 質子數
- 中性原子的電子數
- 已給質量數的中子數
- K、L、M、N 電子層排列
- 由電子排列判斷元素

### 困難

- 週期
- 族（1～18 族）
- 主族元素價電子
- 常見離子電子數
- 電子層數
- 綜合判斷
- Cr：`[Ar] 3d^5 4s^1`
- Cu：`[Ar] 3d^10 4s^1`

---

## 9. 修改起始 HP

目前 HP 上限寫在 `js/game.js` 的 `7`，愛心 UI 也依 7 顆建立。

若要改成 5 或 10，建議下一版先抽成：

```js
const MAX_HP = 7;
```

再由所有 HP 邏輯共用。

---

## 10. 動畫安全

原始需求是「0.5 秒內全螢幕閃三下」。第一版沒有直接實作這個高頻閃爍，而改為：

- 雷射
- HIT 標籤
- 受擊震動
- 亮度脈衝
- 花瓣雨

並支援：

```css
@media (prefers-reduced-motion: reduce)
```

以及畫面右上角的手動「減少動畫」按鈕。

---

## 11. Supabase 安全注意事項

目前房間是「知道 6 碼房號即可加入」的公開 Realtime channel，適合課堂／同學間快速對戰。

如果之後要公開給大量陌生使用者，建議第二階段加入：

- Supabase Auth anonymous sign-in
- Private Realtime channels
- Realtime Authorization / RLS
- Edge Function 伺服器端題目判定
- Room table / match history
- 排行榜與反作弊

---

## 12. 下一版建議

目前最值得接著做的功能：

- 房主可選題目範圍（前 20、前 36、常見元素、自訂）
- 限時答題模式
- 排行榜
- 班級房間
- QR Code 加入房間
- 教師端觀戰
- 作答統計與錯題分析
- PWA 安裝到 iPad 主畫面
- Supabase match history
- 自訂題庫
