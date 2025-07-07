/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SendEmailCommand } from '@aws-sdk/client-ses'
import { ses } from './ses-client.js'

const EMAIL_FROM = process.env.EMAIL_FROM!
const EMAIL_TO = process.env.EMAIL_TO!

export async function sendReportEmail(
  subject: string,
  htmlBody: string
): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      Source: EMAIL_FROM,
      Destination: { ToAddresses: [EMAIL_TO] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: htmlBody } },
      },
    })
  )
}

export function formatHtmlShell(
  title: string,
  content: string,
  randomGifUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.5;margin:0;padding:24px;">
  <img src="${randomGifUrl}" alt="Celebration GIF" style="margin: 0 24px; max-width: 100%; height: auto;" />
  <h1 style="margin-top:0;color:#1e293b;">${title}</h1>
  ${content}
</body>
</html>
`.trim()
}

export function generateNoAccessReportContent(
  period: string,
  start: Date,
  end: Date
): string {
  return `
  <p style="margin:4px 0 16px;">
    <strong>Window (UTC):</strong> ${formatDate(start)} → ${formatDate(end)}<br/>
    <strong>There were no accesses in the last ${period}.</strong>
  </p>
  `
}

export function generateReport(accessLogs: AccessLog[]): AppReport[] {
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

export function formatReport(
  report: AppReport[],
  start: Date,
  end: Date
): string {
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

function formatDate(date: Date): string {
  return date.toLocaleString('pt-br', {
    timeZone: 'America/Sao_Paulo',
  })
}

function td(txt: string): string {
  return `<td style="padding:4px 8px;border:1px solid #ccc;">${txt}</td>`
}

function th(txt: string): string {
  return `<th style="padding:4px 8px;background:#f5f5f5;border:1px solid #ccc;text-align:left;">${txt}</th>`
}

interface AppReport {
  appName: string
  accesses: AccessLog[]
  browsers: Record<string, number>
  os: Record<string, number>
  locales: Record<string, number>
}
