require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const axios = require('axios');
const cookie_parser = require('cookie-parser')

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors('*'))
app.use(cookie_parser());
app.use(express.static('public'));

app.set('trust proxy', 1);

const authConfig = {
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
  ],
  callbacks: {
    jwt: ({ token, account, profile }) => {
      if (account) {
        token.accessToken = account.access_token
        token.id = profile.id
        token.pushNotificationKey = profile.push_notification_key
      }
      return token
    },
    session({ session, token }) {
      return {
        ...session,
        sat: token.accessToken,
        pushNotificationKey: token.pushNotificationKey,
        user: {
          id: token.id,
          ...session.user,
          username: session.user.email
        }
      }
    }
  }
}

let authGetSession

import('@auth/express').then(({ ExpressAuth, getSession }) => {
  authGetSession = getSession
  async function authSession(req, res, next) {
    res.locals.session = await getSession(req, authConfig)
    next()
  }



  app.use('/api/auth/*', ExpressAuth(authConfig))
  app.use(authSession)

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


const authtentication = async (req, res, next) => {
  const session = res.locals.session ?? (await authGetSession(req, authConfig))

  if (!session?.user) {
    callbackUrl = process.env.OAUTH_REDIRECT_URI ?? `${process.env.BASE_HOST_URL}/oauth`
    res.redirect(`/api/auth/signing?callbackUrl=${callbackUrl`)
  } else {
    res.locals['session'] = session
    next()
  }
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

app.get('/oauth', authtentication, (req, res) => {
  const { session } = res.locals

  res.render('index', {
    host,
    token: session.sat,
    destination: process.env.DEFAULT_DESTINATION,
    firebaseConfig: FIREBASE_CONFIG,
  });
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

