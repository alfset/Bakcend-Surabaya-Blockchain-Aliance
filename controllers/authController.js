import { checkSignature, generateNonce } from '@meshsdk/core';
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function backendGetNonce(userAddress) {
  const nonce = generateNonce('I agree to the terms and conditions of Cardano Hub Indonesia: ');
  return nonce;
}

async function backendVerifySignature(userAddress, signature, nonce) {
  const result = checkSignature(nonce, signature, userAddress);
  return result;
}

export const signup = async (req, res) => {
  const { firstName, lastName, email, password, walletAddress, googleToken, signature } = req.body;

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
  } else if (password) {
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "Please fill in all required fields" });
    }
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newUser = new User({ firstName, lastName, email, password: hashedPassword });
      await newUser.save();
      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
      res.status(201).json({
        message: "User created successfully via username/password",
        token,
        user: newUser,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  } else {
    res.status(400).json({ message: "Please provide wallet address, username/password, or Google token" });
  }
};

export const login = async (req, res) => {
  const { walletAddress, password, googleToken, signature } = req.body;
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
      res.status(500).json({ message: "Server error", error: error.message });
    }
  } else if (password) {
    const { email } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    try {
      const user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

      res.status(200).json({
        message: "Login successful via username/password",
        token,
        user: user,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  } else {
    res.status(400).json({ message: "Please provide wallet address, email/password, or Google token" });
  }
};
