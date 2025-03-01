const fetch = require('node-fetch');

app.get('/connect/discord', (req, res) => {
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=http://localhost:5000/connect/discord/callback&response_type=code&scope=identify%20guilds`;
  res.redirect(discordAuthUrl);
});

app.get('/connect/discord/callback', async (req, res) => {
  const code = req.query.code;
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:5000/connect/discord/callback',
    })
  });

  const tokenData = await tokenResponse.json();
  const { access_token } = tokenData;

  const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
    headers: {
      Authorization: `Bearer ${access_token}`
    }
  });

  const discordUser = await userResponse.json();
  res.json({ success: true, discordUser });
});
