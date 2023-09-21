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


window.ready(async function () {
  await connect();
});