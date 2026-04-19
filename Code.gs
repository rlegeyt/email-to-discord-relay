// =============================================================================
// CONFIGURATION
// =============================================================================

var CONFIG = {
  // Discord webhook URL — paste yours here
  DISCORD_WEBHOOK_URL: "YOUR_DISCORD_WEBHOOK_URL",

  // Emails matching ANY of these keywords (in subject or body) will be forwarded.
  // Case-insensitive. Supports plain strings.
  KEYWORDS: [
    "invoice",
    "urgent",
    "alert",
    "password reset",
  ],

  // Gmail label applied to emails after they've been processed, to avoid
  // re-sending. The label will be created automatically on first run.
  // Note: "-label:<this value>" is always appended to GMAIL_QUERY at runtime.
  PROCESSED_LABEL: "discord-relayed",

  // Emails from these addresses or domains will never be relayed, even if they
  // match a keyword. Use full addresses ("noreply@example.com") or just the
  // domain ("@example.com") for wildcard matching.
  EXCLUDED_SENDERS: [
    // "noreply@example.com",
    // "@newsletters.com",
  ],

  // How many emails to process per run (keep low to stay within quota)
  MAX_THREADS_PER_RUN: 20,

  // How often the trigger runs, in minutes (minimum 1)
  POLL_INTERVAL_MINUTES: 5,

  // Gmail search query used to find candidate emails.
  // newer_than:1d ensures only recent mail is checked — avoids processing your
  // entire inbox history on first run. Increase if your trigger interval is > 1d.
  // Examples:
  //   "is:unread label:inbox newer_than:1d"   — only inbox
  //   "is:unread from:@example.com newer_than:1d"
  GMAIL_QUERY: "is:unread newer_than:1d",
};

// =============================================================================
// ENTRY POINT — attach this function to a time-driven trigger
// =============================================================================

function checkEmailsAndRelay() {
  var label = getOrCreateLabel(CONFIG.PROCESSED_LABEL);

  // Search for emails not yet processed (-label: exclusion prevents re-processing)
  var query = CONFIG.GMAIL_QUERY + " -label:" + CONFIG.PROCESSED_LABEL;
  var threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS_PER_RUN);

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();

    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];
      if (!message.isUnread()) continue;

      var subject = message.getSubject();
      var body = message.getPlainBody();
      var from = message.getFrom();
      var date = message.getDate();

      if (matchesKeywords(subject, body) && !isSenderExcluded(from)) {
        sendToDiscord(from, subject, body, date);
      }
    }

    // Mark thread as processed regardless of keyword match
    thread.addLabel(label);
  }
}

// =============================================================================
// KEYWORD MATCHING
// =============================================================================

function matchesKeywords(subject, body) {
  var text = (subject + " " + body).toLowerCase();
  for (var i = 0; i < CONFIG.KEYWORDS.length; i++) {
    if (text.indexOf(CONFIG.KEYWORDS[i].toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// EXCLUSION CHECK
// =============================================================================

function isSenderExcluded(from) {
  var fromLower = from.toLowerCase();
  for (var i = 0; i < CONFIG.EXCLUDED_SENDERS.length; i++) {
    if (fromLower.indexOf(CONFIG.EXCLUDED_SENDERS[i].toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// DISCORD
// =============================================================================

function sendToDiscord(from, subject, body, date) {
  // Trim body to Discord's embed limit
  var maxBodyLength = 1000;
  var truncatedBody = body.length > maxBodyLength
    ? body.substring(0, maxBodyLength) + "\n…*(truncated)*"
    : body;

  var payload = {
    embeds: [
      {
        title: subject || "(no subject)",
        description: truncatedBody,
        color: 0x5865F2, // Discord blurple
        fields: [
          { name: "From", value: from, inline: true },
          { name: "Received", value: date.toLocaleString(), inline: true },
        ],
        footer: { text: "email-to-discord-relay" },
      },
    ],
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(CONFIG.DISCORD_WEBHOOK_URL, options);

  if (response.getResponseCode() !== 204) {
    Logger.log("Discord webhook error: " + response.getContentText());
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

// Run this once manually to register the time-driven trigger
function createTrigger() {
  // Remove any existing triggers for checkEmailsAndRelay to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "checkEmailsAndRelay") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("checkEmailsAndRelay")
    .timeBased()
    .everyMinutes(CONFIG.POLL_INTERVAL_MINUTES)
    .create();
  Logger.log("Trigger created — checkEmailsAndRelay will run every " + CONFIG.POLL_INTERVAL_MINUTES + " minutes.");
}
