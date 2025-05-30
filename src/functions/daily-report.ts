/* eslint-disable no-secrets/no-secrets */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SendEmailCommand } from '@aws-sdk/client-ses'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyHandler } from 'aws-lambda'
import { dynamo } from '../shared/dynamodb-client.js'
import { ses } from '../shared/ses-client.js'
import { response } from '../shared/utils.js'

const TABLE_NAME = process.env.TABLE_NAME!
const EMAIL_FROM = process.env.EMAIL_FROM!
const EMAIL_TO = process.env.EMAIL_TO!

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const now = new Date()
    const end = now
    const start = new Date(now.getTime() - 86_400_000)

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

    const items = ((res.Items ?? []) as DynamoAccessLog[])
      .filter(item => !/(localhost|127\.0\.0\.1)/.test(item.meta.pageUrl))
      .map(item => ({ ...item, timestamp: new Date(item.timestamp) }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const count = items.length

    if (count === 0) {
      return response(204, { message: 'There is nothing to report' })
    }

    interface AppReport {
      accesses: AccessLog[]
      browsers: Record<string, number>
      os: Record<string, number>
      locales: Record<string, number>
    }
    const apps = new Map<string, AppReport>()

    for (const item of items) {
      let appReport = apps.get(item.appName)

      if (!appReport) {
        appReport = {
          accesses: [],
          browsers: {},
          locales: {},
          os: {},
        }
        apps.set(item.appName, appReport)
      }

      appReport.accesses.push(item)
      appReport.browsers[item.meta.browser.name] =
        (appReport.browsers[item.meta.browser.name] || 0) + 1
      appReport.os[item.meta.os.name] =
        (appReport.os[item.meta.os.name] || 0) + 1
      appReport.locales[item.meta.locale] =
        (appReport.locales[item.meta.locale] || 0) + 1
    }

    const appSections = [...apps.entries()]
      .map(([appName, appReport]) => {
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
</tr>`.trim()
          })
          .join('')

        return `
<h2 style="margin:24px 0 8px;color:#2d3a4a;">${appName}</h2>
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
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
`.trim()
      })
      .join('')

    const mailContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Daily Access Report</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.5;margin:0;padding:24px;">
  <h1 style="margin-top:0;color:#1e293b;">Daily Access Report</h1>

  <p style="margin:4px 0 16px;">
    <strong>Accesses:</strong> ${count}<br/>
    <strong>Window (UTC):</strong> ${formatDate(start)} → ${formatDate(end)}
  </p>

  ${appSections}
</body>
</html>
`.trim()

    await ses.send(
      new SendEmailCommand({
        Source: EMAIL_FROM,
        Destination: { ToAddresses: [EMAIL_TO] },
        Message: {
          Subject: { Data: `Daily Access Report` },
          Body: { Html: { Data: mailContent } },
        },
      })
    )

    return response(200, { message: 'Report sent' })
  } catch (error) {
    console.error(error)

    return response(500, { message: 'Internal Server Error' })
  }
}

function formatDate(date: Date): string {
  return date.toLocaleString('pt-br')
}

const td = (txt: string): string => {
  return `<td style="padding:4px 8px;border:1px solid #ccc;">${txt}</td>`
}

const th = (txt: string): string => {
  return `<th style="padding:4px 8px;background:#f5f5f5;border:1px solid #ccc;text-align:left;">${txt}</th>`
}
