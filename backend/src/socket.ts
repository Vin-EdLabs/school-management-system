import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { query } from './db/connection.js';

let io: Server;

const normalizeRole = (role: string | null | undefined): string => {
  const value = String(role || '').toLowerCase().trim();
  if (value === 'superadmin') return 'super-admin';
  if (value === 'admin') return 'administrator';
  return value;
};

export interface SocketUser {
  id: number;
  tenantId: number | null;
  username: string;
  role: string;
  fullName: string | null;
}

export interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
}

export const initSocket = (server: HttpServer) => {
  const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    const allowedPatterns = [
      /^https:\/\/([a-z0-9-]+\.)?scholarnerve\.com$/,
      /^http:\/\/([a-z0-9-]+\.)?scholarnerve\.com$/,
      /^http:\/\/([a-z0-9-]+\.)?localhost:(8080|5173|4173|3001)$/,
      /^http:\/\/localhost:(8080|5173|4173|3001)$/,
      /^http:\/\/([a-z0-9-]+\.)?127\.0\.0\.1:(8080|5173|4173|3001)$/,
      /^http:\/\/127\.0\.0\.1:(8080|5173|4173|3001)$/,
      /^http:\/\/([a-z0-9-]+\.)?lvh\.me:(8080|5173|4173)$/,
    ];
    if (allowedPatterns.some((p) => p.test(origin))) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  };

  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true,
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: No token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      const decodedRole = normalizeRole(decoded.role);
      if (decodedRole === 'parent' && decoded.parentAccountId) {
        const parentResult = await query(
          `SELECT p.id, p.tenant_id, p.student_id, s.first_name, s.last_name
           FROM parent_portal_accounts p
           LEFT JOIN students s ON s.id = p.student_id AND s.tenant_id = p.tenant_id
           WHERE p.id = $1`,
          [decoded.parentAccountId]
        );
        if (parentResult.rows.length === 0) return next(new Error('Invalid parent'));
        const row = parentResult.rows[0];
        socket.user = {
          id: row.id,
          tenantId: row.tenant_id,
          username: `parent-${row.id}`,
          role: 'parent',
          fullName: [row.first_name, row.last_name].filter(Boolean).join(' ') || `Parent ${row.id}`,
        };
      } else {
        const result = await query(
          `SELECT u.id, u.tenant_id, u.username, u.role, 
                  COALESCE(t.full_name, u.username) as full_name
           FROM users u
           LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
           WHERE u.id = $1 AND u.is_active = true`,
          [decoded.userId]
        );
        if (result.rows.length === 0) return next(new Error('Invalid user'));
        const row = result.rows[0];
        const normalizedRole = normalizeRole(row.role);
        socket.user = {
          id: row.id,
          tenantId: row.tenant_id,
          username: row.username,
          role: normalizedRole,
          fullName: row.full_name,
        };
      }
      
      next();
    } catch (err) {
      console.error('Socket auth error:', err);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (socket.user) {
      const { id, tenantId, role } = socket.user;
      const normalizedRole = normalizeRole(role);
      socket.join(`user:${id}`);
      if (tenantId) {
        socket.join(`tenant:${tenantId}`);
      }
      if (normalizedRole === 'super-admin') {
        socket.join('global:super-admin');
      }
      socket.join('global:general');
      socket.data.connectedAt = Date.now();
      console.log(`User connected and joined rooms: ${socket.id} (User:${id}, Tenant:${tenantId}, Role:${normalizedRole})`);
      if (normalizedRole !== 'parent') {
        io.to('global:super-admin').emit('super-admin-online-users-updated', { updatedAt: socket.data.connectedAt });
      }
    }

    socket.on('join-channel', (channel: string) => {
      socket.join(`global:${channel}`);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      if (socket.user) {
        const normalizedRole = String(socket.user.role || '').toLowerCase().trim();
        if (normalizedRole !== 'parent') {
          io.to('global:super-admin').emit('super-admin-online-users-updated', { updatedAt: Date.now() });
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
