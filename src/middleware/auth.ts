import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { verifyToken } from '../../server_auth.ts';
import { User } from '../types.ts';

export interface AuthRequest extends Request {
  user?: User;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc: any, c: string) => {
      const [key, val] = c.trim().split('=');
      if (key && val) acc[key] = decodeURIComponent(val);
      return acc;
    }, {});
    token = cookies['tutor_ai_auth_token'] || '';
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  try {
    // Attempt Firebase Admin ID Token verification first
    const decodedToken: DecodedIdToken = await adminAuth.verifyIdToken(token);
    req.user = {
      id: decodedToken.uid,
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      username: decodedToken.name || decodedToken.email?.split('@')[0] || 'Student'
    };
    return next();
  } catch {
    // Fallback: Verify legacy local auth token if present
    const legacy = verifyToken(token);
    if (legacy && legacy.id) {
      req.user = {
        id: legacy.id,
        uid: legacy.id,
        email: legacy.email || '',
        username: legacy.username || legacy.email?.split('@')[0] || 'Student'
      };
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
