import { Client, Intents } from "discord.js";
import TelegramBot from "node-telegram-bot-api";
import Twit from "twit";
import dotenv from 'dotenv';

dotenv.config();

const isTestEnvironment = process.env.NODE_ENV === 'test';

const discordClient = isTestEnvironment
  ? { once: jest.fn(), login: jest.fn(), guilds: { fetch: jest.fn() } }
  : new Client({ intents: [Intents.FLAGS.GUILDS] });

const bot = isTestEnvironment
  ? { getChatMember: jest.fn() }
  : new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

const twitterClient = isTestEnvironment
  ? { get: jest.fn() }
  : new Twit({
      consumer_key: process.env.TWITTER_API_KEY,
      consumer_secret: process.env.TWITTER_API_SECRET,
      access_token: process.env.TWITTER_ACCESS_TOKEN,
      access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    });

// Mocking and environment-specific behavior
if (isTestEnvironment) {
  discordClient.guilds.fetch = jest.fn().mockResolvedValue({
    members: { fetch: jest.fn().mockResolvedValue({ id: 'mockUserId' }) }
  });
  bot.getChatMember = jest.fn().mockResolvedValue({ status: 'member' });
  twitterClient.get = jest.fn().mockResolvedValue({
    data: { ids: ['mockUserId'] }
  });
}

export const checkTwitterStatus = async (req, res) => {
  const { twitter } = req.session;
  if (!twitter) {
    return res.status(401).send('Please authenticate with Twitter first.');
  }

  const userId = req.query.userId;
  const isFollowing = await checkIfUserIsFollowingTwitter(twitter.token, twitter.tokenSecret, userId);

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
  const isInDiscord = await isUserInDiscord(userId);
  res.json({ discord: isInDiscord });
};

async function isUserInDiscord(userId) {
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
  const isInTelegram = await isUserInTelegram(userId);
  res.json({ telegram: isInTelegram });
};

async function isUserInTelegram(userId) {
  try {
    const member = await bot.getChatMember(process.env.TELEGRAM_GROUP_ID, userId);
    return member.status !== 'left';
  } catch (error) {
    return false;
  }
}
