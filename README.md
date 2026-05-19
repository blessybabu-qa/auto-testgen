# 🤖 Auto Test Case Generator — AI in QA Workflow

A personal experiment in bringing AI into everyday QA work.  
This tool listens to Jira and automatically generates structured test cases using an LLM — no manual prompting needed.

---

## 💡 What This Does

When a Jira ticket moves to **"In Progress"**, this service:
1. Picks up the ticket description via webhook
2. Sends it to **Groq AI (LLaMA 3.3)** with a QA-focused prompt
3. Gets back **10 structured test cases** (positive, negative, boundary, and edge/security)
4. Posts them as a **comment directly on the Jira ticket**

---

## 🧠 Why I Built This

I'm exploring how AI can be practically integrated into QA workflows — not just as a buzzword, but to actually save time on repetitive tasks like writing initial test cases. This is one of those experiments.

---

## 🗂️ Test Case Structure

Each run generates 10 test cases split across:

| Type | Count |
|------|-------|
| ✅ Positive Path | 3 |
| ❌ Negative Path | 3 |
| 📏 Boundary Values | 2 |
| 🛡️ Security & Edge | 2 |

---

## 🛠️ Tech Stack

- **Node.js + TypeScript** — runtime and language
- **Express** — webhook server
- **Jira.js** — Jira API client
- **Groq SDK** — AI model API (LLaMA 3.3 70B)
- **Railway** — deployment

---

## ⚙️ Setup

1. Clone the repo
2. Create a `.env` file with:

```
JIRA_HOST=https://your-domain.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your_jira_token
GROQ_API_KEY=your_groq_key
```

3. Install dependencies and run:

```bash
npm install
npm run dev       # development
npm run build && npm start   # production
```

4. Point your Jira webhook to `POST /jira-webhook`

---

## 🔍 Health Check

```
GET /health
```

Returns current queue size, processed tickets, and server status.

---

## 📌 Notes

- Duplicate tickets are automatically skipped
- Requests are queued and processed one at a time to avoid rate limits
- This is a learning/experimental project — feedback welcome!
