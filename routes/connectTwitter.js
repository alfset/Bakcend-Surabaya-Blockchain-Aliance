import { OAuth } from 'oauth';
import dotenv from 'dotenv';

dotenv.config();

const oauth = new OAuth.OAuth(
  `https://api.twitter.com/oauth/request_token`,
  `https://api.twitter.com/oauth/access_token`,
  process.env.TWITTER_CONSUMER_KEY,
  process.env.TWITTER_CONSUMER_SECRET,
  '1.0A',
  'http://localhost:5000/connect/twitter/callback',
  'HMAC-SHA1'
);

app.get('/connect/twitter', (req, res) => {
  oauth.getOAuthRequestToken((err, oauth_token, oauth_token_secret, results) => {
    if (err) {
      res.status(500).send('Error getting OAuth request token');
    } else {
      req.session.oauth_token = oauth_token;
      req.session.oauth_token_secret = oauth_token_secret;
      res.redirect(`https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`);
    }
  });
});

app.get('/connect/twitter/callback', (req, res) => {
  oauth.getOAuthAccessToken(
    req.session.oauth_token,
    req.session.oauth_token_secret,
    req.query.oauth_verifier,
    (err, oauth_access_token, oauth_access_token_secret, results) => {
      if (err) {
        res.status(500).send('Error getting OAuth access token');
      } else {
        // Save access token and secret in your database or session
        const twitterUser = {
          access_token: oauth_access_token,
          access_token_secret: oauth_access_token_secret,
          user_id: results.user_id,
          screen_name: results.screen_name
        };
        // Save twitterUser to link it to the current user profile
        res.json({ success: true, twitterUser });
      }
    }
  );
});
