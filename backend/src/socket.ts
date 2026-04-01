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
      
      next();
    } catch (err) {
      console.error('Socket auth error:', err);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.id} (${socket.user?.username})`);

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
