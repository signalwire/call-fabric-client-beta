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

async function connect() {
  if (!_token) return
  
  client = await SignalWire.SignalWire({
    host: _host, //_host is a global var created by the HTML
    token: _token, // same as _host
    debug: {
      logWsTraffic: true,
    },
    logLevel: 'debug',
    rootElement: document.getElementById('rootElement'),
  })

  await client.connect()
}

async function makeCall() {
  startCallBtn.classList.add('d-none')
  leaveCallBtn.classList.remove('d-none')

  const call = await client.dial({
    to: _destination, //_destination is a global var created by the HTML
    logLevel: 'debug',
    debug: { logWsTraffic: true },
  })
  window.__call = call
  await call.start()
}

async function leaveCall() {
  await window.__call.hangup()
  startCallBtn.classList.remove('d-none')
  leaveCallBtn.classList.add('d-none')
}


window.ready(async function () {
  await connect()
})
