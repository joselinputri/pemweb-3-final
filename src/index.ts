import express, { Request, Response } from "express";
import dotenv from "dotenv";

import authRoutes from "./auth/auth.routes";
import bookRoutes from "./routes/book.routes";
import genreRoutes from "./routes/genre.routes";
import transactionRoutes from "./routes/transaction.route";  // ✅ PASTIKAN INI ADA

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health-check", (_req: Request, res: Response) => {
  const currentDate = new Date();
  const formattedDate = currentDate.toDateString();

  res.status(200).json({
    success: true,
    message: "Hello World!",
    date: formattedDate,
  });
});

// Routes
app.use("/auth", authRoutes);
app.use("/books", bookRoutes);
app.use("/genre", genreRoutes);
app.use("/transactions", transactionRoutes);  // ✅ PASTIKAN INI ADA

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📚 IT Literature Shop - Backend API`);
  console.log(`\n📋 Available Routes:`);
  console.log(`   - POST   /auth/register`);
  console.log(`   - POST   /auth/login`);
  console.log(`   - GET    /auth/me`);
  console.log(`   - POST   /transactions  ✅`);  // ✅ PASTIKAN INI MUNCUL
  console.log(`   - GET    /transactions  ✅`);
  console.log(`   - GET    /transactions/statistics  ✅`);
});

export default app;