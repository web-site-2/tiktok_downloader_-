import { InputFile } from "grammy"
import youtubedl from "youtube-dl-exec"
import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import fs from "node:fs/promises"

const MAX_UPLOAD_BYTES = 49 * 1024 * 1024
const busyChats = new Set()

function extractTikTokUrl(text = "") {
  const match = text.match(/https?:\/\/[^\s]+/i)
  if (!match) return null
  try {
    const url = new URL(match[0].replace(/[),.!?]+$/, ""))
    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return url.toString()
  } catch {}
  return null
}

export function registerCommands(bot) {
  bot.command("start", (ctx) => ctx.reply(
    "أهلاً بيك في TikTok Downloader 👋\n\nابعت رابط فيديو TikTok عام، وهحاول أرجعهولك كفيديو."
  ))

  bot.command("help", (ctx) => ctx.reply(
    "طريقة الاستخدام:\n1) انسخ رابط فيديو TikTok عام.\n2) ابعته هنا.\n3) استنى لحد ما التحميل والإرسال يخلصوا.\n\nالحد الأقصى للإرسال حوالي 49MB."
  ))

  bot.command("ping", (ctx) => ctx.reply("البوت شغال ✅"))

  bot.on("message:text", async (ctx) => {
    const url = extractTikTokUrl(ctx.message.text)
    if (!url) {
      await ctx.reply("ابعت رابط TikTok صحيح يبدأ بـ https://www.tiktok.com أو https://vt.tiktok.com")
      return
    }

    const chatId = ctx.chat.id
    if (busyChats.has(chatId)) {
      await ctx.reply("فيه فيديو بيتحمّل بالفعل. استنى لما يخلص وجرب تاني.")
      return
    }

    busyChats.add(chatId)
    const filePath = path.join(tmpdir(), `tiktok-${randomUUID()}.mp4`)
    let status

    try {
      status = await ctx.reply("⏳ جاري تحميل الفيديو...")
      await ctx.api.sendChatAction(chatId, "upload_video")

      await youtubedl(url, {
        noPlaylist: true,
        noWarnings: true,
        format: "best[ext=mp4]/best",
        mergeOutputFormat: "mp4",
        maxFilesize: "45M",
        output: filePath,
        socketTimeout: 30,
        retries: 2,
      }, { timeout: 180000 })

      const stat = await fs.stat(filePath)
      if (stat.size > MAX_UPLOAD_BYTES) {
        throw new Error("VIDEO_TOO_LARGE")
      }

      await ctx.replyWithVideo(new InputFile(filePath), {
        caption: "تم التحميل بواسطة TikTok Downloader ✅",
        supports_streaming: true,
      })
      await ctx.api.deleteMessage(chatId, status.message_id).catch(() => {})
    } catch (error) {
      console.error("TikTok download failed:", error?.stderr || error?.message || error)
      const message = error?.message === "VIDEO_TOO_LARGE"
        ? "حجم الفيديو أكبر من الحد المسموح لإرساله. جرّب فيديو أقصر أو بجودة أقل."
        : "معرفتش أحمل الفيديو. تأكد إن الرابط عام وجرب تاني بعد شوية."
      if (status) {
        await ctx.api.editMessageText(chatId, status.message_id, message).catch(() => ctx.reply(message))
      } else {
        await ctx.reply(message)
      }
    } finally {
      await fs.unlink(filePath).catch(() => {})
      busyChats.delete(chatId)
    }
  })
}
