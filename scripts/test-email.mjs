#!/usr/bin/env node

const toArg = process.argv.find((item) => item.startsWith("--to="));
const to = toArg ? toArg.slice("--to=".length) : "";
if (!to || !to.includes("@")) {
  console.error("Usage: npm run integration:test-email -- --to=test@example.com");
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
if (!apiKey || !from) {
  console.log("NOT CONFIGURED");
  process.exit(0);
}

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to,
    subject: "CAL ACE staging test email",
    html: "<p>CAL ACE staging test email.</p>",
  }),
});

if (!response.ok) {
  console.log("FAILED");
  process.exitCode = 1;
} else {
  console.log("SENT");
}
