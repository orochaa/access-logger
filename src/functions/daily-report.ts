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
    const accessLogs = await getAccessLogs()

    if (accessLogs.length === 0) {
      return response(204, { message: 'There is nothing to report' })
    }

    const randomGifUrl = await getRandomGifUrl()
    const report = generateReport(accessLogs)
    const formattedReport = formatReport(report, randomGifUrl)

    await ses.send(
      new SendEmailCommand({
        Source: EMAIL_FROM,
        Destination: { ToAddresses: [EMAIL_TO] },
        Message: {
          Subject: { Data: `Daily Access Report` },
          Body: { Html: { Data: formattedReport } },
        },
      })
    )

    return response(200, { message: 'Report sent' })
  } catch (error) {
    console.error(error)

    return response(500, { message: 'Internal Server Error' })
  }
}

async function getAccessLogs(): Promise<AccessLog[]> {
  const NOW = new Date()
  const START = new Date(NOW.getTime() - 86_400_000)

  const res = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':start': START.toISOString(),
        ':end': NOW.toISOString(),
      },
    })
  )

  const accessLogs = ((res.Items ?? []) as DynamoAccessLog[])
    .filter(item => !/(localhost|127\.0\.0\.1)/.test(item.meta.pageUrl))
    .map(item => ({ ...item, timestamp: new Date(item.timestamp) }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return accessLogs
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

function formatReport(report: AppReport[], randomGifUrl: string): string {
  let count = 0
  const NOW = new Date()
  const END = NOW
  const START = new Date(NOW.getTime() - 86_400_000)

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

  const formattedReport = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Daily Access Report</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.5;margin:0;padding:24px;">
  <img src="${randomGifUrl}" alt="Celebration GIF" style="margin: 0 24px; max-width: 100%; height: auto;" />
  <h1 style="margin-top:0;color:#1e293b;">Daily Access Report</h1>

  <p style="margin:4px 0 16px;">
    <strong>Accesses:</strong> ${count}<br/>
    <strong>Window (UTC):</strong> ${formatDate(START)} → ${formatDate(END)}
  </p>

  ${appSections}
</body>
</html>
`.trim()

  return formattedReport
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

async function getRandomGifUrl(): Promise<string> {
  const url = new URL('https://api.giphy.com/v1/gifs/search')
  url.searchParams.set('api_key', process.env.GIPHY_ACCESS_TOKEN ?? '')
  url.searchParams.set('q', 'celebration')
  url.searchParams.set('offset', String(randomNumberBetween(0, 25)))
  url.searchParams.set('limit', String(25))
  url.searchParams.set('rating', 'g')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('bundle', 'messaging_non_clips')

  const res = await fetch(url.toString())

  if (!res.ok) {
    console.error(
      `Giphy API error: ${res.status} ${res.statusText}`,
      await res.text()
    )

    return ''
  }

  const { data } = (await res.json()) as {
    data: { images: { original: { url: string } } }[]
  }
  const gifList = data.map(item => item.images.original.url)
  const randomGif = gifList[randomNumberBetween(0, gifList.length - 1)]

  return randomGif
}

function randomNumberBetween(n1: number, n2: number): number {
  return Math.floor(Math.random() * (n2 - n1 + 1)) + n1
}
