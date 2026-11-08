import { InputFile } from "grammy";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const MAX_UPLOAD_BYTES = 49 * 1024 * 1024;
const busyChats = new Set();

function extractTikTokUrl(text = "") {
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;

  try {
    const url = new URL(match[0].replace(/[),.!?]+$/, ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      return url.toString();
    }
  } catch {}
  return null;
}

function runYtDlp(url, filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-m", "yt_dlp",
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      "--format", "best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "--max-filesize", "45M",
      "--socket-timeout", "30",
      "--retries", "2",
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 OPR/118.0.0.0",
      "--output", filePath,
      url
    ];

  const python = path.resolve(".venv/bin/python");
const child = spawn(python, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => {
      stderr += chunk;
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("DOWNLOAD_TIMEOUT"));
    }, 180000);

    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
    });
  });
}

export function registerCommands(bot) {
  bot.command("start", ctx => ctx.reply(
    "أهلاً بيك في TikTok Downloader 👋\n\nابعت رابط فيديو TikTok عام، وهحاول أرجعهولك كفيديو."
  ));

  bot.command("help", ctx => ctx.reply(
    "طريقة الاستخدام:\n1) انسخ رابط فيديو TikTok عام.\n2) ابعته هنا.\n3) استنى لحد ما التحميل والإرسال يخلصوا.\n\nالحد الأقصى للإرسال حوالي 49MB."
  ));

  bot.command("ping", ctx => ctx.reply("البوت شغال ✅"));

  bot.on("message:text", async ctx => {
    const url = extractTikTokUrl(ctx.message.text);
    if (!url) {
      await ctx.reply("ابعت رابط TikTok صحيح.");
      return;
    }

    const chatId = ctx.chat.id;
    if (busyChats.has(chatId)) {
      await ctx.reply("فيه فيديو بيتحمّل بالفعل. استنى لما يخلص وجرب تاني.");
      return;
    }

    busyChats.add(chatId);
    const filePath = path.join(tmpdir(), `tiktok-${randomUUID()}.mp4`);
    let status;

    try {
      status = await ctx.reply("⏳ جاري تحميل الفيديو...");
      await ctx.api.sendChatAction(chatId, "upload_video");

      await runYtDlp(url, filePath);

      const stat = await fs.stat(filePath);
      if (stat.size > MAX_UPLOAD_BYTES) {
        throw new Error("VIDEO_TOO_LARGE");
      }

      await ctx.replyWithVideo(new InputFile(filePath), {
        caption: "تم التحميل بواسطة TikTok Downloader ✅",
        supports_streaming: true
      });
      await ctx.api.deleteMessage(chatId, status.message_id).catch(() => {});
    } catch (error) {
      console.error("TikTok download failed:", error?.message || error);
      const message = error?.message === "VIDEO_TOO_LARGE"
        ? "حجم الفيديو أكبر من الحد المسموح لإرساله. جرّب فيديو أقصر."
        : error?.message === "DOWNLOAD_TIMEOUT"
          ? "التحميل استغرق وقتاً طويلاً. جرّب مرة أخرى."
          : "معرفتش أحمل الفيديو. ممكن TikTok مانع الطلب أو الرابط غير متاح.";
      if (status) {
        await ctx.api.editMessageText(chatId, status.message_id, message)
          .catch(() => ctx.reply(message));
      } else {
        await ctx.reply(message);
      }
    } finally {
      await fs.unlink(filePath).catch(() => {});
      busyChats.delete(chatId);
    }
  });
}
