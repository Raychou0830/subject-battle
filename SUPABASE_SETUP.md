# Supabase Realtime 設定

本專案第一版只使用 Realtime Broadcast / Presence，因此不需要建立資料表。

## 需要的資訊

請把 Project URL 與瀏覽器可用的 Publishable key 填入：

```text
js/config.js
```

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_YOUR_KEY'
};
```

## 不可使用

不要在前端放：

```text
sb_secret_...
service_role
```

## Realtime channel

遊戲會動態建立：

```text
element-battle:<6碼房號>
```

例如：

```text
element-battle:K7M3QX
```

使用的事件：

```text
hello
welcome
room_full
start_game
answer_event
combat_event
state
rematch
leave_game
```

## 第一版不需要 SQL

若之後加入排行榜、歷史紀錄或正式反作弊，才建議增加 Postgres table、RLS、Auth 與 Edge Functions。
