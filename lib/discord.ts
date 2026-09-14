type WebhookKey = "orders" | "suppliers" | "suppliers_support" | "support"

const WEBHOOKS: Record<WebhookKey, string | undefined> = {
  orders: process.env.DISCORD_WEBHOOK_MAIN_ORDERS,
  suppliers: process.env.DISCORD_WEBHOOK_SUPPLIERS,
  suppliers_support: process.env.DISCORD_WEBHOOK_SUPPLIERS_SUPPORT,
  support: process.env.DISCORD_WEBHOOK_SUPPORT,
}

type Field = { name: string; value: string; inline?: boolean }

export async function notifyDiscord(
  channel: WebhookKey,
  opts: { title: string; description?: string; fields?: Field[]; url?: string },
): Promise<void> {
  const webhook = WEBHOOKS[channel]
  if (!webhook) return
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: opts.title,
            description: opts.description,
            url: opts.url,
            color: 0x5865f2,
            fields: opts.fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })
  } catch {
    // Never let a notification failure break the request flow.
  }
}
