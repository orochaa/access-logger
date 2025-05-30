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

    const sections = [...apps.entries()].map(([appName, appReport]) => {
      const browserSummary = Object.entries(appReport.browsers)
        .map(([b, n]) => `${b}: ${n}`)
        .join(', ')
      const osSummary = Object.entries(appReport.os)
        .map(([o, n]) => `${o}: ${n}`)
        .join(', ')
      const localeSummary = Object.entries(appReport.locales)
        .map(([l, n]) => `${l}: ${n}`)
        .join(', ')

      return `
## ${appName}

Accesses: ${appReport.accesses.length}
Browsers: ${browserSummary}
OS:       ${osSummary}
Locales:  ${localeSummary}

Logs:
${appReport.accesses
  .map(
    access =>
      `[${formatDate(access.timestamp)}] ${[
        `locale: ${access.meta.timezone} ${access.meta.locale}`,
        `os: ${access.meta.os.name}@${access.meta.os.version} ${access.meta.platform}`,
        `browser: ${access.meta.browser.name}@${access.meta.browser.version}`,
        `device: ${access.meta.device.type}@${access.meta.device.model}`,
      ].join(', ')}`
  )
  .join('\n')}
`.trim()
    })

    const mailContent = `
# Daily Access Report

Accesses: ${count}
Window: ${formatDate(start)} → ${formatDate(end)}

${sections.join('\n\n')}
`.trim()

    await ses.send(
      new SendEmailCommand({
        Source: EMAIL_FROM,
        Destination: { ToAddresses: [EMAIL_TO] },
        Message: {
          Subject: { Data: `Daily Access Report` },
          Body: { Text: { Data: mailContent } },
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
