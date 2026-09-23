const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabase = require('../supabase.js');
const { authRequired, SECRET } = require('../middleware/auth');

const router = express.Router();

/* =========================================================
   LOGIN
========================================================= */

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error('Supabase login error:', error);

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const ok = bcrypt.compareSync(
      password,
      user.password_hash
    );

    if (!ok) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        name: user.name,
        employeeCode: user.employee_code
      },
      SECRET,
      {
        expiresIn: '12h'
      }
    );

    // Convert Supabase snake_case fields back to the
    // camelCase structure your existing frontend expects.
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code,
      department: user.department,
      designation: user.designation,
      dateOfJoining: user.date_of_joining,
      role: user.role,
      netSalary: user.net_salary,
      createdAt: user.created_at
    };

    res.json({
      token,
      user: safeUser
    });

  } catch (err) {
    console.error('Login error:', err);

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


/* =========================================================
   CURRENT USER
========================================================= */

router.get('/me', authRequired, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('Supabase /me error:', error);

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code,
      department: user.department,
      designation: user.designation,
      dateOfJoining: user.date_of_joining,
      role: user.role,
      netSalary: user.net_salary,
      createdAt: user.created_at
    };

    res.json(safeUser);

  } catch (err) {
    console.error('/me error:', err);

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


module.exports = router;