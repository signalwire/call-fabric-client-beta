require('dotenv').config();
let express = require('express');
let app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

const axios = require('axios');

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
  var token = await apiRequest('/api/fabric/subscribers/tokens', { reference: 'myclient' })
  res.render('index', { token, destination: process.env.DEFAULT_DESTINATION });
});

app.get('/minimal', async (req, res) => {
  var token = await apiRequest('/api/fabric/subscribers/tokens', { reference: 'myclient' })
  res.render('minimal', { token, destination: process.env.DEFAULT_DESTINATION });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port 3000");
});