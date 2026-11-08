FadeHost TikTok bot patch

Replace these files in the existing project:
- package.json (project root)
- src/commands.js (inside src folder)

Keep the existing index.js unchanged. It already imports registerCommands from ./src/commands.js
and reads TELEGRAM_BOT_TOKEN from FadeHost's environment.

After replacing files, redeploy/restart the app. The build/install step runs npm install.

Important runtime requirement:
The youtube-dl-exec package downloads yt-dlp during npm install and requires Python 3.9+ available as python3 on the build/runtime environment. If the build log says python3 is missing, switch the app runtime to Python or use a different hosting setup; do not keep retrying the same deploy.

Do not paste the Telegram token into code or chat. Keep TELEGRAM_BOT_TOKEN in FadeHost Settings > Environment variables.
Stop the Termux copy before testing on the server so only one polling process uses the token.
