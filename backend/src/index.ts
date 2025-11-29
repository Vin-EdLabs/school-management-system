import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import pool from './config/db.js';
import { errorHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';
import check from './scripts/check-db.js';
import seedscript from './scripts/seed-admin.js';

dotenv.config();

const app = express();

// Basic security headers
app.use(helmet());

// Configure CORS to allow Vite dev server and local testing origins
const corsOptions: any = {
  origin: (origin: any, callback: any) => {
    // allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const allowed = [process.env.CLIENT_ORIGIN || 'http://localhost:5173', 'http://localhost:3000'];
    if (allowed.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging: use 'dev' in development, 'combined' (or none) in production
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Basic rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000), // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX || 200), // limit each IP
});
// readiness flag (set true after DB check + seeding)
let ready = false;

// Initialize DB and seed before mounting routes / starting server
const init = async () => {
  const ok = await check();
  if (!ok) {
    console.error('Database not available, aborting startup.');
    process.exit(2);
  }

  // run seed script (will no-op if user exists)
  try {
    await seedscript();
  } catch (err) {
    console.error('Seed script failed:', err);
  }

  // mount API routes with rate limiter
  app.use('/api', apiLimiter, routes);
  ready = true;
};

init().catch((err) => {
  console.error('Initialization failed:', err);
  process.exit(2);
});

app.get('/', (req, res) => res.send('School Management System Backend'));

// health: basic liveness
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// readiness: returns 200 only if app is initialized and DB ready
app.get('/ready', async (_req, res) => {
  if (!ready) return res.status(503).json({ ready: false });
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ ready: true });
  } catch (err) {
    return res.status(503).json({ ready: false });
  }
});

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  ready = false;
  // stop accepting new connections
  server.close(async (err?: Error) => {
    if (err) console.error('Error closing server:', err);
    try {
      await pool.end();
      console.log('Database pool has ended.');
    } catch (e) {
      console.error('Error during pool shutdown:', e);
    }
    process.exit(0);
  });

  // force exit after timeout
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, Number(process.env.SHUTDOWN_TIMEOUT_MS || 30_000));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;