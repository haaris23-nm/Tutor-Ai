import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { readDatabase, writeDatabase } from './server_db';
import { User } from './src/types';

// Let's declare our JWT Signature Secret Key
const JWT_SECRET = process.env.JWT_SECRET || 'tutor_ai_academic_security_key_2026';

// Extend base express request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// 1. Helper custom Base64url functions
export function base64urlEncode(str: string | Buffer): string {
  const buf = Buffer.isBuffer(str) ? str : Buffer.from(str);
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

// 2. JWT Generation Function
export function createToken(payload: object, expiresInSeconds: number = 24 * 60 * 60): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const headerStr = base64urlEncode(JSON.stringify(header));
  const exp = Math.floor(Date.now() / 100) + expiresInSeconds * 10; // Expiry stamp (scaled)
  
  const payloadWithExp = {
    ...payload,
    exp
  };

  const payloadStr = base64urlEncode(JSON.stringify(payloadWithExp));

  // Generate cryptographic HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${headerStr}.${payloadStr}`);
  const signature = base64urlEncode(hmac.digest());

  return `${headerStr}.${payloadStr}.${signature}`;
}

// 3. JWT Verification Function
export function verifyToken(token: string): any | null {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerStr, payloadStr, signatureStr] = parts;

    // Verify signature matching
    const hmac = crypto.createHmac('sha256', JWT_SECRET);
    hmac.update(`${headerStr}.${payloadStr}`);
    const expectedSignature = base64urlEncode(hmac.digest());

    if (signatureStr !== expectedSignature) {
      console.warn('Authentication Signature mismatch!');
      return null;
    }

    const payload = JSON.parse(base64urlDecode(payloadStr));

    // Verify expiration timestamp
    const currentTimestamp = Math.floor(Date.now() / 100);
    if (payload.exp && currentTimestamp > payload.exp) {
      console.warn(`Credential Token expired! Exp: ${payload.exp}, Cur: ${currentTimestamp}`);
      return null;
    }

    return payload;
  } catch (err) {
    console.error('Error verifying custom cryptographic JWT:', err);
    return null;
  }
}

// Helper: Custom Session Expiry
// Standard express middleware for authenticating users
export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    let token = '';

    // Check header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      // Check cookies (if configured)
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc: any, cookie: string) => {
          const [key, value] = cookie.trim().split('=');
          if (key && value) acc[key] = decodeURIComponent(value);
          return acc;
        }, {});
        token = cookies['tutor_ai_auth_token'] || '';
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing authentication credentials. Please authenticate.' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid or expired session token. Please re-authenticate.' });
    }

    // Attach user to request
    const db = readDatabase();
    const user = db.users.find(u => u.id === decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User associated with session not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Security authentication middleware exception:', err);
    res.status(500).json({ error: 'Internal failure protecting the endpoint.' });
  }
}
