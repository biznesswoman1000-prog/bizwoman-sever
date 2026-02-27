//backend/src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../utils/jwt";
import { AppError } from "../utils/appError";

// Extend Express Request type
export interface AuthRequest extends Request {
  user?: TokenPayload;
}

/**
 * Protect routes - require authentication
 */
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token: string | undefined;

    // Get token from header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // Or from cookie
    else if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new AppError("Not authorized, no token provided", 401);
    }

    // Verify token
    const decoded = verifyAccessToken(token);
    req.user = decoded;

    next();
  } catch (error: any) {
    next(new AppError(error.message || "Not authorized", 401));
  }
};

/**
 * Restrict routes to specific roles
 */
export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError("Not authorized", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }

    next();
  };
};

/**
 * Admin only middleware
 */
export const adminOnly = restrictTo("ADMIN");

/**
 * Admin or Staff middleware
 */
export const staffOrAdmin = restrictTo("ADMIN", "STAFF");

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Don't throw error, just continue without user
    next();
  }
};
