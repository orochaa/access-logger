/* eslint-disable no-secrets/no-secrets */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SendEmailCommand } from '@aws-sdk/client-ses'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyHandler } from 'aws-lambda'
import { dynamo } from '../shared/dynamodb-client.js'
import { getRandomGifUrl } from '../shared/gif.js'
import { ses } from '../shared/ses-client.js'
import { response } from '../shared/utils.js'

const TABLE_NAME = process.env.TABLE_NAME!
const EMAIL_FROM = process.env.EMAIL_FROM!
const EMAIL_TO = process.env.EMAIL_TO!

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const now = new Date()
    const start = new Date(now.getTime() - 86_400_000)
    const accessLogs = await getAccessLogs(start, now)
    const randomGifUrl = await getRandomGifUrl()

    let reportContent: string

    if (accessLogs.length === 0) {
      reportContent = generateNoAccessReportContent(start, now)
    } else {
      const report = generateReport(accessLogs)
      reportContent = formatReport(report, start, now)
    }

    const formattedReport = formatHtmlShell(reportContent, randomGifUrl)
    await sendReportEmail(formattedReport)

    return response(200, { message: 'Report sent' })
  } catch (error) {
    console.error(error)

    return response(500, { message: 'Internal Server Error' })
  }
}

async function getAccessLogs(start: Date, end: Date): Promise<AccessLog[]> {
  const res = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':start': start.toISOString(),
        ':end': end.toISOString(),
      },
    })
  )

  const accessLogs = ((res.Items ?? []) as DynamoAccessLog[])
    .filter(item => !/(localhost|127\.0\.0\.1)/.test(item.meta.pageUrl))
    .map(item => ({ ...item, timestamp: new Date(item.timestamp) }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return accessLogs
}

async function sendReportEmail(htmlBody: string): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      Source: EMAIL_FROM,
      Destination: { ToAddresses: [EMAIL_TO] },
      Message: {
        Subject: { Data: `Daily Access Report` },
        Body: { Html: { Data: htmlBody } },
      },
    })
  )
}

function formatHtmlShell(content: string, randomGifUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Daily Access Report</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.5;margin:0;padding:24px;">
  <img src="${randomGifUrl}" alt="Celebration GIF" style="margin: 0 24px; max-width: 100%; height: auto;" />
  <h1 style="margin-top:0;color:#1e293b;">Daily Access Report</h1>
  ${content}
</body>
</html>
`.trim()
}

function generateNoAccessReportContent(start: Date, end: Date): string {
  return `
  <p style="margin:4px 0 16px;">
    <strong>Window (UTC):</strong> ${formatDate(start)} → ${formatDate(end)}<br/>
    <strong>There were no accesses in the last 24 hours.</strong>
  </p>
  `
}

interface AppReport {
  appName: string
  accesses: AccessLog[]
  browsers: Record<string, number>
  os: Record<string, number>
  locales: Record<string, number>
}

function generateReport(accessLogs: AccessLog[]): AppReport[] {
  const report = new Map<string, AppReport>()

  for (const accessLog of accessLogs) {
    let appReport = report.get(accessLog.appName)

    if (!appReport) {
      appReport = {
        appName: accessLog.appName,
        accesses: [],
        browsers: {},
        locales: {},
        os: {},
      }
      report.set(accessLog.appName, appReport)
    }

    appReport.accesses.push(accessLog)
    appReport.browsers[accessLog.meta.browser.name] =
      (appReport.browsers[accessLog.meta.browser.name] || 0) + 1
    appReport.os[accessLog.meta.os.name] =
      (appReport.os[accessLog.meta.os.name] || 0) + 1
    appReport.locales[accessLog.meta.locale] =
      (appReport.locales[accessLog.meta.locale] || 0) + 1
  }

  return [...report]
    .map(([_, appReport]) => appReport)
    .sort((a, b) => {
      const lengthCompareResult = b.accesses.length - a.accesses.length

      return lengthCompareResult === 0
        ? a.appName.localeCompare(b.appName)
        : lengthCompareResult
    })
}

function formatReport(report: AppReport[], start: Date, end: Date): string {
  let count = 0

  const appSections = report
    .map(appReport => {
      count += appReport.accesses.length

      const browserSummary = Object.entries(appReport.browsers)
        .map(([b, n]) => `${b}: ${n}`)
        .join(', ')
      const osSummary = Object.entries(appReport.os)
        .map(([o, n]) => `${o}: ${n}`)
        .join(', ')
      const localeSummary = Object.entries(appReport.locales)
        .map(([l, n]) => `${l}: ${n}`)
        .join(', ')

      const rows = appReport.accesses
        .map(access => {
          const m = access.meta

          return `
<tr>
  ${td(formatDate(access.timestamp))}
  ${td(`${m.timezone} / ${m.locale}`)}
  ${td(`${m.os.name} ${m.os.version}`)}
  ${td(`${m.browser.name} ${m.browser.version}`)}
  ${td(`${m.device.type} ${m.device.model}`)}
  ${td(m.referrer)}
</tr>`.trim()
        })
        .join('')

      return `
<h2 style="margin:24px 0 8px;color:#2d3a4a;">${appReport.appName}</h2>
<p style="margin:4px 0;">
  <strong>Accesses:</strong> ${appReport.accesses.length}<br/>
  <strong>Browsers:</strong> ${browserSummary}<br/>
  <strong>OS:</strong> ${osSummary}<br/>
  <strong>Locales:</strong> ${localeSummary}
</p>
<table style="border-collapse:collapse;font-family:monospace;font-size:13px;margin-top:8px;">
  <thead>
    <tr>
      ${th('Timestamp')}
      ${th('Locale / TZ')}
      ${th('OS')}
      ${th('Browser')}
      ${th('Device')}
      ${th('Referrer')}
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
`.trim()
    })
    .join('')

  const summary = `
  <p style="margin:4px 0 16px;">
    <strong>Accesses:</strong> ${count}<br/>
    <strong>Window (UTC):</strong> ${formatDate(start)} → ${formatDate(end)}
  </p>
  `

  return `${summary}${appSections}`
}

const formatDate = (date: Date): string => {
  return date.toLocaleString('pt-br', {
    timeZone: 'America/Sao_Paulo',
  })
}

const td = (txt: string): string => {
  return `<td style="padding:4px 8px;border:1px solid #ccc;">${txt}</td>`
}

const th = (txt: string): string => {
  return `<th style="padding:4px 8px;background:#f5f5f5;border:1px solid #ccc;text-align:left;">${txt}</th>`
}
