require('dotenv').config();
const express = require('express');
const session = require('express-session');
const app = express();
const axios = require('axios');
const base64url = require('base64url');
const crypto = require('crypto');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({ secret: '74cd5a0bea4542de9322fd95070e353d745bee2900e39576f98bc80a961209fa', resave: false, saveUninitialized: true }));

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

  resp = await axios.post(url, payload, {
    auth: {
      username: process.env.SIGNALWIRE_PROJECT_KEY,
      password: process.env.SIGNALWIRE_TOKEN
    }
  })
  return resp.data
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
  const authEndpoint = process.env.OAUTH_AUTH_URI;
  const verifier = base64url(crypto.pseudoRandomBytes(32));
  req.session.verifier = verifier;
  const challenge = crypto.createHash("sha256").update(verifier).digest();

  const queryParams = new URLSearchParams({
    response_type: 'code',
    // scope: '',
    client_id: process.env.OAUTH_CLIENT_ID,
    redirect_uri: process.env.OAUTH_REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  })

  const authorizationUri = `${authEndpoint}?${queryParams}`

  res.redirect(authorizationUri)
});

app.get('/callback', async (req, res) => {
  const verifier = req.session.verifier;

  response = await axios.post(process.env.OAUTH_TOKEN_URI, {
    client_id: process.env.OAUTH_CLIENT_ID,
    grant_type: 'authorization_code',
    code: req.params.code
    redirect_uri: process.env.OAUTH_REDIRECT_URI,
    code_verifier: verifier
  });

  res.render('index', {
    host,
    token: response.access_token,
    destination: process.env.DEFAULT_DESTINATION,
    firebaseConfig: FIREBASE_CONFIG,
  });
})

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
