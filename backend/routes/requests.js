const express = require('express');

const supabase = require('../supabase.js');

const { authRequired } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const router = express.Router();

router.use(authRequired);


// Submit a general request to HR
router.post('/', async (req, res) => {
  try {
    const { subject, message } = req.body || {};

    if (!subject || !message) {
      return res.status(400).json({
        error: 'subject and message are required'
      });
    }

    // Get current employee
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, employee_code')
      .eq('id', req.user.id)
      .maybeSingle();

    if (userError) {
      console.error('User lookup error:', userError);

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Create request in Supabase
    const { data: row, error } = await supabase
      .from('requests')
      .insert({
        user_id: req.user.id,
        type: '',
        subject,
        message,
        status: 'open',
        admin_comment: '',
        admin_reply: ''
      })
      .select('*')
      .single();

    if (error) {
      console.error('Create request error:', error);

      return res.status(500).json({
        error: 'Failed to create request'
      });
    }

    // Convert database fields to the structure
    // expected by the existing frontend.
    const request = {
      id: row.id,
      userId: row.user_id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      adminReply: row.admin_reply || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at
    };

    // Get admins for notification
    const {
      data: admins,
      error: adminError
    } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'admin');

    if (!adminError && admins) {
      admins.forEach(admin => {
        sendMail({
          to: admin.email,
          subject: `New HR request: ${subject}`,
          text:
            `${user.name} (${user.employee_code}) submitted a request:\n\n` +
            `Subject: ${subject}\n` +
            `Message: ${message}`
        });
      });
    }

    res.status(201).json(request);

  } catch (err) {
    console.error('Request creation error:', err);

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Own request history
router.get('/me', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      console.error('Get requests error:', error);

      return res.status(500).json({
        error: 'Failed to load requests'
      });
    }

    const list = data.map(row => ({
      id: row.id,
      userId: row.user_id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      adminReply: row.admin_reply || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at
    }));

    res.json(list);

  } catch (err) {
    console.error('Request history error:', err);

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


module.exports = router;