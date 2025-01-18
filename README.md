# User Authentication System

## Overview

This project provides a robust authentication system for users within a web application. Users can **sign up**, **log in**, and **delete their accounts** using various authentication methods, including wallet-based authentication, email/password login, and Google token login.

## Features

- **User Signup**: Allows users to create accounts via Cardano wallet, email/password, or Google OAuth.
- **User Login**: Users can log in using their Cardano wallet address, email/password combination, or a Google token.
- **Account Deletion**: Users can delete their accounts securely.
- **JWT Authentication**: All routes are protected by JWT tokens, ensuring secure access control.

## API Routes

### 1. **Signup**
Users can sign up via:
- **Cardano Wallet**: Users can sign up using their wallet address.
- **Google OAuth**: Users can sign up using their Google account via a Google token.
- **Email and Password**: Users can register by providing an email and password.

**POST** `/api/auth/signup`

Request body:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "johndoe@example.com",
  "walletAddress": "0x123abc...",
  "googleToken": "mock-google-token",
  "password": "hashed-password"
}
```

Response:

```json
{
  "message": "User created successfully",
  "token": "mock-jwt-token",
  "user": {
    "email": "johndoe@example.com"
  }
}
```
2. Login
Users can log in via:

Cardano Wallet: Users can log in with their wallet address.
Google OAuth: Users can log in using their Google token.
Email and Password: Users can log in with their email and password.
POST /api/auth/login

Request body (for wallet):

```json

{
  "walletAddress": "0x123abc..."
}
```

Request body (for Google login):

```json
{
  "googleToken": "mock-google-token"
}
```
Request body (for email/password login):
```json
{
  "email": "johndoe@example.com",
  "password": "hashed-password"
}
```
Response:

```json
{
  "message": "Login successful",
  "token": "mock-jwt-token",
  "user": {
    "email": "johndoe@example.com"
  }
}
```
3. Delete Account
Users can delete their account by providing their JWT token for authentication.

DELETE /api/auth/deleteAccount

Headers:

```json

{
  "Authorization": "Bearer <JWT-TOKEN>"
}
```
Response:

```json

{
  "message": "Account deleted successfully"
}
```

# Testing : 


This project includes a series of tests for the routes and authentication system. The tests are written using Jest and Supertest to simulate API calls and check that the authentication system works as expected.

## Test Suite

### The following tests are included:
####  Signup with Cardano wallet address
####  Signup with Google OAuth
#### Signup with email and password
#### Login with Cardano wallet address
#### Login with Google token
#### Login with email and password
#### Delete Account
Account Deletion for non-existing user


Running the Tests
Ensure you have MongoDB running locally or connected to a remote MongoDB service.


### Install all dependencies:
```bash

npm install
Run the tests using Jest:
bash
Copy
npm test
```
#### Environment Variables
This project requires the following environment variables:
```python
MONGODB_URI: MongoDB connection string.
PORT: Port for the server to run on (default is 5000).
JWT_SECRET: Secret key for signing JWT tokens.
```
Example .env file:
```bash
MONGODB_URI=mongodb://127.0.0.1:27017/userDB
PORT=5000
JWT_SECRET=your-secret-key
```
### Technologies Used
Node.js: Backend server.

Express: Web framework for Node.js.

MongoDB: Database for storing user data.

JWT (JSON Web Tokens): Authentication and authorization mechanism.

Jest: Testing framework.

Supertest: HTTP assertion library for testing API endpoints.
