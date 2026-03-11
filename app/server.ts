import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { register, Counter, Histogram } from 'prom-client';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = 'vdt-2025-secret-key';
const db = new Database('app.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT,
    image TEXT,
    stock INTEGER DEFAULT 100
  );
  
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total_amount REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  );
`);

// Seed Products if empty
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
if (productCount.count === 0) {
  const insertProduct = db.prepare('INSERT INTO products (name, price, category, image) VALUES (?, ?, ?, ?)');
  insertProduct.run('Cloud Server Pro', 99.99, 'Infrastructure', 'https://picsum.photos/seed/server/400/300');
  insertProduct.run('Kubernetes Masterclass', 49.50, 'Education', 'https://picsum.photos/seed/k8s/400/300');
  insertProduct.run('DevOps Toolkit', 25.00, 'Tools', 'https://picsum.photos/seed/tools/400/300');
  insertProduct.run('Monitoring Dashboard', 15.00, 'Software', 'https://picsum.photos/seed/dashboard/400/300');
}

// Seed Users
const seedUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)');
seedUser.run('admin', 'admin123', 'admin');
seedUser.run('user', 'user123', 'user');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // --- 5. Monitoring (Prometheus) ---
  const httpRequestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status'],
  });

  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'path', 'status'],
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // --- 6. Logging (EFK Requirement) ---
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      httpRequestCounter.inc({ method: req.method, path: req.path, status: res.statusCode });
      httpRequestDuration.observe({ method: req.method, path: req.path, status: res.statusCode }, duration / 1000);

      // Log format required: Request Path, HTTP Method, Response Code
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        status: res.statusCode,
        duration_ms: duration,
        user_agent: req.get('user-agent')
      }));
    });
    next();
  });

  // --- 7. Security: Rate Limit (Applied to Checkout) ---
  const checkoutLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per windowMs
    handler: (req, res) => {
      res.status(409).json({ error: 'Too many checkout attempts. Please wait a minute.' });
    },
  });

  // --- 7. Security: Authentication & Authorization ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    // Support Basic Auth
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Basic ')) {
      const b64auth = authHeader.split(' ')[1];
      const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');
      const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;
      if (user) {
        req.user = user;
        return next();
      }
    }

    if (!token) return res.status(403).json({ error: 'Authentication required' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      res.status(403).json({ error: 'Invalid token' });
    }
  };

  const authorize = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
      next();
    };
  };

  // --- API Routes ---
  
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;
    
    if (user) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true, sameSite: 'none', secure: true });
      res.json({ token, user: { username: user.username, role: user.role } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/api/me', authenticate, (req: any, res) => {
    res.json(req.user);
  });

  // Public Product List
  app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  });

  // Admin Only: Add Product
  app.post('/api/products', authenticate, authorize(['admin']), (req, res) => {
    const { name, price, category, image } = req.body;
    const info = db.prepare('INSERT INTO products (name, price, category, image) VALUES (?, ?, ?, ?)').run(name, price, category, image);
    res.status(201).json({ id: info.lastInsertRowid, name, price });
  });

  // Admin Only: Delete Product
  app.delete('/api/products/:id', authenticate, authorize(['admin']), (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.status(204).send();
  });

  // User/Admin: Place Order (Rate Limited)
  app.post('/api/orders', checkoutLimiter, authenticate, (req: any, res) => {
    const { total_amount } = req.body;
    const info = db.prepare('INSERT INTO orders (user_id, total_amount) VALUES (?, ?)').run(req.user.id, total_amount);
    res.status(201).json({ id: info.lastInsertRowid, status: 'pending' });
  });

  // User/Admin: Get Orders
  app.get('/api/orders', authenticate, (req: any, res) => {
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ?').all(req.user.id);
    res.json(orders);
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
