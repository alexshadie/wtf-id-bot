# Deploy on Ubuntu (systemd)

Tested on Ubuntu 22.04 / 24.04. The bot uses long polling, so it needs no open
ports, domain or reverse proxy — only outbound HTTPS to `api.telegram.org`.

> One token = one running process. Stop any other copy (e.g. on your laptop)
> before starting the server one, otherwise Telegram returns `409 Conflict`.

## 1. Prerequisites

Node.js 20+ and git:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # v20.x
```

`better-sqlite3` ships prebuilt binaries for Linux x64/arm64. If `npm ci` falls
back to compiling it, install the toolchain: `sudo apt-get install -y build-essential python3`.

## 2. Code

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/alexshadie/wtf-id-bot.git
cd wtf-id-bot
npm ci
```

## 3. Config

```bash
cp .env.example .env
nano .env          # BOT_TOKEN=<token from @BotFather>
chmod 600 .env
```

`DB_PATH` defaults to `./data/bot.db`; the directory is created on start.

Quick check in the foreground (Ctrl+C to stop):

```bash
npm start          # → "@<bot_username> started"
```

## 4. systemd unit

Fill in the template and install it:

```bash
APP_DIR="$PWD"; APP_USER="$USER"; LOG_FILE=/var/log/wtf-id-bot.log

sed -e "s|{{USER}}|$APP_USER|g" -e "s|{{APP_DIR}}|$APP_DIR|g" -e "s|{{LOG_FILE}}|$LOG_FILE|g" \
  deploy/wtf-id-bot.service.template | grep -v '^#' | sudo tee /etc/systemd/system/wtf-id-bot.service >/dev/null

sed -e "s|{{USER}}|$APP_USER|g" -e "s|{{LOG_FILE}}|$LOG_FILE|g" \
  deploy/logrotate.template | grep -v '^#' | sudo tee /etc/logrotate.d/wtf-id-bot >/dev/null

sudo touch "$LOG_FILE" && sudo chown "$APP_USER:$APP_USER" "$LOG_FILE"
sudo systemctl daemon-reload
sudo systemctl enable --now wtf-id-bot
```

Check:

```bash
systemctl status wtf-id-bot --no-pager
tail -f /var/log/wtf-id-bot.log
```

## 5. Avatar (optional, once)

```bash
./scripts/set-avatar.sh            # uploads assets/avatar.jpg via setMyProfilePhoto
```

## 6. Updates

```bash
cd ~/apps/wtf-id-bot && ./scripts/deploy.sh          # pull, npm ci if deps changed, restart
./scripts/deploy.sh --force                          # restart even without new commits
```

`deploy.sh` restarts the unit with `sudo systemctl restart wtf-id-bot`; set
`UNIT=<name>` if you named the unit differently.

## Data and backups

Everything lives in `data/bot.db` (SQLite, WAL mode). Back it up with:

```bash
sqlite3 data/bot.db ".backup 'bot-$(date +%F).db'"
```
