import { Bot } from "grammy";
import { registerCommands } from "./src/commands.js";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  process.exit(1);
}

const bot = new Bot(token);
registerCommands(bot);

bot.catch(err => {
  console.error("Telegram bot error:", err.error);
});

console.log("Starting TikTok Downloader...");
bot.start({
  onStart: () => console.log("Bot is running!")
});
