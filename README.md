# chat-id-bot (@wtf_id_bot)

Показывает ID в Telegram:
- добавили в группу/канал → пишет добавившему в личку ID чата (если тот не жал /start — только запись в базу, в чат ничего не пишет);
- переслали сообщение в личку → ID автора (или канала/чата; у скрытых пользователей ID недоступен);
- `/id` → твой ID (в группе ещё и ID группы).

SQLite (`data/bot.db`): `users`, `chats` (с `added_by` и текущим `bot_status`), `membership_events` — история добавлений/удалений.

```bash
npm i
cp .env.example .env   # BOT_TOKEN=...
npm start              # или npm run dev
```

Аватарка: `assets/avatar.png` (исходник), `assets/avatar.jpg` (640px). Залить в Telegram: `./scripts/set-avatar.sh` (Bot API `setMyProfilePhoto`, только JPG).
