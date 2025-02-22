import { checkSignature, generateNonce } from '@meshsdk/core';
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import { TwitterApi } from 'twitter-api-v2';
import passport from 'passport';
import GitHubStrategy from 'passport-github2'; 

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

async function backendGetNonce(userAddress) {
  const nonce = generateNonce('I agree to the terms and conditions of Cardano Hub Indonesia: ');
  return nonce;
}

async function backendVerifySignature(userAddress, signature, nonce) {
  const result = checkSignature(nonce, signature, userAddress);
  return result;
}

export const signup = async (req, res) => {
  const { firstName, lastName, email, walletAddress, googleToken, signature, twitterToken, githubToken } = req.body;

  if (googleToken) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email; 
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const newUser = new User({ firstName, lastName, email });
      await newUser.save();

      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(201).json({
        message: "User created successfully via Gmail",
        token,
        user: newUser,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error during Google authentication", error: error.message });
    }
  } else if (twitterToken) {
    try {
      const user = await twitterClient.v2.verifyCredentials(twitterToken);
      const existingUser = await User.findOne({ email: user.email });
      if (existingUser) {
        return res.status(400).json({ message: "User with this Twitter account already exists" });
      }

      const newUser = new User({ firstName, lastName, email: user.email });
      await newUser.save();

      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(201).json({
        message: "User created successfully via Twitter",
        token,
        user: newUser,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error during Twitter authentication", error: error.message });
    }
  } else if (githubToken) {
    try {
      const { data } = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${githubToken}`,
        },
      });

      const email = data.email;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User with this GitHub account already exists" });
      }

      const newUser = new User({ firstName, lastName, email });
      await newUser.save();

      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(201).json({
        message: "User created successfully via GitHub",
        token,
        user: newUser,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error during GitHub authentication", error: error.message });
    }
  } else if (walletAddress && signature) {
    try {
      const nonce = await backendGetNonce(walletAddress);
      const isValid = await backendVerifySignature(walletAddress, signature, nonce);

      if (!isValid) {
        return res.status(400).json({ message: "Invalid signature" });
      }
      const existingUser = await User.findOne({ walletAddress });
      if (existingUser) {
        return res.status(400).json({ message: "User with this wallet address already exists" });
      }
      const newUser = new User({ firstName, lastName, email, walletAddress });
      await newUser.save();

      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(201).json({
        message: "User created successfully via wallet",
        token,
        user: newUser,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  } else {
    res.status(400).json({ message: "Please provide wallet address, Google token, Twitter token, or GitHub token" });
  }
};

export const login = async (req, res) => {
  const { walletAddress, googleToken, signature, twitterToken, githubToken } = req.body;

  if (googleToken) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const email = payload.email;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(200).json({
        message: "Login successful via Gmail",
        token,
        user: user,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error during Google authentication", error: error.message });
    }
  } else if (twitterToken) {
    try {
      const user = await twitterClient.v2.verifyCredentials(twitterToken);

      const existingUser = await User.findOne({ email: user.email });
      if (!existingUser) {
        return res.status(400).json({ message: "User not found" });
      }

      const token = jwt.sign({ userId: existingUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(200).json({
        message: "Login successful via Twitter",
        token,
        user: existingUser,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error during Twitter authentication", error: error.message });
    }
  } else if (githubToken) {
    try {
      const { data } = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${githubToken}`,
        },
      });

      const user = await User.findOne({ email: data.email });
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(200).json({
        message: "Login successful via GitHub",
        token,
        user: user,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error during GitHub authentication", error: error.message });
    }
  } else if (walletAddress && signature) {
    try {
      const nonce = await backendGetNonce(walletAddress);
      const isValid = await backendVerifySignature(walletAddress, signature, nonce);

      if (!isValid) {
        return res.status(400).json({ message: "Invalid signature" });
      }

      const user = await User.findOne({ walletAddress });
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(200).json({
        message: "Login successful via wallet",
        token,
        user: user,
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  } else {
    res.status(400).json({ message: "Please provide wallet address, Google token, Twitter token, or GitHub token" });
  }
};
