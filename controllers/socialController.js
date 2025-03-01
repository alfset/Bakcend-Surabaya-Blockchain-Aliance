import Twit from 'twit';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import pkg from 'discord.js';
const { Client, Intents } = pkg;

dotenv.config();

  const twitterClient = new Twit({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });

const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS] });
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

export const checkTwitterStatus = async (req, res) => {
  const { twitter } = req.session;
  if (!twitter) {
    return res.status(401).send('Please authenticate with Twitter first.');
  }

  const userId = req.query.userId; 
  const targetUserId = req.query.targetUserId; 

  const isFollowing = await checkIfUserIsFollowingTwitter(twitter.token, twitter.tokenSecret, targetUserId);
  res.json({ twitter: isFollowing });
};

async function checkIfUserIsFollowingTwitter(token, tokenSecret, targetUserId) {
  try {
    const response = await twitterClient.get('friends/ids', { user_id: token });
    const followingIds = response.data.ids;
    return followingIds.includes(targetUserId); 
  } catch (error) {
    console.error("Error fetching Twitter follow status:", error);
    return false;
  }
}

export const checkDiscordStatus = async (req, res) => {
  const userId = req.query.userId;
  const targetUserId = req.query.targetUserId; 
  
  const isInDiscord = await isUserInDiscord(userId, targetUserId);
  res.json({ discord: isInDiscord });
};

async function isUserInDiscord(userId, targetUserId) {
  try {
    const guild = await discordClient.guilds.fetch(process.env.DISCORD_SERVER_ID); 
    const member = await guild.members.fetch(userId);
    return member ? true : false;
  } catch (error) {
    return false;
  }
}

export const checkTelegramStatus = async (req, res) => {
  const userId = req.query.userId; 
  const targetUserId = req.query.targetUserId;  
  
  const isInTelegram = await isUserInTelegram(userId, targetUserId);
  res.json({ telegram: isInTelegram });
};

async function isUserInTelegram(userId, targetUserId) {
  try {
    const member = await bot.getChatMember(process.env.TELEGRAM_GROUP_ID, userId);
    return member.status !== 'left';
  } catch (error) {
    return false;
  }
}
