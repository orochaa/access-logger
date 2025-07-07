# 📊 Access Logger & Reporter

This project tracks web app usage by logging frontend access events to DynamoDB and generating email reports summarizing usage patterns. It's built with AWS Lambda, DynamoDB, SES, and the Serverless Framework.

## 🌐 Overview

### 🔁 Flow

1. **Frontend Access**:

   - On first access each day, the frontend sends a `POST` request to the backend.
   - A record is stored in DynamoDB with access metadata (browser, OS, locale, timestamp, etc.).

2. **Daily Report (8 PM UTC)**:

   - A scheduled Lambda runs at 8 PM UTC.
   - It scans access logs from the past 24 hours.
   - If there are access records, it generates a detailed report grouped by app and sends it via email.

3. **Manual Trigger**:
   - The report can also be triggered manually via a `GET` request (useful for testing).

## 🚀 Deployment

Make sure you have the [Serverless Framework](https://www.serverless.com/framework/docs/getting-started) installed:

```bash
npm install -g serverless
```

Deploy to AWS:

```bash
sls deploy
```

## 🛠️ Environment Variables

Make sure the following env vars are set (e.g., in `.env`):

```env
EMAIL_FROM="no-reply@yourdomain.com"
EMAIL_TO="admin@yourdomain.com"

GIPHY_ACCESS_TOKEN=""
```

## 🧑‍💻 Frontend Integration

Send access log on first access of the day:

```ts
await fetch('https://your-api.com/dev/log-access', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ appName: 'MyApp', meta }),
})
```

## 📬 Example Email Report

![image](https://github.com/user-attachments/assets/2ac21006-4b3b-47a5-b127-7d9959128055)

The daily report includes:

- Random celebration GIF, powered by Giphy
- Total access count
- Breakdown by:

  - App
  - Browsers
  - Operating systems
  - Locales

- Access logs (with metadata)
- Timestamped in UTC

Emails are sent using Amazon SES and rendered in HTML.
