import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['https://surabaya-blockchain-alliance-sand.vercel.app', 'https://x.com'],  // Add your frontend URL here
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Set to true in production for HTTPS
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000, // 1 hour
  },
}));

const oauth = new OAuth({
  consumer: {
    key: process.env.TWITTER_API_KEY,
    secret: process.env.TWITTER_API_SECRET,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  },
});

// Twitter OAuth Routes
app.get('/connect/twitter', async (req, res) => {
  const requestData = {
    url: 'https://api.twitter.com/oauth/request_token',
    method: 'POST',
  };

  try {
    const response = await axios.post(requestData.url, null, {
      headers: oauth.toHeader(oauth.authorize(requestData)),
    });

    const oauth_token = new URLSearchParams(response.data).get('oauth_token');
    req.session.twitter = { oauth_token };

    const twitterAuthUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`;
    res.redirect(twitterAuthUrl);
  } catch (error) {
    console.error('Error initiating Twitter OAuth:', error);
    res.status(500).send('Failed to initiate Twitter OAuth');
  }
});

app.get('/connect/twitter/callback', async (req, res) => {
  const oauth_token = req.query.oauth_token;
  const oauth_verifier = req.query.oauth_verifier;

  if (!oauth_token || !oauth_verifier) {
    return res.status(400).send('Missing OAuth token or verifier');
  }

  try {
    const accessData = {
      url: 'https://api.twitter.com/oauth/access_token',
      method: 'POST',
      data: { oauth_token, oauth_verifier },
    };

    const response = await axios.post(accessData.url, null, {
      headers: oauth.toHeader(oauth.authorize(accessData)),
    });

    const oauth_access_token = new URLSearchParams(response.data).get('oauth_token');
    const oauth_access_token_secret = new URLSearchParams(response.data).get('oauth_token_secret');
    const username = new URLSearchParams(response.data).get('screen_name');

    req.session.twitter = {
      oauth_access_token,
      oauth_access_token_secret,
      username,
    };

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error during Twitter OAuth callback:', error);
    res.status(500).send('Failed to complete Twitter OAuth');
  }
});

// Discord OAuth Routes
app.get('/connect/discord', (req, res) => {
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${process.env.DISCORD_REDIRECT_URI}&response_type=code&scope=identify`;
  res.redirect(discordAuthUrl);
});

app.get('/connect/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const response = await axios.post('https://discord.com/api/oauth2/token', null, {
      params: {
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      },
    });

    const { access_token } = response.data;

    // Get user info from Discord API
    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const { username, discriminator } = userResponse.data;

    req.session.discord = { username: `${username}#${discriminator}` };

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error during Discord OAuth callback:', error);
    res.status(500).send('Failed to complete Discord OAuth');
  }
});

// New endpoints to check status

// Twitter Status Endpoint
app.get('/get/twitter-status', (req, res) => {
  if (req.session.twitter) {
    res.json({
      connected: true,
      username: req.session.twitter.username,
    });
  } else {
    res.json({
      connected: false,
      username: null,
    });
  }
});

app.get('/get/discord-username', (req, res) => {
  if (req.session.discord) {
    res.json({
      username: req.session.discord.username,
    });
  } else {
    res.json({
      username: null,
    });
  }
});

app.get('/dashboard', (req, res) => {
  if (req.session.twitter || req.session.discord) {
    res.send(`
      <h1>Welcome to your Dashboard</h1>
      <p>Your Twitter Username: ${req.session.twitter ? req.session.twitter.username : 'Not connected'}</p>
      <p>Your Discord Username: ${req.session.discord ? req.session.discord.username : 'Not connected'}</p>
    `);
  } else {
    res.send('<h1>You are not connected to Twitter or Discord</h1>');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
