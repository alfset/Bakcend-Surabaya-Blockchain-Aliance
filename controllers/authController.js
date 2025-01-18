// controllers/authController.js
import User from "../models/User.js";
import jwt from "jsonwebtoken";

// Signup controller for wallet login
export const signup = async (req, res) => {
  const { firstName, lastName, email, password, walletAddress } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !walletAddress) {
    return res.status(400).json({ message: "Please fill in all required fields" });
  }

  try {
    // Check if user already exists with the same wallet address
    const existingUser = await User.findOne({ walletAddress });
    if (existingUser) {
      return res.status(400).json({ message: "User with this wallet address already exists" });
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    // Create a new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      walletAddress,
    });

    // Save user to database
    await newUser.save();

    // Generate JWT token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    // Send response
    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        _id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        walletAddress: newUser.walletAddress,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Login controller for wallet login (without password)
export const login = async (req, res) => {
  const { walletAddress, password } = req.body;

  // Validation
  if (!walletAddress) {
    return res.status(400).json({ message: "Wallet address is required" });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // If password is provided, compare it
    if (password && !(await user.matchPassword(password))) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    // Send response
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
