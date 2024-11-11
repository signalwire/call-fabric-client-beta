require('dotenv').config()
const express = require('express')
const session = require('express-session')
const app = express()
const base64url = require('base64url')
const crypto = require('crypto')

const PORT = process.env.PORT || 3000

app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static('public'))


const host = process.env.RELAY_HOST


function getCallbackUrl(req) {
  const protocol = req.get('x-forwarded-proto') || req.protocol
  return process.env.OAUTH_REDIRECT_URI ?? `${protocol}://${req.get('host')}/callback`
}

async function apiRequest(uri, options) {
  const response = await fetch(uri, options)

  if (!response.ok) {
    console.log('error response:', await response.text())
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return await response.json()
}

async function getAccessToken(code, verifier, callbackUrl) {
  const params = new URLSearchParams()
  params.append('client_id', process.env.OAUTH_CLIENT_ID)
  params.append('grant_type', 'authorization_code')
  params.append('code', code)
  params.append('redirect_uri', callbackUrl)
  params.append('code_verifier', verifier)

  return await apiRequest(process.env.OAUTH_TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
}

async function getSubscriberToken() {
  const tokenRequest = {
    reference: process.env.SUBSCRIBER_REFERENCE, // the subscriber username
    application_id: process.env.OAUTH_APPLICATION_ID, // to get aa valid token we need to pass the application id
    ch: process.env.SAT_CH,
  }

  return await apiRequest(
    `https://${process.env.SIGNALWIRE_SPACE}/api/fabric/subscribers/tokens`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SIGNALWIRE_PROJECT_KEY}:${process.env.SIGNALWIRE_TOKEN}`
        ).toString('base64')}`,
      },
      body: JSON.stringify(tokenRequest),
    }
  )
}

// Starts here... a request to index
app.get('/', async (req, res) => {
  let token
  try {
    // POST the server to get a new token
    const tokenData = await getSubscriberToken()

    
    // we ask the template engine to render the HTML passing the 
    res.render('minimal', {
      host,
      token: tokenData.token,
      destination: process.env.DEFAULT_DESTINATION,
    })
  } catch (error) {
    console.error(error)
    res
      .status(500)
      .send('<h1>An error occurred</h1><p>' + error.message + '</p>')
  }
})


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
