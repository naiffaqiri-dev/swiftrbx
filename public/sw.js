self.addEventListener('push', (event) => {
  let parsedPayload = {}
  try {
    parsedPayload = event.data ? event.data.json() : {}
  } catch {
    parsedPayload = { body: event.data?.text() ?? '' }
  }

  const payload = parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)
    ? parsedPayload
    : {}
  const title = typeof payload.title === 'string' ? payload.title : 'SwiftRBX'
  const body = typeof payload.body === 'string' ? payload.body : ''
  const tag = typeof payload.tag === 'string' ? payload.tag : 'swiftrbx-notification'
  const path = typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//')
    ? payload.url
    : '/tickets'

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    data: { path },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.path
  const target = new URL(typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/tickets', self.location.origin).href

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      if ('navigate' in client) await client.navigate(target)
      return client.focus()
    }
    return self.clients.openWindow(target)
  }))
})
