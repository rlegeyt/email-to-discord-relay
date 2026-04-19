# email-to-discord-relay

Forwards Gmail emails matching keyword filters to a Discord channel via webhook. Runs entirely on Google Apps Script — no server required.

## How it works

A time-driven trigger runs `checkEmailsAndRelay` every 5 minutes. It searches for unread emails, checks if the subject or body contains any configured keyword, and posts matching emails as Discord embeds. Processed threads are tagged with a Gmail label (`discord-relayed`) so they're never sent twice.

## Setup

### 1. Create a Discord webhook

1. Open the Discord channel you want emails forwarded to.
2. Go to **Edit Channel → Integrations → Webhooks → New Webhook**.
3. Copy the webhook URL.

### 2. Create a Google Apps Script project

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Delete the default `Code.gs` content and paste in the contents of `Code.gs` from this repo.

### 3. Configure the script

At the top of `Code.gs`, edit the `CONFIG` object:

```js
var CONFIG = {
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/...",  // your webhook URL
  KEYWORDS: ["invoice", "urgent", "alert"],                      // your keywords
  PROCESSED_LABEL: "discord-relayed",                            // Gmail label (auto-created)
  MAX_THREADS_PER_RUN: 20,
};
```

### 4. Set up the trigger

1. In the Apps Script editor, select `createTrigger` from the function dropdown and click **Run**.
2. Approve the permission prompts (Gmail read access + external requests).

That's it. The script will now run every 5 minutes automatically.

> **Note:** The default query (`is:unread newer_than:1d`) only looks at the last 24 hours, so historical mail will never flood your Discord channel. If you change `POLL_INTERVAL_MINUTES` to something longer than a day, adjust the `newer_than` value in `GMAIL_QUERY` to match.

## Customisation

| What | Where |
|---|---|
| Change polling interval | `POLL_INTERVAL_MINUTES` in `CONFIG` |
| Add/remove keywords | `KEYWORDS` in `CONFIG` |
| Exclude specific senders | `EXCLUDED_SENDERS` in `CONFIG` — use a full address (`noreply@example.com`) or a domain (`@example.com`) |
| Change the Discord channel | `DISCORD_WEBHOOK_URL` in `CONFIG` |
| Scope to a specific Gmail folder/sender | `GMAIL_QUERY` in `CONFIG` (standard Gmail search syntax) |

## Removing the trigger

If you want to stop the relay without deleting the project:

1. Open your project at [script.google.com](https://script.google.com).
2. Click the **Triggers** icon in the left sidebar (looks like a clock).
3. Find the row for `checkEmailsAndRelay`.
4. Click the **three-dot menu** (⋮) on the right side of that row.
5. Click **Delete trigger** and confirm.

The script will no longer run automatically. Your configuration and Gmail label are left untouched, so you can re-enable it anytime by running `createTrigger` again.

## Permissions required

- **Gmail** — read messages and manage labels
- **External requests** — to POST to the Discord webhook URL
