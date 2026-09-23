const express = require('express');
const supabase = require('../supabase.js');
const { authRequired } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { computeLeaveBalance } = require('../utils/leaveBalance');

const router = express.Router();

router.use(authRequired);

/* ========================================================
   HELPER: Convert Supabase leave row -> frontend format
======================================================== */

function mapLeave(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    fromDate: row.from_date,
    toDate: row.to_date,
    type: row.type || '',
    reason: row.reason || '',
    status: row.status || 'pending',
    adminComment: row.admin_comment || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/* ========================================================
   APPLY FOR LEAVE
======================================================== */

router.post('/', async (req, res) => {
  try {
    const { fromDate, toDate, type, reason } = req.body || {};

    if (!fromDate || !toDate || !type) {
      return res.status(400).json({
        error: 'fromDate, toDate and type are required'
      });
    }

    if (new Date(toDate) < new Date(fromDate)) {
      return res.status(400).json({
        error: 'toDate cannot be before fromDate'
      });
    }

    /* ----------------------------------------------------
       Get logged-in employee
    ---------------------------------------------------- */

    const {
      data: user,
      error: userError
    } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (userError) {
      console.error('Leave user lookup error:', userError);
      return res.status(500).json({
        error: userError.message
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    /* ----------------------------------------------------
       Insert leave request into Supabase
    ---------------------------------------------------- */

    const {
      data: leaveRow,
      error: leaveError
    } = await supabase
      .from('leave_requests')
      .insert({
        user_id: req.user.id,
        from_date: fromDate,
        to_date: toDate,
        type: type,
        reason: reason || '',
        status: 'pending',
        admin_comment: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (leaveError) {
      console.error('Supabase leave insert error:', leaveError);

      return res.status(500).json({
        error: leaveError.message
      });
    }

    /* ----------------------------------------------------
       Get administrators
    ---------------------------------------------------- */

    const {
      data: admins,
      error: adminError
    } = await supabase
      .from('users')
      .select('id, name, email, employee_code, role')
      .eq('role', 'admin');

    if (adminError) {
      console.error('Admin lookup error:', adminError);
    }

    /* ----------------------------------------------------
       Send email notification
    ---------------------------------------------------- */

    if (admins && admins.length > 0) {
      admins.forEach((admin) => {
        if (!admin.email) return;

        sendMail({
          to: admin.email,
          subject: `New leave request from ${user.name || 'an employee'}`,
          text:
            `${user.name || 'An employee'} ` +
            `(${user.employee_code || ''}) requested ${type} leave ` +
            `from ${fromDate} to ${toDate}.\n` +
            `Reason: ${reason || 'N/A'}\n\n` +
            `Log in to the HR portal to approve or reject this request.`
        });
      });
    }

    /* ----------------------------------------------------
       Return frontend-compatible object
    ---------------------------------------------------- */

    return res.status(201).json(mapLeave(leaveRow));

  } catch (err) {
    console.error('Leave POST error:', err);

    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
  }
});

/* ========================================================
   OWN LEAVE HISTORY
======================================================== */

router.get('/me', async (req, res) => {
  try {
    const {
      data,
      error
    } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      console.error('Leave history error:', error);

      return res.status(500).json({
        error: error.message
      });
    }

    return res.json((data || []).map(mapLeave));

  } catch (err) {
    console.error('Leave history GET error:', err);

    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
  }
});

/* ========================================================
   LEAVE BALANCE
======================================================== */

/*
  1 free leave day accrued per month
  minus approved paid leave days
  excluding company holidays.

  The existing computeLeaveBalance() function is retained.
  We simply fetch its required data from Supabase instead
  of db.json.
*/

router.get('/balance', async (req, res) => {
  try {

    /* ----------------------------------------------------
       Get user
    ---------------------------------------------------- */

    const {
      data: userRow,
      error: userError
    } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (userError) {
      console.error('Leave balance user error:', userError);

      return res.status(500).json({
        error: userError.message
      });
    }

    if (!userRow) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    /* ----------------------------------------------------
       Get employee leave requests
    ---------------------------------------------------- */

    const {
      data: leaveRows,
      error: leaveError
    } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', req.user.id);

    if (leaveError) {
      console.error('Leave balance requests error:', leaveError);

      return res.status(500).json({
        error: leaveError.message
      });
    }

    /* ----------------------------------------------------
       Get holidays
    ---------------------------------------------------- */

    const {
      data: holidayRows,
      error: holidayError
    } = await supabase
      .from('holidays')
      .select('*');

    if (holidayError) {
      console.error('Leave balance holidays error:', holidayError);

      return res.status(500).json({
        error: holidayError.message
      });
    }

    /* ----------------------------------------------------
       Convert Supabase rows to existing application format
    ---------------------------------------------------- */

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      employeeCode: userRow.employee_code,
      department: userRow.department || '',
      designation: userRow.designation || '',
      dateOfJoining: userRow.date_of_joining,
      role: userRow.role,
      netSalary: userRow.net_salary,
      createdAt: userRow.created_at
    };

    const leaveRequests = (leaveRows || []).map(mapLeave);

    const holidays = (holidayRows || []).map((holiday) => ({
      id: holiday.id,
      name: holiday.name,
      date: holiday.date,
      description: holiday.description || '',
      createdAt: holiday.created_at
    }));

    /* ----------------------------------------------------
       Calculate balance using existing function
    ---------------------------------------------------- */

    const year = req.query.year
      ? Number(req.query.year)
      : undefined;

    const balance = computeLeaveBalance(
      user,
      leaveRequests,
      holidays,
      year
    );

    return res.json(balance);

  } catch (err) {
    console.error('Leave balance error:', err);

    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
  }
});

module.exports = router;