const { SignalWire: SWire } = SignalWire

let client = null
let pnSecretKey = null

window.ready = (callback) => {
  if (document.readyState != 'loading') {
    callback()
  } else if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', callback)
  } else {
    document.attachEvent('onreadystatechange', function () {
      if (document.readyState != 'loading') {
        callback()
      }
    })
  }
}

async function initSWClient() {
  if (!_token) {
    console.error('Token not found')
    return
  }

  client = await SWire({
    host: !!_host && _host.trim().length ? _host : undefined,
    token: _token,
    debug: {
      logWsTraffic: true,
    },
    logLevel: 'debug',
  })

  return client
}

async function connect() {
  // Set the token through the console
  _token = window._token
  initSWClient()
}

async function dial() {
  if (!client) {
    console.error('Client is not initialized!')
    return
  }

  const call = await client.dial({
    to: document.getElementById('destination').value,
    logLevel: 'debug',
    debug: { logWsTraffic: true },
    rootElement: document.getElementById('rootElement'),
  })

  window.__call = call

  await call.start()
}

async function hangup() {
  await window.__call.leave()
}

async function enablePushNotifications() {
  btnRegister.disabled = true

  // Initialize Firebase App
  console.log('Firebase config', _firebaseConfig)

  const { vapidKey, ...config } = _firebaseConfig
  const app = FB.initializeApp(config)
  const messaging = FB.getMessaging(app)

  FB.onMessage(messaging, (payload) => {
    console.log('Push payload', payload)
    const body = JSON.parse(payload.notification.body || '{}')
    handlePushNotification(body)
    alert(body.title)
  })

  try {
    const registration = await navigator.serviceWorker.register(
      '/service-worker.js',
      {
        updateViaCache: 'none',
      }
    )

    console.log(
      'Service Worker registration successful with registration: ',
      registration
    )
    const serviceWorker =
      registration.active ?? registration.waiting ?? registration.installing
    if (serviceWorker.state !== 'activated') {
      await new Promise((resolve) => {
        serviceWorker.addEventListener('statechange', ({ target }) => {
          if (target.state === 'activated') {
            resolve()
          }
        })
      })
    }

    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      const token = await FB.getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey,
      })

      /**
       * Register this device as a valid target for PN from SignalWire
       */
      const { push_notification_key } = await client.registerDevice({
        deviceType: 'Android', // Use Android w/ Firebase on the web
        deviceToken: token,
      })
      pnSecretKey = push_notification_key
      console.log('pnSecretKey: ', pnSecretKey)
      btnRegister.classList.add('d-none')
    }
  } catch (error) {
    btnRegister.disabled = false
    console.error('Service Worker registration failed: ', error)
  }
}

/**
 * Read the PN payload and accept the inbound call
 */
async function handlePushNotification(pushNotificationPayload) {
  try {
    const result = await readPushNotification(pushNotificationPayload)
    console.log('Push Notification:', result)
    const { resultType, resultObject } = await client.handlePushNotification(
      result
    )

    switch (resultType) {
      case 'inboundCall':
        window.__call = resultObject
        window.__call.on('destroy', () => {
          console.warn('Inbound Call got cancelled!!')
        })
        await window.__call.answer()
        break
      default:
        this.logger.warn('Unknown resultType', resultType, resultObject)
        return
    }
  } catch (error) {
    console.error('acceptCall', error)
  }
}

function b642ab(base64_string) {
  return Uint8Array.from(window.atob(base64_string), (c) => c.charCodeAt(0))
}

async function readPushNotification(payload) {
  console.log('payload', payload)

  const key = b642ab(pnSecretKey)
  // console.log('key', key)
  const iv = b642ab(payload.iv)
  // console.log('iv', iv)

  // Chain invite and tag to have the full enc string
  const full = atob(payload.invite) + atob(payload.tag)
  const fullEncrypted = Uint8Array.from(full, (c) => c.charCodeAt(0))
  // console.log('fullEncrypted', fullEncrypted)

  async function decrypt(keyData, iv, data) {
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    return window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  }

  const compressed = await decrypt(key, iv, fullEncrypted)
  // console.log('compressed', compressed)

  const result = window.pako.inflate(compressed, { to: 'string' }).toString()
  console.log('Dec:\n', JSON.stringify(JSON.parse(result), null, 2))

  return {
    ...payload,
    decrypted: JSON.parse(result),
  }
}

window.ready(async function () {
  await initSWClient()

  const searchParams = new URLSearchParams(location.search)
  console.log('Handle inbound?', searchParams.has('inbound'))
  if (searchParams.has('inbound')) {
    await enablePushNotifications()
  }
})
