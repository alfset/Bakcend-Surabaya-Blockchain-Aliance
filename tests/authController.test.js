import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server'; 
import User from '../models/User';
import { OAuth2Client } from 'google-auth-library';

jest.mock('google-auth-library');
jest.mock('jsonwebtoken');

// Mock data
const mockUser = {
  _id: '678ba716d873886ac7f7c931',
  firstName: 'John',
  lastName: 'Doe',
  email: 'johndoe@example.com',
  walletAddress: '0x123abc...',
  password: 'hashed-password', 
};

const mockJwt = 'mock-jwt-token';
const googleClient = new OAuth2Client();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  jwt.sign = jest.fn().mockReturnValue(mockJwt);

  googleClient.verifyIdToken = jest.fn().mockResolvedValue({
    getPayload: () => ({ email: mockUser.email }),
  });

  User.findOne = jest.fn();
  User.findByIdAndDelete = jest.fn();
  User.prototype.save = jest.fn();
});

afterAll(async () => {
  await mongoose.connection.close();
});

jest.setTimeout(10000); 


describe('Authentication Tests', () => {

  it('should sign up with Cardano wallet address', async () => {
    User.findOne.mockResolvedValue(null); // No existing user

    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'johndoe@example.com',
        walletAddress: '0x123abc...',
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('User created successfully via Cardano Wallet');
    expect(response.body.token).toBe(mockJwt);
    expect(response.body.user.email).toBe('johndoe@example.com');
  });

  // Test Wallet Login
  it('should login with Cardano wallet address', async () => {
    User.findOne.mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        walletAddress: '0x123abc',
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Login successful via Cardano Wallet');
    expect(response.body.token).toBe(mockJwt);
    expect(response.body.user.email).toBe('johndoe@example.com');
  });

  it('should login with Google token', async () => {
    User.findOne.mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        googleToken: 'mock-google-token',
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Login successful via Gmail');
    expect(response.body.token).toBe(mockJwt);
    expect(response.body.user.email).toBe('johndoe@example.com');
  });

  it('should sign up via Google token', async () => {
    User.findOne.mockResolvedValue(null); // No existing user

    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'johndoe@example.com',
        googleToken: 'mock-google-token',
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('User created successfully via Gmail');
    expect(response.body.token).toBe(mockJwt);
    expect(response.body.user.email).toBe('johndoe@example.com');
  });

  // Test Login with Email
  it('should login with email and password', async () => {
    User.findOne.mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'johndoe@example.com',
        password: 'hashed-password', 
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Login successful via email');
    expect(response.body.token).toBe(mockJwt);
    expect(response.body.user.email).toBe('johndoe@example.com');
  });

  it('should delete the user account', async () => {
    const req = { user: { userId: mockUser._id } };

    User.findByIdAndDelete.mockResolvedValue(mockUser); 

    const response = await request(app)
      .delete('/api/auth/deleteAccount')
      .set('Authorization', `Bearer ${mockJwt}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Account deleted successfully');
  });

  // Test Delete Account for non-existing user
  it('should return 404 if user is not found during account deletion', async () => {
    User.findByIdAndDelete.mockResolvedValue(null); // Simulate no user found

    const response = await request(app)
      .delete('/api/auth/deleteAccount')
      .set('Authorization', `Bearer ${mockJwt}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });
});
