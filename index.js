require('dotenv').config();
const express = require('express');
const app = express();
const axios = require('axios');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.set('trust proxy')


import('@auth/express').then(({ ExpressAuth }) => {
  app.use('/api/auth/*', ExpressAuth({
    providers: [
      {
        id: 'signalwire',
        name: 'SignalWire',
        type: 'oauth',
        authorization: {
          url: process.env.OAUTH_AUTH_URI,
          params: { scope: 'email' }
        },
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_SECRET,
        token: process.env.OAUTH_TOKEN_URI,
        userinfo: process.env.OAUTH_USERINFO_URI,
        profile(profile) {
          console.log('$$$$$$', profile);
          return {
            id: profile.id,
            email: profile.email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            display_name: profile.display_name,
            job_title: profile.job_title,
            push_notification_key: profile.push_notification_key
          };
        }
      }
    ]
  }))

  app.listen(process.env.PORT || 3000, () => {
    console.log("Server running on port 3000");
  });
})


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



async function authtentication(req, res, next) {
  console.log(JSON.stringify(req.params))
  console.log(JSON.stringify(req.cookies))
  console.log(JSON.stringify(req.body))
  console.log(JSON.stringify(req.headers))
  return res.redirect("/api/auth/signin")
}


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

app.get('/', authtentication, async (req, res) => {
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

app.get('/oauth', authtentication, (req, res) => {
  res.send(200)
});

// app.get('/callback', async (req, res) => {
//   const credentials = await oauthClient.code.getToken(req.originalUrl);

//   res.render('index', {
//     host,
//     token: credentials.accessToken,
//     destination: process.env.DEFAULT_DESTINATION,
//     firebaseConfig: FIREBASE_CONFIG,
//   });
// })

app.get('/service-worker.js', async (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=UTF-8'
  })

  res.render('service-worker', {
    firebaseConfig: FIREBASE_CONFIG,
  });
});

