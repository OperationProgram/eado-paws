# EaDo Paws — Backend 🐾
> Node.js + Express + SQLite + Nodemailer

Handles contact form submissions: saves to a database and emails you + the customer.

---

## Project Structure

```
eado-paws-backend/
├── server.js       # Express API server
├── database.js     # SQLite database helpers
├── .env.example    # Environment variable template
├── .gitignore      # Ignores .env and database files
├── package.json    # Dependencies
└── data/
    └── eadopaws.db # Auto-created SQLite database (don't commit this)
```

---

## Setup (Step by Step)

### Step 1 — Install Node.js
If you don't have it: download from https://nodejs.org (choose the LTS version)

Verify it worked:
```bash
node --version
npm --version
```

### Step 2 — Install dependencies
```bash
cd eado-paws-backend
npm install
```

### Step 3 — Set up your environment file
```bash
# Copy the template
cp .env.example .env

# Open .env in any text editor and fill in your values
```

Your `.env` file should look like this:
```
PORT=3001
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password-here
EMAIL_TO=hello@eadopaws.com
FRONTEND_URL=http://127.0.0.1:8080
```

### Step 4 — Get your Gmail App Password
You CANNOT use your regular Gmail password. Google requires an "App Password":

1. Go to https://myaccount.google.com/security
2. Make sure 2-Step Verification is ON
3. Search for "App passwords" in the search bar
4. Select "Mail" as the app, then click Generate
5. Copy the 16-character password → paste it as EMAIL_PASS in .env

### Step 5 — Start the server
```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

You should see:
```
📦 Database connected: .../data/eadopaws.db
✅ Submissions table ready
🐾 EaDo Paws backend running at http://localhost:3001
```

### Step 6 — Test it
Open your browser and visit: http://localhost:3001/api/health

You should see:
```json
{ "status": "ok", "service": "EaDo Paws API" }
```

---

## API Endpoints

| Method | Endpoint           | Description                        |
|--------|-------------------|------------------------------------|
| POST   | /api/contact       | Submit the contact form            |
| GET    | /api/submissions   | View all submissions (admin use)   |
| GET    | /api/health        | Health check                       |

### POST /api/contact — Expected body:
```json
{
  "first-name": "Jane",
  "last-name": "Smith",
  "email": "jane@email.com",
  "phone": "713-000-0000",
  "dog-name": "Buddy",
  "dog-breed": "Golden Retriever",
  "service": "dog-walking",
  "message": "Looking for morning walks!"
}
```

---

## Running Both Frontend + Backend Together

Open **two terminal windows**:

**Terminal 1 — Backend:**
```bash
cd eado-paws-backend
npm start
```

**Terminal 2 — Frontend:**
```bash
cd eado-paws
live-server
```

Then visit http://127.0.0.1:8080 and submit the form!

---

## Going Live (Deployment)

When you deploy, update two things:

1. In `eado-paws/js/main.js`, change:
```js
const API_URL = 'http://localhost:3001';
// to your real domain:
const API_URL = 'https://api.eadopaws.com';
```

2. In your backend `.env`, change:
```
FRONTEND_URL=https://www.eadopaws.com
```

**Recommended backend hosting (free tiers available):**
- **Railway.app** — easiest, just push to GitHub
- **Render.com** — free tier, connects to GitHub
- **Fly.io** — slightly more setup but very fast
