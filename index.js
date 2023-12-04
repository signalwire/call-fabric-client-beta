require('dotenv').config();
const express = require('express');
const app = express();
const axios = require('axios');
const ClientOAuth2 = require('client-oauth2')

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

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

const oauthConfig = {
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_SECRET,
  accessTokenUri: process.env.OAUTH_TOKEN_URI,
  authorizationUri: process.env.OAUTH_AUTH_URI,
  redirectUri: process.env.OAUTH_REDIRECT_URI
}

const oauthClient = new ClientOAuth2(oauthConfig)

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
  const authorizationUri = oauthClient.code.getUri()

  res.redirect(authorizationUri)
});

app.get('/callback', async (req, res) => {
  const credentials = await oauthClient.code.getToken(req.originalUrl);

  res.render('index', {
    host,
    token: credentials.accessToken,
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