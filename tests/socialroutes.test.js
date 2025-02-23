import request from 'supertest';
import app from '../app';

describe('Social Platform Status API Tests', () => {
  it('should return twitter status as true for a mock user', async () => {
    const response = await request(app)
      .get('/api/social/twitter/status?userId=mockUserId')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.twitter).toBe(true);
  });

  it('should return discord status as true for a mock user', async () => {
    const response = await request(app)
      .get('/api/social/discord/status?userId=mockUserId')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.discord).toBe(true);
  });

  it('should return telegram status as true for a mock user', async () => {
    const response = await request(app)
      .get('/api/social/telegram/status?userId=mockUserId')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.telegram).toBe(true);
  });
});
