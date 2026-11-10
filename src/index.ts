import "dotenv/config";
import { Bot, GrammyError } from "grammy";
import type { MessageOrigin } from "grammy/types";
import { openDb } from "./db.js";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is not set");

const db = openDb(process.env.DB_PATH ?? "./data/bot.db");
const bot = new Bot(token);

const IN = new Set(["member", "administrator", "creator", "restricted"]);
const code = (v: number | string) => `<code>${v}</code>`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const FEATURES =
  "• Добавь меня в группу или канал — пришлю тебе в личку его ID.\n" +
  "• Перешли мне любое сообщение — скажу ID автора (или канала, откуда пост).\n" +
  "• /id — твой ID (в группе ещё и ID группы).\n" +
  "• /help — эта подсказка.";

const HELP = `Что я умею:\n\n${FEATURES}`;

const welcome = (name: string) =>
  `Привет, ${esc(name)}! 👋\n\n` +
  "Я бот, который показывает ID в Telegram.\n\n" +
  `${FEATURES}\n\n` +
  "Раз ты нажал /start, теперь я смогу писать тебе в личку, когда ты добавишь меня куда-нибудь.";

// Remember everyone who talks to the bot
bot.use(async (ctx, next) => {
  if (ctx.from && !ctx.from.is_bot) db.upsertUser(ctx.from);
  await next();
});

bot.command("start", (ctx) => ctx.reply(welcome(ctx.from!.first_name), { parse_mode: "HTML" }));

bot.command("help", (ctx) => ctx.reply(HELP));

bot.command("id", async (ctx) => {
  const lines = [`Твой ID: ${code(ctx.from!.id)}`];
  if (ctx.chat.type !== "private") lines.push(`ID этого чата: ${code(ctx.chat.id)}`);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
});

// Bot was added to / removed from a group or channel
bot.on("my_chat_member", async (ctx) => {
  const { chat, from, old_chat_member, new_chat_member } = ctx.myChatMember;
  if (chat.type === "private") return; // user blocked/unblocked the bot — not interesting

  const wasIn = IN.has(old_chat_member.status);
  const isIn = IN.has(new_chat_member.status);
  const justAdded = !wasIn && isIn;

  db.upsertUser(from);
  db.upsertChat(chat, new_chat_member.status, justAdded ? from.id : null);
  db.logEvent(chat.id, from.id, old_chat_member.status, new_chat_member.status);

  if (!justAdded) return;

  const kind = chat.type === "channel" ? "канал" : "группу";
  const text =
    `Ты добавил меня в ${kind} «${esc(chat.title ?? "")}».\n` + `ID: ${code(chat.id)}`;

  try {
    await ctx.api.sendMessage(from.id, text, { parse_mode: "HTML" });
  } catch (e) {
    // 403: the user never pressed /start, so the bot can't DM them.
    // Stay silent in the chat itself — the addition is already in the DB.
    if (e instanceof GrammyError && e.error_code === 403) {
      console.log(`user ${from.id} hasn't started the bot; ${chat.id} saved to DB only`);
    } else {
      console.error(`can't notify ${from.id} about ${chat.id}`, e);
    }
  }
});

function describeOrigin(o: MessageOrigin): string {
  switch (o.type) {
    case "user": {
      const u = o.sender_user;
      const name = esc([u.first_name, u.last_name].filter(Boolean).join(" "));
      return `Автор: ${name}${u.username ? ` (@${u.username})` : ""}\nID: ${code(u.id)}`;
    }
    case "hidden_user":
      return (
        `Автор: ${esc(o.sender_user_name)}\n` +
        "ID скрыт: у пользователя запрещена ссылка на аккаунт при пересылке."
      );
    case "chat":
      return `Написано от имени чата «${esc(o.sender_chat.title ?? "")}»\nID чата: ${code(o.sender_chat.id)}`;
    case "channel":
      return `Пост из канала «${esc(o.chat.title ?? "")}»\nID канала: ${code(o.chat.id)}`;
  }
}

// Forwarded message in private chat → who wrote it
bot.chatType("private").on("message:forward_origin", (ctx) =>
  ctx.reply(describeOrigin(ctx.message.forward_origin), { parse_mode: "HTML" }),
);

bot.chatType("private").on("message", (ctx) => ctx.reply(HELP));

bot.catch((err) => console.error("update failed", err.error));

// Command menu in Telegram: full set in private chats, only /id in groups
await bot.api.deleteMyCommands(); // drop the old default-scope list
await bot.api.setMyCommands(
  [
    { command: "start", description: "Приветствие" },
    { command: "id", description: "Мой ID" },
    { command: "help", description: "Что умеет бот" },
  ],
  { scope: { type: "all_private_chats" } },
);
await bot.api.setMyCommands(
  [{ command: "id", description: "Мой ID и ID этого чата" }],
  { scope: { type: "all_group_chats" } },
);
await bot.api.setMyDescription(
  "Показываю ID в Telegram: групп и каналов, куда меня добавили, авторов пересланных сообщений и твой собственный.",
);
await bot.api.setMyShortDescription("ID групп, каналов и пользователей");

bot.start({
  allowed_updates: ["message", "my_chat_member"],
  onStart: (me) => console.log(`@${me.username} started`),
});
