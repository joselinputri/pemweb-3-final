import { Router } from 'express';
import { register, login, getMe } from './auth.controller';
import { authMiddleware } from './auth.middleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', authMiddleware, getMe);

export default router;