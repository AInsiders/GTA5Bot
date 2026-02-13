# 🎮 GTA Bot — Los Santos in Discord

> **Build your criminal empire. All in text.** Jobs, heists, businesses, the casino, and the streets—experience GTA-style gameplay without leaving Discord.

[![Discord](https://img.shields.io/badge/Discord-Invite%20Bot-5865F2?style=for-the-badge&logo=discord)](https://discord.com/oauth2/authorize?client_id=1430646453033767013)
[![Support Server](https://img.shields.io/badge/Support-Join%20Server-5865F2?style=for-the-badge&logo=discord)](https://discord.gg/fkQ972fmAs)

---

## 🎯 For Users — What Is This?

**GTA Bot** brings the world of Los Santos to your Discord server. Earn cash, climb the ranks, run heists, own businesses, and compete on global leaderboards—all through slash commands and interactive menus. No images, no voice: just pure text-based criminal roleplay.

- **💰 Dual economy** — Wallet (stealable) + Bank (protected). Play smart.
- **💼 Jobs & heists** — Robbery, hitman, racing, car theft, major heists.
- **🏢 Businesses** — MC businesses, nightclubs, warehouses, specialty shops.
- **🎰 Casino** — Slots, blackjack, poker, and more. Buy chips, gamble, cash out.
- **🔫 PvP stealing** — Target other players’ wallets. Protect yours by banking.
- **📊 Leveling & RP** — Reputation, ranks, and leaderboards. Climb to the top.

**Getting started:** Invite the bot → run `/start` → accept terms → run `/menu`. You’re in.

---

## 📋 Discord Bot Description (Short)

**Copy for bot listing / about section (~200 chars):**

> Los Santos in Discord. Jobs, heists, businesses, casino & the streets. Build your criminal empire in text. Wallet + bank, leveling, leaderboards. `/start` to play.

---

## 🛠 For Developers

### Tech Stack

| Layer        | Tech                                   |
|-------------|-----------------------------------------|
| **Bot**     | Python 3.10+, discord.py, slash commands |
| **Database**| Neon (PostgreSQL), psycopg2             |
| **Website** | Static HTML/JS, Vercel serverless API   |

### Quick Setup

1. **Clone** the repo.
2. **Config:** Copy `config.json.template` → `config.json`:
   - `discord_token` — from [Discord Developer Portal](https://discord.com/developers/applications)
   - `neon.database_url` — from [Neon Console](https://console.neon.tech)
3. **Install:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Run:**
   ```bash
   python run_bot.py
   ```

### Project Structure

```
├── src/
│   ├── bot.py           # Main bot, events, tasks
│   ├── core/            # storage, economy, neon_client
│   └── cogs/            # Commands (jobs, heist, casino, etc.)
├── sql/                 # Schema, migrations, functions
├── Website/             # Landing page, stats, leaderboards
├── api/                 # Vercel serverless stats API
└── config.json          # Token, Neon URL (not committed)
```

### Database (Neon)

- **Tables:** `users`, `businesses`, `banking_transactions`, etc.
- **Functions:** `get_website_global_stats`, `get_leaderboard_top`, `record_banking_transaction`, and more.
- **Migrations:** `sql/migrations/` — idempotent, safe to re-run.

### Website Stats

- **Local:** `python -m src.services.stats_api` → site uses `http://127.0.0.1:8765`
- **Production:** Deploy `api/` to Vercel, set `DATABASE_URL`, point `js/config.js` at the Vercel URL.
- Live stats: total users, economy totals, top 100 leaderboards by net worth, cash, chips, level, rep, bank.

---

## 📜 License & Support

- **License:** MIT  
- **Support:** [Discord Server](https://discord.gg/fkQ972fmAs)  
- **Website:** See `Website/` folder for landing page and stats.

*For entertainment only. No real money involved.*
