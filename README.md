# OctoSky — Weather-as-a-Service

**Project Orca** | Target: Hetzner VPS "Octopus" (Ubuntu 24.04, 2 vCPU / 4 GB RAM)

---

## Architecture Overview

```
┌─────────────┐   stdout    ┌─────────────┐   HTTP    ┌──────────┐
│  Hunter     │────────────▶│  n8n        │─────────▶│  Ollama  │
│  (Puppeteer)│             │  Orchestrator│          │  (Phi-3) │
└─────────────┘             └──────┬──────┘          └──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼               ▼
             ┌───────────┐  ┌───────────┐  ┌────────────┐
             │ weather.  │  │PostgreSQL │  │  Nginx     │
             │ json      │  │ Archive   │  │ + Widget   │
             └───────────┘  └───────────┘  └────────────┘
```

---

## Directory Structure

```
/opt/octosky/
├── hunter.js                 # Puppeteer scraper
├── package.json
├── node_modules/
├── database/
│   └── 001_init.sql          # PostgreSQL bootstrap
├── n8n-workflow/
│   ├── README.js             # Topology diagram
│   ├── node-a-parse-stdout.js
│   ├── node-b-ai-prompt.js
│   ├── node-c-merge.js
│   └── workflow-reference.json
├── nginx/
│   └── octosky.conf          # Nginx vhost config
└── widget/
    ├── widget.js             # Embeddable widget
    └── index.html            # Demo page
```

---

## Deployment Steps (on "Octopus")

### 1. Prerequisites

```bash
# System packages
sudo apt update && sudo apt install -y \
  curl git nginx postgresql postgresql-contrib \
  chromium-browser

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Ollama (local AI)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull phi3

# n8n (global install or Docker)
npm install -g n8n
```

### 2. Database

```bash
sudo -u postgres psql -f /opt/octosky/database/001_init.sql
# Edit the password in the SQL file FIRST, or ALTER ROLE afterward:
# ALTER ROLE octosky_user WITH PASSWORD 'your_secure_password';
```

### 3. Scraper

```bash
cd /opt/octosky
npm install
# Test:
node hunter.js | jq .
```

### 4. n8n Workflow Setup

1. Start n8n: `n8n start` or via systemd.
2. Open the n8n UI (default: `http://localhost:5678`).
3. Create a new workflow with the topology described in `n8n-workflow/README.js`.
4. Copy the code from each `node-*.js` file into the corresponding Code node.
5. Configure the PostgreSQL credential with `octosky_user`.
6. Set the Cron trigger to run every 30 minutes.
7. Activate the workflow.

### 5. Nginx

```bash
sudo cp /opt/octosky/nginx/octosky.conf /etc/nginx/sites-available/octosky
sudo ln -sf /etc/nginx/sites-available/octosky /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Create the initial empty JSON so Nginx doesn't 404:
echo '{"cities":[],"generatedAt":"pending"}' | sudo tee /var/www/html/weather.json
```

### 6. Widget

Copy `widget/widget.js` to `/var/www/html/widget.js`, then embed on any page:

```html
<script src="https://YOUR_SERVER_IP/widget.js"></script>
```

Edit `CONFIG.dataUrl` inside `widget.js` to point to your server's public IP.

---

## Environment Variables (optional)

| Variable | Used By | Description |
|---|---|---|
| `OCTOSKY_DB_PASSWORD` | n8n credential | PostgreSQL password for `octosky_user` |
| `OLLAMA_HOST` | n8n HTTP node | Ollama endpoint (default `http://localhost:11434`) |
| `N8N_BASIC_AUTH_USER` | n8n | Protect the n8n UI |
| `N8N_BASIC_AUTH_PASSWORD` | n8n | Protect the n8n UI |

---

## Useful PostgreSQL Queries

```sql
-- Latest snapshot
SELECT * FROM weather.latest_snapshot;

-- Search a city inside JSONB
SELECT scraped_at, city_obj
FROM   weather.weather_logs,
       jsonb_array_elements(cities) AS city_obj
WHERE  city_obj->>'city' ILIKE '%istanbul%'
ORDER  BY scraped_at DESC
LIMIT  5;

-- Count records per day
SELECT date_trunc('day', scraped_at) AS day, count(*)
FROM   weather.weather_logs
GROUP  BY 1 ORDER BY 1 DESC;
```

---

## Security Checklist

- [ ] Change `octosky_user` password from `CHANGE_ME_IN_PRODUCTION`
- [ ] Enable UFW: `sudo ufw allow 80/tcp && sudo ufw allow 22/tcp && sudo ufw enable`
- [ ] Set up HTTPS with Certbot: `sudo certbot --nginx`
- [ ] Restrict n8n access (basic auth or firewall)
- [ ] Set `Access-Control-Allow-Origin` to your specific domain instead of `*`

---

*OctoSky — Project Orca · Built for Hetzner "Octopus"*
