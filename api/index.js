import express from 'express';
import cors from 'cors';
import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { withIronSession } from 'next-iron-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['https://surabaya-blockchain-alliance-sand.vercel.app', 'https://x.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Access-Token'], 
  credentials: true, 
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use iron-session for session management
app.use(withIronSession({
  password: process.env.SESSION_SECRET || 'your_secret_key',
  cookieName: 'my-app-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production', // Should be true on production
    httpOnly: true,
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

// Twitter OAuth Flow - Step 1: Get Request Token
app.get('/connect/twitter', async (req, res) => {
  const requestData = {
    url: 'https://api.twitter.com/oauth/request_token',
    method: 'POST',
    data: {
      oauth_callback: 'https://bakcend-surabaya-blockchain-aliance.vercel.app/connect/twitter/callback',
    }
  };

  try {
    const headers = oauth.toHeader(oauth.authorize(requestData));
    
    const response = await axios.post(
      requestData.url,
      new URLSearchParams({ oauth_callback: requestData.data.oauth_callback }),
      { headers }
    );

    const params = new URLSearchParams(response.data);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('Failed to get OAuth tokens');
    }

    req.session.oauth = {
      token: oauthToken,
      tokenSecret: oauthTokenSecret
    };

    await req.session.save();

    const authUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauthToken}`;
    res.json({ authUrl });
  } catch (error) {
    console.error('Error in Twitter auth step 1:', error);
    res.status(500).json({ error: 'Error initiating Twitter authentication' });
  }
});

// Twitter OAuth Callback - Step 2: Handle Callback
app.get('/connect/twitter/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;

  if (!oauth_token || !oauth_verifier) {
    return res.status(400).json({ error: 'Missing oauth_token or oauth_verifier' });
  }

  if (!req.session.oauth || !req.session.oauth.tokenSecret) {
    return res.status(400).json({ error: 'Session expired or invalid. Please try connecting again.' });
  }

  if (req.session.oauth.token !== oauth_token) {
    return res.status(400).json({ error: 'OAuth token mismatch' });
  }

  const requestData = {
    url: 'https://api.twitter.com/oauth/access_token',
    method: 'POST',
    data: { oauth_verifier }
  };

  const token = {
    key: oauth_token,
    secret: req.session.oauth.tokenSecret
  };

  try {
    const headers = oauth.toHeader(oauth.authorize(requestData, token));
    
    const response = await axios.post(
      requestData.url,
      new URLSearchParams({ oauth_verifier }),
      { headers }
    );

    const params = new URLSearchParams(response.data);
    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');
    const screenName = params.get('screen_name');
    const userId = params.get('user_id');

    if (!accessToken || !accessTokenSecret) {
      throw new Error('Failed to get access tokens');
    }

    req.session.twitter = {
      accessToken,
      accessTokenSecret,
      username: screenName,
      userId
    };

    delete req.session.oauth;
    await req.session.save();

    res.redirect('https://surabaya-blockchain-alliance-sand.vercel.app/setup');
  } catch (error) {
    console.error('Error in Twitter callback:', error);
    res.status(500).json({ error: 'Error completing Twitter authentication' });
  }
});

// Get Twitter status
app.get('/get/twitter-status', (req, res) => {
  if (req.session.twitter) {
    res.json({
      connected: true,
      username: req.session.twitter.username
    });
  } else {
    res.json({
      connected: false,
      username: null
    });
  }
});

// Discord OAuth
const discordOAuth = {
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  redirectUri: 'https://bakcend-surabaya-blockchain-aliance.vercel.app/connect/discord/callback',
};

app.get('/connect/discord', (req, res) => {
  const encodedRedirectUri = encodeURIComponent(discordOAuth.redirectUri);
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${discordOAuth.clientId}&redirect_uri=${encodedRedirectUri}&response_type=code&scope=identify`;
  res.redirect(discordAuthUrl);
});

app.get('/connect/discord/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('Code parameter missing');
  }

  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: discordOAuth.clientId,
      client_secret: discordOAuth.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: discordOAuth.redirectUri,
      scope: 'identify',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordUsername = userResponse.data.username;
    req.session.discord = {
      username: discordUsername,
      id: userResponse.data.id,
      accessToken: access_token
    };

    await req.session.save();

    res.redirect('https://surabaya-blockchain-alliance-sand.vercel.app/setup');
  } catch (error) {
    console.error('Error connecting to Discord:', error.response ? error.response.data : error.message);
    res.status(500).send('Error connecting to Discord');
  }
});

// Get Discord username
app.get('/get/discord-username', (req, res) => {
  if (req.session.discord) {
    res.json({ username: req.session.discord.username });
  } else {
    res.json({ username: null });
  }
});

// Telegram OAuth
app.get('/connect/telegram', (req, res) => {
  const authUrl = `https://t.me/@CardanoHubIndonesia_bot?start=auth`; // Your bot's Telegram URL
  res.json({ authUrl });
});

app.post('/connect/telegram/callback', (req, res) => {
  const { hash, id, username, first_name, last_name } = req.body;

  if (!hash || !id || !username || !first_name || !last_name) {
    return res.status(400).send('Invalid Telegram callback parameters');
  }

  const dataCheckString = `${id}${first_name}${last_name}${username}${process.env.TELEGRAM_BOT_TOKEN}`;
  const hashCheck = crypto.createHmac('sha256', process.env.TELEGRAM_BOT_TOKEN)
    .update(dataCheckString)
    .digest('hex');

  if (hash !== hashCheck) {
    return res.status(400).send('Telegram authentication failed');
  }

  req.session.telegram = { id, username, first_name, last_name };

  res.json({
    success: true,
    telegramUser: { id, username, first_name, last_name }
  });
});

// Get Telegram user info
app.get('/get/telegram-user', (req, res) => {
  if (req.session.telegram) {
    res.json({ telegramUser: req.session.telegram });
  } else {
    res.json({ telegramUser: null });
  }
});

// Profile Save Endpoint
app.post('/save-profile', (req, res) => {
  const { username, twitterUsername, discordUsername } = req.body;

  const profileData = {
    username,
    twitter: req.session.twitter ? {
      username: twitterUsername || req.session.twitter.username,
      userId: req.session.twitter.userId
    } : null,
    discord: req.session.discord ? {
      username: discordUsername || req.session.discord.username,
      userId: req.session.discord.id
    } : null,
    telegram: req.session.telegram ? {
      username: req.session.telegram.username,
      userId: req.session.telegram.id
    } : null
  };

  console.log('Saved profile:', profileData);
  res.json({ success: true, profile: profileData });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
