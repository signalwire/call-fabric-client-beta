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
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
)

const FIREBASE_CONFIG = JSON.stringify({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
  vapidKey: process.env.FIREBASE_VAPID_KEY,
})

function getOAuthConfig(req) { return JSON.stringify({
  authority: "cf-reference", // dummy authority
  metadata: {
    issuer: process.env.SIGNALWIRE_FABRIC_API_URL,
    authorization_endpoint: process.env.OAUTH_AUTH_URI,
    token_endpoint: process.env.OAUTH_TOKEN_URI,
  },
  client_id: process.env.OAUTH_CLIENT_ID,
  redirect_uri: getCallbackUrl(req),
  response_type: "code",
})}

const host = process.env.RELAY_HOST
const fabricApiUrl = process.env.SIGNALWIRE_FABRIC_API_URL


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

async function getUserInfo(accessToken) {
  return await apiRequest(process.env.OAUTH_USERINFO_URI, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

async function getSubscriberToken(reference, password) {
  const tokenRequest = {
    reference: reference,
    password: password,
    application_id: process.env.OAUTH_APPLICATION_ID,
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

app.get('/', async (req, res) => {
let token
  let user
  if (req.session && req.session.token) {
    token = req.session.token
    user = req.session.user
  }

  res.render('index', {
    host,
token: token,
    user: user,
    fabricApiUrl: fabricApiUrl,
    destination: process.env.DEFAULT_DESTINATION,
    firebaseConfig: FIREBASE_CONFIG,
    oauthConfig: getOAuthConfig(req)
  })
})

app.get('/minimal', async (req, res) => {
  let token
  if (req.session && req.session.token) {
    token = session.token
  }

  res.render('minimal', {
    host,
    token: token,
    fabricApiUrl: fabricApiUrl,
    destination: process.env.DEFAULT_DESTINATION,
    firebaseConfig: FIREBASE_CONFIG,
  })
})

app.get('/callback', async (req, res) => {
  console.log('oauth: process callback')

  res.render('index', {
    host,
    token: null,
    user: null,
    fabricApiUrl: fabricApiUrl,
    destination: process.env.DEFAULT_DESTINATION,
    firebaseConfig: FIREBASE_CONFIG,
    oauthConfig: getOAuthConfig(req),
  })
})

app.get('/userinfo', async (req, res) => {
  const accessToken = req.headers['authorization'].split(' ')[1];
  

  if(!accessToken || !accessToken.length) {
    res.sendStatus(401)
  }
  req.session.token = accessToken
  const userInfo = await getUserInfo(accessToken)
  req.session.user = userInfo

  res.json(userInfo)
})

app.get('/subscriber', (req, res) => {
  res.render('subscriber')
})

app.post('/subscriber', async (req, res) => {
  console.log('process subscriber')

  const { reference, password } = req.body

  try {
    const tokenData = await getSubscriberToken(reference, password)
    const userInfo = await getUserInfo(tokenData.token)

    req.session.token = tokenData.token
    req.session.user = userInfo

    res.redirect('/')
  } catch (error) {
    console.error(error)
    res
      .status(500)
      .send('<h1>An error occurred</h1><p>' + error.message + '</p>')
  }
})

app.get('/service-worker.js', async (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=UTF-8',
  })

  res.render('service-worker', {
    firebaseConfig: FIREBASE_CONFIG,
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
