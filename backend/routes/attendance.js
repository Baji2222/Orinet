const express = require('express');
const supabase = require('../supabase.js');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Check in for today
router.post('/checkin', async (req, res) => {
  try {
    const date = todayStr();

    const { data: existing, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('date', date)
      .maybeSingle();

    if (findError) {
      console.error(findError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing && existing.check_in) {
      return res.status(400).json({
        error: 'You have already checked in today'
      });
    }

    const now = new Date().toISOString();

    if (!existing) {
      const { data: record, error } = await supabase
        .from('attendance')
        .insert({
          user_id: req.user.id,
          date,
          check_in: now,
          check_out: null,
          status: 'present',
          notes: ''
        })
        .select('*')
        .single();

      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to check in' });
      }

      return res.json({
        id: record.id,
        userId: record.user_id,
        date: record.date,
        checkIn: record.check_in,
        checkOut: record.check_out,
        status: record.status,
        notes: record.notes || '',
        createdAt: record.created_at
      });
    }

    const { data: record, error } = await supabase
      .from('attendance')
      .update({
        check_in: now,
        status: 'present'
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to check in' });
    }

    res.json({
      id: record.id,
      userId: record.user_id,
      date: record.date,
      checkIn: record.check_in,
      checkOut: record.check_out,
      status: record.status,
      notes: record.notes || '',
      createdAt: record.created_at
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Check out for today
router.post('/checkout', async (req, res) => {
  try {
    const date = todayStr();

    const { data: record, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('date', date)
      .maybeSingle();

    if (findError) {
      console.error(findError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!record || !record.check_in) {
      return res.status(400).json({
        error: 'You must check in before checking out'
      });
    }

    if (record.check_out) {
      return res.status(400).json({
        error: 'You have already checked out today'
      });
    }

    const { data: updated, error } = await supabase
      .from('attendance')
      .update({
        check_out: new Date().toISOString()
      })
      .eq('id', record.id)
      .select('*')
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Failed to check out'
      });
    }

    res.json({
      id: updated.id,
      userId: updated.user_id,
      date: updated.date,
      checkIn: updated.check_in,
      checkOut: updated.check_out,
      status: updated.status,
      notes: updated.notes || '',
      createdAt: updated.created_at
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Full history for logged-in employee
router.get('/me', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Failed to load attendance'
      });
    }

    const logs = data.map(record => ({
      id: record.id,
      userId: record.user_id,
      date: record.date,
      checkIn: record.check_in,
      checkOut: record.check_out,
      status: record.status,
      notes: record.notes || '',
      createdAt: record.created_at
    }));

    res.json(logs);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Today's record
router.get('/today', async (req, res) => {
  try {
    const date = todayStr();

    const { data: record, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Failed to load today attendance'
      });
    }

    if (!record) {
      return res.json(null);
    }

    res.json({
      id: record.id,
      userId: record.user_id,
      date: record.date,
      checkIn: record.check_in,
      checkOut: record.check_out,
      status: record.status,
      notes: record.notes || '',
      createdAt: record.created_at
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


module.exports = router;