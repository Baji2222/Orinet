require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const supabase = require('./supabase');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const payslipRoutes = require('./routes/payslips');
const requestRoutes = require('./routes/requests');
const holidayRoutes = require('./routes/holidays');
const adminRoutes = require('./routes/admin');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://orinet.vercel.app',
  'https://backend-theta-two-26.vercel.app'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowedOrigin =
    !origin ||
    allowedOrigins.includes(origin) ||
    /^https:\/\/.*\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
    /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(origin || '');

  if (isAllowedOrigin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: '10mb' }));

seedAdmin().catch((err) => {
  console.error('Admin seed check failed:', err.message || err);
});

async function seedAdmin() {
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });

  if (error) {
    // Table probably doesn't exist yet, or Supabase isn't reachable -
    // don't crash startup over this, just log it.
    console.error(
      'Could not check for an existing admin account (seed skipped):',
      error.message
    );
    return;
  }

  if (count > 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from('users')
    .insert({
      name: 'HR Admin',
      email: 'admin@company.com',
      password_hash: bcrypt.hashSync('admin123', 10),
      employee_code: 'ADMIN001',
      department: 'HR',
      designation: 'HR Administrator',
      date_of_joining: new Date().toISOString().slice(0, 10),
      role: 'admin'
    });

  if (insertError) {
    console.error('Failed to seed default admin account:', insertError.message);
    return;
  }

  console.log('----------------------------------------------------------');
  console.log('Seeded default admin account:');
  console.log('  email:    admin@company.com');
  console.log('  password: admin123');
  console.log('Please log in and change this as soon as possible.');
  console.log('----------------------------------------------------------');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT) || 4000;

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`HR portal backend running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
