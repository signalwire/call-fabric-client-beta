require('dotenv').config();
const express = require('express');
const session = require('express-session');
const app = express();
const base64url = require('base64url');
const crypto = require('crypto');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));

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

const token_request = {
  reference: process.env.SUBSCRIBER_REFERENCE,
  password: process.env.SUBSCRIBER_PASSWORD,
  application_id: process.env.CLIENT_ID
}

const host = process.env.RELAY_HOST

async function apiRequest(endpoint, payload = {}, method = 'POST') {
  var url = `https://${process.env.SIGNALWIRE_SPACE}${endpoint}`

  const response = await fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${process.env.SIGNALWIRE_PROJECT_KEY}:${process.env.SIGNALWIRE_TOKEN}`).toString('base64')}`
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    return await response.json();
  } else {
    console.log(await response.text());
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

app.get('/', async (req, res) => {
  const response = await apiRequest('/api/fabric/subscribers/tokens', token_request)
  res.render('index', {
    host,
    token: response.token,
    destination: process.env.DEFAULT_DESTINATION,
    firebaseConfig: FIREBASE_CONFIG,
  });
});

app.get('/minimal', async (req, res) => {
  const response = await apiRequest('/api/fabric/subscribers/tokens', token_request)
  res.render('minimal', {
    host,
    token: response.token,
    destination: process.env.DEFAULT_DESTINATION,
    firebaseConfig: FIREBASE_CONFIG,
  });
});

app.get('/oauth', (req, res) => {
  console.log("oauth: begin initiation");

  const authEndpoint = process.env.OAUTH_AUTH_URI;
  const verifier = base64url(crypto.pseudoRandomBytes(32));
  req.session.verifier = verifier;
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());

  const queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OAUTH_CLIENT_ID,
    redirect_uri: process.env.OAUTH_REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  })

  const authorizationUri = `${authEndpoint}?${queryParams}`

  res.redirect(authorizationUri);
});

app.get('/callback', async (req, res) => {
  console.log("oauth: process callback");

  const params = new URLSearchParams();
  params.append('client_id', process.env.OAUTH_CLIENT_ID);
  params.append('grant_type', 'authorization_code');
  params.append('code', req.query.code);
  params.append('redirect_uri', process.env.OAUTH_REDIRECT_URI);
  params.append('code_verifier', req.session.verifier);

  const response = await fetch(process.env.OAUTH_TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (response.ok) {
    const data = await response.json();
    res.render('index', {
      host,
      token: data.access_token,
      destination: process.env.DEFAULT_DESTINATION,
      firebaseConfig: FIREBASE_CONFIG,
    });
  } else {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
});

app.get('/service-worker.js', async (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=UTF-8'
  })

  res.render('service-worker', {
    firebaseConfig: FIREBASE_CONFIG,
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port 3000");
});
