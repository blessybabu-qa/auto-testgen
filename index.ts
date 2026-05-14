import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import { Version3Client } from 'jira.js';
import Groq from 'groq-sdk';

const app = express();
app.use(bodyParser.json());

// --- 🔑 CONFIGURATION (from .env file) ---
const JIRA_HOST = process.env.JIRA_HOST!;
const JIRA_EMAIL = process.env.JIRA_EMAIL!;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

const jiraClient = new Version3Client({
    host: JIRA_HOST,
    authentication: { basic: { email: JIRA_EMAIL, apiToken: JIRA_API_TOKEN } }
});

const groq = new Groq({ apiKey: GROQ_API_KEY });

// --- 🛡️ DUPLICATE PREVENTION ---
const processedTickets = new Set<string>();

// --- 📋 QUEUE SYSTEM ---
const queue: (() => Promise<void>)[] = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    while (queue.length > 0) {
        const task = queue.shift();
        if (task) {
            await task();
            if (queue.length > 0) {
                console.log(`⏳ ${queue.length} ticket(s) still in queue. Waiting 5s...`);
                await new Promise(res => setTimeout(res, 5000));
            }
        }
    }

    isProcessing = false;
};

// --- 🤖 GROQ AI TEST CASE GENERATOR ---
const generateTestCases = async (description: string, issueKey: string): Promise<string> => {
    const prompt = `
You are a Senior QA Automation Engineer. Analyze the following requirement and generate EXACTLY 10 structured test cases.

REQUIREMENT:
"${description}"

FORMAT EACH TEST CASE EXACTLY LIKE THIS:

──────────────────────────────────────
TC-001 | [Test Case Title]
──────────────────────────────────────
Category    : [✅ Positive / ❌ Negative / 📏 Boundary / 🛡️ Security & Edge]
Description : [What this test case verifies]
Steps       :
  1. [Step one]
  2. [Step two]
  3. [Step three]
Expected    : [What should happen]
──────────────────────────────────────

DISTRIBUTE THE 10 TEST CASES AS:
- ✅ Positive Path     → 3 test cases (TC-001 to TC-003)
- ❌ Negative Path     → 3 test cases (TC-004 to TC-006)
- 📏 Boundary Values   → 2 test cases (TC-007 to TC-008)
- 🛡️ Security & Edge  → 2 test cases (TC-009 to TC-010)

Generate all 10 test cases now:
`;

    console.log(`🤖 Calling Groq AI for [${issueKey}]...`);

    const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",  // Free, fast, high quality
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
    });

    return response.choices[0].message.content || "Could not generate test cases.";
};

// --- 📝 POST COMMENT TO JIRA ---
const postToJira = async (issueKey: string, testCasesText: string) => {
    await jiraClient.issueComments.addComment({
        issueIdOrKey: issueKey,
        comment: {
            type: "doc",
            version: 1,
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: "🤖 AI-Generated Test Cases"
                        }
                    ]
                },
                {
                    type: "codeBlock",
                    content: [
                        {
                            type: "text",
                            text: testCasesText
                        }
                    ]
                }
            ]
        } as any
    });
};

// --- 🧠 MAIN WEBHOOK ---
app.post('/jira-webhook', async (req: any, res: any) => {
    const payload = req.body;

    if (!payload.issue) return res.sendStatus(200);

    const issueKey = payload.issue.key;
    const description = payload.issue.fields?.description || "No description provided";
    const statusName = payload.issue.fields?.status?.name;

    console.log(`📢 Webhook received: [${issueKey}] → Status: [${statusName}]`);

    if (statusName !== 'In Progress') return res.sendStatus(200);

    if (processedTickets.has(issueKey)) {
        console.log(`⚠️  [${issueKey}] Already processed. Skipping.`);
        return res.sendStatus(200);
    }

    res.sendStatus(200);
    processedTickets.add(issueKey);

    console.log(`📥 [${issueKey}] Added to queue. Total in queue: ${queue.length + 1}`);

    queue.push(async () => {
        console.log(`\n🚀 Processing [${issueKey}]...`);

        try {
            const testCasesText = await generateTestCases(description, issueKey);
            console.log(`📝 Posting test cases to [${issueKey}]...`);
            await postToJira(issueKey, testCasesText);
            console.log(`✅ Success! Test cases posted to [${issueKey}]`);
            console.log(`─────────────────────────────────────\n`);
        } catch (error) {
            console.error(`❌ Failed to process [${issueKey}]:`, error);
            processedTickets.delete(issueKey);
        }
    });

    processQueue();
});

// --- ❤️ HEALTH CHECK ---
app.get('/health', (req: any, res: any) => {
    res.json({
        status: 'running',
        processedTickets: Array.from(processedTickets),
        queueSize: queue.length,
        isProcessing
    });
});

app.listen(3000, () => {
    console.log('🚀 QA Bridge live on port 3000. Waiting for Jira signals...');
    console.log('❤️  Health check: http://localhost:3000/health');
});