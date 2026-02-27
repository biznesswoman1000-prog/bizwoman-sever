import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getMe,
  updatePassword,
} from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';
import {
  validateRegister,
  validateLogin,
  validateEmail,
  validateResetPassword,
  validateUpdatePassword,
} from '../middlewares/validation.middleware';

const router = Router();

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', validateEmail, forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);
router.post('/refresh-token', refreshToken);

// Protected routes
router.use(protect); // All routes below require authentication

router.get('/me', getMe);
router.post('/logout', logout);
router.put('/update-password', validateUpdatePassword, updatePassword);

export default router;
