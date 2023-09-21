var client = null;

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

async function connect() {
  client = await SignalWire.SignalWire({
    token: _token,
    rootElement: document.getElementById('rootElement'),
  })

  await client.connect()
}


async function makeCall() {
  const call = await client.dial({
    to: document.getElementById('destination').value,
    logLevel: 'debug',
    debug: { logWsTraffic: true },
  })

  await call.start()
}

async function enablePushNotifications () {
  // Initialize Firebase App
  console.log('Firebase config', _firebaseConfig)

  const { vapidKey, ...config } = _firebaseConfig
  const app = FB.initializeApp(config)
  const messaging = FB.getMessaging(app)

  FB.onMessage(messaging, (payload) => {
    console.log('Push payload', payload)
    const body = JSON.parse(payload.notification.body || '{}')
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
      registration,
    )
    const serviceWorker = registration.active ?? registration.waiting ?? registration.installing
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
      console.log('push_notification_key: ', push_notification_key)
    }
  } catch (error) {
    console.error('Service Worker registration failed: ', error)
  }
}


window.ready(async function () {
  await connect();

  const searchParams = new URLSearchParams(location.search);
  console.log('Handle inbound?', searchParams.has('inbound'))
  if (searchParams.has('inbound')) {
    await enablePushNotifications()
  }
});