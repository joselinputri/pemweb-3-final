import { Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username?: string;
      };
    }
  }
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// ✅ FIXED: Email regex tanpa escape backslash
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Validasi required fields
    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
      return;
    }

    // ✅ Validasi email format (sekarang works!)
    if (!emailRegex.test(email)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid email format" 
      });
      return;
    }

    // Validasi password length
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
      return;
    }

    // Cek email sudah terdaftar
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ 
        success: false, 
        message: "Email already registered" 
      });
      return;
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Buat user baru
    const user = await prisma.user.create({
      data: { 
        username: username || null, 
        email, 
        password: hashed 
      },
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        created_at: user.created_at 
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validasi required fields
    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
      return;
    }

    // Cari user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
      return;
    }

    // Validasi password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
      return;
    }

    // Cek JWT secret
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ 
        success: false, 
        message: "JWT secret not configured" 
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id,  // ✅ IMPORTANT: gunakan 'id' bukan 'userId'
        email: user.email,
        username: user.username 
      }, 
      secret, 
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || "7d"
      } as jwt.SignOptions
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: { 
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    // Cek apakah user sudah terautentikasi
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
      return;
    }

    // Ambil data user dari database
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        id: true, 
        username: true, 
        email: true,
        created_at: true,
        updated_at: true
      },
    });

    if (!user) {
      res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: user,
    });
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};