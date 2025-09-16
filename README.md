# 📊 Budget Buddy (PWA)

Budget Buddy is a simple, offline-capable **Progressive Web App (PWA)** for personal budgeting, debt payoff planning, and paycheck management.  
All data is stored locally on your device — nothing goes to the cloud.

## ✨ Features
- Track **income, expenses (with due dates), and debts**.
- Choose **Avalanche** (highest APR) or **Snowball** (smallest balance) payoff strategy.
- Auto-generate a **per-paycheck plan** that assigns bills before their due dates.
- **Dashboard** with:
  - Monthly snapshot of your budget
  - Savings rate gauge
  - Debt-free ETA (estimate)
  - Bills Account recommendation (averages past bills, rounds to nearest $100 for auto-deposit)
- **Inline editing** — tap any row to update instantly.
- **Dark mode** (follows system, or toggle manually).
- Works **offline**; optional backup/restore to JSON.
- Cross-platform: iPhone, Android, Desktop.

## 📱 iPhone Setup
1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch “Budget Buddy” from your home screen (full-screen, offline ready).

## 📱 Android Setup
1. Open the site in **Chrome**.
2. Tap the **⋮ menu → Add to Home Screen**.
3. Open it from your launcher like a regular app.

## 💻 Desktop Setup
- Just visit the site in **Chrome/Edge/Firefox/Safari**.
- On Chrome/Edge: click **Install App** in the address bar for a standalone window.

## 💾 Data
- All data is stored in your browser (localStorage).
- Use the **Data tab** to export/import backups if needed.
- No servers, no accounts, 100% local.

## 🛠 Development
- This is a static PWA: just host the files on GitHub Pages, Netlify, Cloudflare Pages, or any static server.
- Key files:
  - `index.html` → main UI
  - `app.js` → logic
  - `styles.css` → theme
  - `manifest.json` → PWA config
  - `sw.js` → offline support (service worker)
- Customize colors, icons, or add new categories as needed.

---

⚡ Built to be simple, private, and portable — budget planning without the spreadsheets.
