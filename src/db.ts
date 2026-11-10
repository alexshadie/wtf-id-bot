import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Chat, User } from "grammy/types";

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY,
      username    TEXT,
      first_name  TEXT,
      last_name   TEXT,
      first_seen  TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chats (
      id          INTEGER PRIMARY KEY,
      type        TEXT NOT NULL,
      title       TEXT,
      username    TEXT,
      bot_status  TEXT NOT NULL,          -- member / administrator / left / kicked
      added_by    INTEGER REFERENCES users(id),
      first_seen  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- every change of the bot's membership: who added/removed it and where
    CREATE TABLE IF NOT EXISTS membership_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL REFERENCES chats(id),
      user_id     INTEGER REFERENCES users(id),
      old_status  TEXT NOT NULL,
      new_status  TEXT NOT NULL,
      at          TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const upsertUserStmt = db.prepare(`
    INSERT INTO users (id, username, first_name, last_name)
    VALUES (@id, @username, @first_name, @last_name)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      last_seen = datetime('now')
  `);

  const upsertChatStmt = db.prepare(`
    INSERT INTO chats (id, type, title, username, bot_status, added_by)
    VALUES (@id, @type, @title, @username, @bot_status, @added_by)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      title = excluded.title,
      username = excluded.username,
      bot_status = excluded.bot_status,
      added_by = COALESCE(excluded.added_by, chats.added_by),
      updated_at = datetime('now')
  `);

  const insertEventStmt = db.prepare(`
    INSERT INTO membership_events (chat_id, user_id, old_status, new_status)
    VALUES (?, ?, ?, ?)
  `);

  return {
    upsertUser(u: User) {
      upsertUserStmt.run({
        id: u.id,
        username: u.username ?? null,
        first_name: u.first_name,
        last_name: u.last_name ?? null,
      });
    },
    /** addedBy is set only when the bot was just added, so removals keep the original adder */
    upsertChat(c: Chat, botStatus: string, addedBy: number | null) {
      upsertChatStmt.run({
        id: c.id,
        type: c.type,
        title: "title" in c ? c.title : null,
        username: "username" in c ? (c.username ?? null) : null,
        bot_status: botStatus,
        added_by: addedBy,
      });
    },
    logEvent(chatId: number, userId: number, oldStatus: string, newStatus: string) {
      insertEventStmt.run(chatId, userId, oldStatus, newStatus);
    },
  };
}
