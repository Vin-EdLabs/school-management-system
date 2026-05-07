import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { query } from './db/connection.js';

let io: Server;

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
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust for production once URL is known
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: No token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      if (decoded.role === 'parent' && decoded.parentAccountId) {
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
        socket.user = {
          id: row.id,
          tenantId: row.tenant_id,
          username: row.username,
          role: row.role,
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
      const { id, tenantId } = socket.user;
      socket.join(`user:${id}`);
      if (tenantId) {
        socket.join(`tenant:${tenantId}`);
      }
      socket.join('global:general');
      console.log(`User connected and joined rooms: ${socket.id} (User:${id}, Tenant:${tenantId})`);
    }

    socket.on('join-channel', (channel: string) => {
      socket.join(`global:${channel}`);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
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
