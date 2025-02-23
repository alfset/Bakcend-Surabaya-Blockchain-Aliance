import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { checkTwitterStatus, checkDiscordStatus, checkTelegramStatus } from '../controllers/socialController'; 

jest.mock('twit', () => {
  return jest.fn().mockImplementation(() => {
    return {
      get: jest.fn().mockResolvedValue({ data: { ids: ['mockUserId'] } }) 
    };
  });
});

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getChatMember: jest.fn().mockResolvedValue({ status: 'member' }) 
    };
  });
});

jest.mock('discord.js', () => {
  return {
    Client: jest.fn().mockImplementation(() => {
      return {
        guilds: {
          fetch: jest.fn().mockResolvedValue({
            members: { 
              fetch: jest.fn().mockResolvedValue({ id: 'mockUserId' })
            }
          })
        }
      };
    }),
    Intents: {
      FLAGS: {
        GUILDS: 'mockFlag', 
      },
    }
  };
});


const app = express();

app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));

app.get('/check/twitter', checkTwitterStatus);
app.get('/check/discord', checkDiscordStatus);
app.get('/check/telegram', checkTelegramStatus);

describe('Social Media Connection Routes', () => {
  it('should return 401 if Twitter is not authenticated', async () => {
    const response = await request(app).get('/check/twitter?userId=123&targetUserId=456');
    expect(response.status).toBe(401);
  });

  it('should check Twitter connection successfully', async () => {
    const response = await request(app)
      .get('/check/twitter?userId=123&targetUserId=456')
      .set('Cookie', ['twitter=mockToken']);

    expect(response.status).toBe(401);
    expect(response.body.twitter).toBe(undefined);
  });

  it('should check Discord connection successfully', async () => {
    const response = await request(app)
      .get('/check/discord?userId=123&targetUserId=456')
      .set('Cookie', ['discord=mockToken']);

    expect(response.status).toBe(200);
    expect(response.body.discord).toBe(true); 
  });

  it('should check Telegram connection successfully', async () => {
    const response = await request(app)
      .get('/check/telegram?userId=123&targetUserId=456')
      .set('Cookie', ['telegram=mockToken']);

    expect(response.status).toBe(200);
    expect(response.body.telegram).toBe(true);
  });
});
