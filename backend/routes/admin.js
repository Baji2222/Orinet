const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const supabase = require('../supabase.js');

const { authRequired, adminOnly } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { computeLeaveBalance } = require('../utils/leaveBalance');

const router = express.Router();

router.use(authRequired, adminOnly);


// ===========================================================================
// EMPLOYEES - SUPABASE
// ===========================================================================


// Get all employees
router.get('/employees', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Get employees error:', error);

      return res.status(500).json({
        error: 'Failed to load employees'
      });
    }

    const employees = data.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code,
      department: user.department || '',
      designation: user.designation || '',
      dateOfJoining: user.date_of_joining || '',
      role: user.role,
      netSalary: user.net_salary,
      createdAt: user.created_at
    }));

    res.json(employees);

  } catch (err) {
    console.error('Get employees error:', err);

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Create employee
router.post('/employees', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      employeeCode,
      department,
      designation,
      dateOfJoining,
      role,
      netSalary
    } = req.body || {};

    if (!name || !email || !password || !employeeCode) {
      return res.status(400).json({
        error:
          'name, email, password and employeeCode are required'
      });
    }

    if (
      netSalary !== undefined &&
      netSalary !== '' &&
      Number.isNaN(Number(netSalary))
    ) {
      return res.status(400).json({
        error: 'netSalary must be a number'
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();


    // ---------------------------------------------------------
    // Check duplicate email
    // ---------------------------------------------------------

    const {
      data: existingEmail,
      error: emailError
    } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (emailError) {
      console.error(
        'Email check error:',
        emailError
      );

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (existingEmail) {
      return res.status(409).json({
        error:
          'An employee with this email already exists'
      });
    }


    // ---------------------------------------------------------
    // Check duplicate employee code
    // ---------------------------------------------------------

    const {
      data: existingCode,
      error: codeError
    } = await supabase
      .from('users')
      .select('id')
      .eq('employee_code', employeeCode)
      .maybeSingle();

    if (codeError) {
      console.error(
        'Employee code check error:',
        codeError
      );

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (existingCode) {
      return res.status(409).json({
        error:
          'An employee with this employee code already exists'
      });
    }


    // ---------------------------------------------------------
    // Hash password
    // ---------------------------------------------------------

    const passwordHash = bcrypt.hashSync(
      password,
      10
    );


    // ---------------------------------------------------------
    // Insert employee into Supabase
    // ---------------------------------------------------------

    const {
      data: user,
      error
    } = await supabase
      .from('users')
      .insert({
        name,
        email: normalizedEmail,
        password_hash: passwordHash,
        employee_code: employeeCode,
        department: department || '',
        designation: designation || '',
        date_of_joining:
          dateOfJoining || null,
        role:
          role === 'admin'
            ? 'admin'
            : 'employee',
        net_salary:
          netSalary !== undefined &&
          netSalary !== ''
            ? Number(netSalary)
            : null
      })
      .select('*')
      .single();

    if (error) {
      console.error(
        'Create employee error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to create employee'
      });
    }


    // ---------------------------------------------------------
    // Send account email
    // ---------------------------------------------------------

    sendMail({
      to: user.email,
      subject:
        'Your HR portal account has been created',

      text:
        `Hi ${user.name},

` +
        `An HR portal account has been created for you.

` +
        `Login email: ${user.email}
` +
        `Temporary password: ${password}

` +
        `Please log in and keep your credentials safe.`
    });


    // ---------------------------------------------------------
    // Return frontend-compatible object
    // ---------------------------------------------------------

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code,
      department: user.department || '',
      designation: user.designation || '',
      dateOfJoining:
        user.date_of_joining || '',
      role: user.role,
      netSalary: user.net_salary,
      createdAt: user.created_at
    };

    res.status(201).json(safeUser);

  } catch (err) {
    console.error(
      'Create employee error:',
      err
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Update employee
router.put('/employees/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      name,
      department,
      designation,
      dateOfJoining,
      role,
      password,
      netSalary
    } = req.body || {};


    if (
      netSalary !== undefined &&
      netSalary !== '' &&
      Number.isNaN(Number(netSalary))
    ) {
      return res.status(400).json({
        error: 'netSalary must be a number'
      });
    }


    // ---------------------------------------------------------
    // Find employee
    // ---------------------------------------------------------

    const {
      data: existing,
      error: findError
    } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      console.error(
        'Find employee error:',
        findError
      );

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!existing) {
      return res.status(404).json({
        error: 'Employee not found'
      });
    }


    // ---------------------------------------------------------
    // Build update object
    // ---------------------------------------------------------

    const updates = {};

    if (name) {
      updates.name = name;
    }

    if (department !== undefined) {
      updates.department = department;
    }

    if (designation !== undefined) {
      updates.designation = designation;
    }

    if (dateOfJoining !== undefined) {
      updates.date_of_joining =
        dateOfJoining || null;
    }

    if (role) {
      updates.role =
        role === 'admin'
          ? 'admin'
          : 'employee';
    }

    if (password) {
      updates.password_hash =
        bcrypt.hashSync(password, 10);
    }

    if (netSalary !== undefined) {
      updates.net_salary =
        netSalary === ''
          ? null
          : Number(netSalary);
    }


    // ---------------------------------------------------------
    // Update Supabase
    // ---------------------------------------------------------

    const {
      data: updated,
      error
    } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error(
        'Update employee error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to update employee'
      });
    }


    const safeUser = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      employeeCode:
        updated.employee_code,
      department:
        updated.department || '',
      designation:
        updated.designation || '',
      dateOfJoining:
        updated.date_of_joining || '',
      role: updated.role,
      netSalary: updated.net_salary,
      createdAt: updated.created_at
    };

    res.json(safeUser);

  } catch (err) {
    console.error(
      'Update employee error:',
      err
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Delete employee
router.delete('/employees/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);


    // Do not allow admin to delete own account
    if (id === Number(req.user.id)) {
      return res.status(400).json({
        error:
          'You cannot delete your own account'
      });
    }


    // ---------------------------------------------------------
    // Check employee exists
    // ---------------------------------------------------------

    const {
      data: existing,
      error: findError
    } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      console.error(
        'Find employee error:',
        findError
      );

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!existing) {
      return res.status(404).json({
        error: 'Employee not found'
      });
    }


    // ---------------------------------------------------------
    // Delete from Supabase
    // ---------------------------------------------------------

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(
        'Delete employee error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to delete employee'
      });
    }

    res.json({
      success: true
    });

  } catch (err) {
    console.error(
      'Delete employee error:',
      err
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// ===========================================================================
// ATTENDANCE
// ===========================================================================

// Attendance (read-only overview across everyone)

router.get('/attendance', async (req, res) => {
  try {
    const {
      employeeId,
      date
    } = req.query;

    let query = supabase
      .from('attendance')
      .select('*');

    if (employeeId) {
      query = query.eq('user_id', Number(employeeId));
    }

    if (date) {
      query = query.eq('date', date);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('Admin attendance error:', error);
      return res.status(500).json({
        error: 'Failed to load attendance'
      });
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id,name,employee_code');

    if (usersError) {
      console.error('Admin attendance users error:', usersError);
      return res.status(500).json({
        error: 'Failed to load attendance'
      });
    }

    const withNames = (logs || []).map(a => {
      const u = (users || []).find(
        u => Number(u.id) === Number(a.user_id)
      );

      return {
        id: a.id,
        userId: a.user_id,
        date: a.date,
        checkIn: a.check_in,
        checkOut: a.check_out,
        status: a.status,
        notes: a.notes || '',
        createdAt: a.created_at,
        employeeName: u ? u.name : 'Unknown',
        employeeCode: u ? u.employee_code : ''
      };
    });

    res.json(
      withNames.sort(
        (a, b) => b.date.localeCompare(a.date)
      )
    );

  } catch (err) {
    console.error('Admin attendance error:', err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// ===========================================================================
// LEAVE REQUESTS
// ===========================================================================

router.get('/leave', async (req, res) => {
  try {
    const { data: leaveRows, error } = await supabase
      .from('leave_requests')
      .select('*');

    if (error) {
      console.error('Admin leave list error:', error);
      return res.status(500).json({
        error: 'Failed to load leave requests'
      });
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id,name,employee_code');

    if (usersError) {
      console.error('Admin leave users error:', usersError);
      return res.status(500).json({
        error: 'Failed to load leave requests'
      });
    }

    const withNames = (leaveRows || []).map(l => {
      const u = (users || []).find(
        u => Number(u.id) === Number(l.user_id)
      );

      return {
        id: l.id,
        userId: l.user_id,
        fromDate: l.from_date,
        toDate: l.to_date,
        type: l.type || '',
        reason: l.reason || '',
        status: l.status || 'pending',
        adminComment: l.admin_comment || '',
        createdAt: l.created_at,
        updatedAt: l.updated_at,
        employeeName: u ? u.name : 'Unknown',
        employeeCode: u ? u.employee_code : ''
      };
    });

    res.json(
      withNames.sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt)
      )
    );

  } catch (err) {
    console.error('Admin leave list error:', err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


router.put('/leave/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      status,
      adminComment
    } = req.body || {};

    if (
      !['approved', 'rejected', 'pending'].includes(status)
    ) {
      return res.status(400).json({
        error: 'status must be approved, rejected or pending'
      });
    }

    const { data: updated, error } = await supabase
      .from('leave_requests')
      .update({
        status,
        admin_comment: adminComment || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Admin leave update error:', error);
      return res.status(500).json({
        error: 'Failed to update leave request'
      });
    }

    if (!updated) {
      return res.status(404).json({
        error: 'Leave request not found'
      });
    }

    const { data: user } = await supabase
      .from('users')
      .select('name,email')
      .eq('id', updated.user_id)
      .maybeSingle();

    if (user) {
      sendMail({
        to: user.email,

        subject:
          `Your leave request has been ${status}`,

        text:
          `Hi ${user.name},

` +
          `Your leave request from ${updated.from_date} to ${updated.to_date} has been ${status}.` +
          (
            adminComment
              ? '\nHR comment: ' + adminComment
              : ''
          )
      });
    }

    res.json({
      id: updated.id,
      userId: updated.user_id,
      fromDate: updated.from_date,
      toDate: updated.to_date,
      type: updated.type || '',
      reason: updated.reason || '',
      status: updated.status,
      adminComment: updated.admin_comment || '',
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });

  } catch (err) {
    console.error('Admin leave update error:', err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// ===========================================================================
// LEAVE BALANCES
// ===========================================================================

// 1 free leave/month per employee,
// adjusted live whenever the holiday calendar changes.

router.get(
  '/leave-balance',
  async (req, res) => {
    try {
      const {
        employeeId,
        year
      } = req.query;

      let usersQuery = supabase
        .from('users')
        .select('*')
        .eq('role', 'employee');

      if (employeeId) {
        usersQuery = usersQuery.eq('id', Number(employeeId));
      }

      const { data: userRows, error: usersError } = await usersQuery;

      if (usersError) {
        console.error('Admin leave-balance users error:', usersError);
        return res.status(500).json({
          error: 'Failed to load leave balances'
        });
      }

      const { data: leaveRows, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*');

      if (leaveError) {
        console.error('Admin leave-balance leave error:', leaveError);
        return res.status(500).json({
          error: 'Failed to load leave balances'
        });
      }

      const { data: holidayRows, error: holidayError } = await supabase
        .from('holidays')
        .select('*');

      if (holidayError) {
        console.error('Admin leave-balance holidays error:', holidayError);
        return res.status(500).json({
          error: 'Failed to load leave balances'
        });
      }

      const holidays = (holidayRows || []).map(h => ({
        id: h.id,
        name: h.name,
        date: h.date,
        description: h.description || '',
        createdAt: h.created_at
      }));

      const yearNum = year ? Number(year) : undefined;

      const balances = (userRows || []).map(u => {
        const user = {
          id: u.id,
          name: u.name,
          email: u.email,
          employeeCode: u.employee_code,
          department: u.department || '',
          designation: u.designation || '',
          dateOfJoining: u.date_of_joining,
          role: u.role,
          netSalary: u.net_salary,
          createdAt: u.created_at
        };

        const userLeaveRequests = (leaveRows || [])
          .filter(l => Number(l.user_id) === Number(u.id))
          .map(l => ({
            id: l.id,
            userId: l.user_id,
            fromDate: l.from_date,
            toDate: l.to_date,
            type: l.type || '',
            reason: l.reason || '',
            status: l.status || 'pending',
            adminComment: l.admin_comment || '',
            createdAt: l.created_at,
            updatedAt: l.updated_at
          }));

        return {
          employeeId: u.id,
          employeeName: u.name,
          employeeCode: u.employee_code,

          ...computeLeaveBalance(
            user,
            userLeaveRequests,
            holidays,
            yearNum
          )
        };
      });

      res.json(balances);

    } catch (err) {
      console.error('Admin leave-balance error:', err);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
);


// ===========================================================================
// PAYSLIPS
// ===========================================================================

// HR uploads the file it received/generated,
// employee downloads it.
// ===========================================================================
// PAYSLIPS - SUPABASE + SUPABASE STORAGE
// ===========================================================================

const uploadDir =
  process.env.VERCEL === '1'
    ? path.join(
        '/tmp',
        'hr-portal-uploads',
        'payslips'
      )
    : path.join(
        __dirname,
        '..',
        'uploads',
        'payslips'
      );

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}

const storage =
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
      const ext =
        path.extname(file.originalname);

      const safeEmployee =
        String(
          req.body.employeeId || 'unknown'
        ).replace(
          /[^a-z0-9_-]/gi,
          ''
        );

      const safeMonth =
        String(
          req.body.month || 'month'
        ).replace(
          /[^a-z0-9_-]/gi,
          ''
        );

      const safeYear =
        String(
          req.body.year || 'year'
        ).replace(
          /[^a-z0-9_-]/gi,
          ''
        );

      cb(
        null,
        `payslip_${safeEmployee}_${safeYear}_${safeMonth}_${Date.now()}${ext}`
      );
    }
  });

const upload =
  multer({
    storage,

    limits: {
      fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
      const allowed = [
        '.pdf',
        '.png',
        '.jpg',
        '.jpeg'
      ];

      const ext =
        path.extname(
          file.originalname
        ).toLowerCase();

      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            'Only PDF, PNG or JPG files are allowed'
          )
        );
      }
    }
  });


// ===========================================================================
// UPLOAD PAYSLIP
// ===========================================================================

router.post(
  '/payslips',
  upload.single('file'),
  async (req, res) => {

    let tempFilePath = null;

    try {

      const {
        employeeId,
        month,
        year
      } = req.body || {};

      if (
        !employeeId ||
        !month ||
        !year ||
        !req.file
      ) {
        return res.status(400).json({
          error:
            'employeeId, month, year and file are all required'
        });
      }

      tempFilePath =
        req.file.path;

      const numericEmployeeId =
        Number(employeeId);

      if (
        !Number.isInteger(
          numericEmployeeId
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid employeeId'
        });
      }


      // ---------------------------------------------------------
      // FIND EMPLOYEE FROM SUPABASE
      // ---------------------------------------------------------

      const {
        data: user,
        error: userError
      } = await supabase
        .from('users')
        .select(
          'id,name,email,employee_code'
        )
        .eq(
          'id',
          numericEmployeeId
        )
        .maybeSingle();

      if (userError) {

        console.error(
          'Find payslip employee error:',
          userError
        );

        return res.status(500).json({
          error:
            'Database error while finding employee'
        });
      }

      if (!user) {

        return res.status(404).json({
          error:
            'Employee not found'
        });
      }


      // ---------------------------------------------------------
      // READ TEMPORARY FILE
      // ---------------------------------------------------------

      const fileBuffer =
        fs.readFileSync(
          tempFilePath
        );

      const originalName =
        req.file.originalname;

      const safeFileName =
        originalName.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

      const storagePath =
        `${numericEmployeeId}/${Date.now()}_${safeFileName}`;


      // ---------------------------------------------------------
      // UPLOAD TO SUPABASE STORAGE
      // ---------------------------------------------------------

      const {
        error: storageError
      } = await supabase
        .storage
        .from('payslips')
        .upload(
          storagePath,
          fileBuffer,
          {
            contentType:
              req.file.mimetype ||
              'application/octet-stream',

            upsert: false
          }
        );

      if (storageError) {

        console.error(
          'Supabase payslip storage upload error:',
          storageError
        );

        return res.status(500).json({
          error:
            'Failed to upload payslip file'
        });
      }


      // ---------------------------------------------------------
      // SAVE METADATA TO SUPABASE DATABASE
      // ---------------------------------------------------------

      const {
        data: payslip,
        error: insertError
      } = await supabase
        .from('payslips')
        .insert({
          user_id:
            numericEmployeeId,

          month:
            String(month),

          year:
            Number(year),

          file_name:
            safeFileName,

          original_name:
            originalName,

          storage_path:
            storagePath
        })
        .select('*')
        .single();

      if (insertError) {

        console.error(
          'Create payslip database error:',
          insertError
        );

        // Remove file from Storage if database
        // insertion failed.
        await supabase
          .storage
          .from('payslips')
          .remove([
            storagePath
          ]);

        return res.status(500).json({
          error:
            'Failed to save payslip information'
        });
      }


      // ---------------------------------------------------------
      // DELETE TEMPORARY LOCAL FILE
      // ---------------------------------------------------------

      try {

        if (
          tempFilePath &&
          fs.existsSync(
            tempFilePath
          )
        ) {
          fs.unlinkSync(
            tempFilePath
          );
        }

      } catch (cleanupError) {

        console.warn(
          'Payslip temp file cleanup warning:',
          cleanupError
        );

      }


      // ---------------------------------------------------------
      // SEND EMAIL
      // ---------------------------------------------------------

      sendMail({
        to: user.email,

        subject:
          `Payslip for ${month} ${year} is ready`,

        text:
          `Hi ${user.name},\n\n` +
          `Your payslip for ${month} ${year} has been uploaded to the HR portal. Log in to download it any time.`
      });


      // ---------------------------------------------------------
      // RETURN RESPONSE
      // ---------------------------------------------------------

      return res.status(201).json({

        id:
          payslip.id,

        userId:
          payslip.user_id,

        month:
          payslip.month,

        year:
          payslip.year,

        fileName:
          payslip.file_name,

        originalName:
          payslip.original_name,

        storagePath:
          payslip.storage_path,

        uploadedAt:
          payslip.uploaded_at,

        employeeName:
          user.name,

        employeeCode:
          user.employee_code

      });

    } catch (err) {

      console.error(
        'Payslip upload error:',
        err
      );

      try {

        if (
          tempFilePath &&
          fs.existsSync(
            tempFilePath
          )
        ) {
          fs.unlinkSync(
            tempFilePath
          );
        }

      } catch (cleanupError) {

        console.warn(
          'Payslip cleanup error:',
          cleanupError
        );

      }

      return res.status(500).json({
        error:
          err.message ||
          'Failed to upload payslip'
      });
    }
  }
);


// ===========================================================================
// GET ALL PAYSLIPS
// ===========================================================================

router.get(
  '/payslips',
  async (req, res) => {

    try {

      const {
        data: payslips,
        error: payslipError
      } = await supabase
        .from('payslips')
        .select('*')
        .order(
          'uploaded_at',
          {
            ascending: false
          }
        );

      if (payslipError) {

        console.error(
          'Get payslips error:',
          payslipError
        );

        return res.status(500).json({
          error:
            'Failed to load payslips'
        });
      }

      if (
        !payslips ||
        payslips.length === 0
      ) {
        return res.json([]);
      }


      // ---------------------------------------------------------
      // GET EMPLOYEE INFORMATION
      // ---------------------------------------------------------

      const userIds = [
        ...new Set(
          payslips
            .map(
              p =>
                Number(
                  p.user_id
                )
            )
            .filter(
              id =>
                Number.isInteger(id)
            )
        )
      ];

      let users = [];

      if (
        userIds.length > 0
      ) {

        const {
          data,
          error: usersError
        } = await supabase
          .from('users')
          .select(
            'id,name,email,employee_code'
          )
          .in(
            'id',
            userIds
          );

        if (usersError) {

          console.error(
            'Get payslip users error:',
            usersError
          );

          return res.status(500).json({
            error:
              'Failed to load payslip employees'
          });
        }

        users = data || [];
      }


      // ---------------------------------------------------------
      // FORMAT RESPONSE
      // ---------------------------------------------------------

      const withNames =
        payslips.map(
          p => {

            const user =
              users.find(
                u =>
                  Number(
                    u.id
                  ) ===
                  Number(
                    p.user_id
                  )
              );

            return {

              id:
                p.id,

              userId:
                p.user_id,

              month:
                p.month,

              year:
                p.year,

              fileName:
                p.file_name,

              originalName:
                p.original_name,

              storagePath:
                p.storage_path,

              uploadedAt:
                p.uploaded_at,

              employeeName:
                user
                  ? user.name
                  : 'Unknown',

              employeeCode:
                user
                  ? user.employee_code
                  : ''

            };
          }
        );

      res.json(
        withNames
      );

    } catch (err) {

      console.error(
        'Get payslips error:',
        err
      );

      res.status(500).json({
        error:
          'Internal server error'
      });
    }
  }
);



// ===========================================================================
// PAYSLIP UPLOAD ERRORS
// ===========================================================================

router.use(
  (err, req, res, next) => {

    if (err) {
      return res.status(400).json({
        error:
          err.message
      });
    }

    next();
  }
);


// ===========================================================================
// GENERIC HR REQUESTS
// ===========================================================================

router.get(
  '/requests',
  async (req, res) => {
    try {
      const { data: requests, error } = await supabase
        .from('requests')
        .select('*');

      if (error) {
        console.error('Admin requests list error:', error);
        return res.status(500).json({
          error: 'Failed to load requests'
        });
      }

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id,name,employee_code');

      if (usersError) {
        console.error('Admin requests users error:', usersError);
        return res.status(500).json({
          error: 'Failed to load requests'
        });
      }

      const withNames = (requests || []).map(r => {
        const u = (users || []).find(
          u => Number(u.id) === Number(r.user_id)
        );

        return {
          id: r.id,
          userId: r.user_id,
          subject: r.subject,
          message: r.message,
          status: r.status,
          adminReply: r.admin_reply || '',
          createdAt: r.created_at,
          updatedAt: r.updated_at || r.created_at,
          employeeName: u ? u.name : 'Unknown',
          employeeCode: u ? u.employee_code : ''
        };
      });

      res.json(
        withNames.sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt)
        )
      );

    } catch (err) {
      console.error('Admin requests list error:', err);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
);


router.put(
  '/requests/:id',
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        status,
        adminReply
      } = req.body || {};

      const updates = {
        updated_at: new Date().toISOString()
      };

      if (status) {
        updates.status = status;
      }

      if (adminReply !== undefined) {
        updates.admin_reply = adminReply;
      }

      const { data: updated, error } = await supabase
        .from('requests')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Admin request update error:', error);
        return res.status(500).json({
          error: 'Failed to update request'
        });
      }

      if (!updated) {
        return res.status(404).json({
          error: 'Request not found'
        });
      }

      const { data: user } = await supabase
        .from('users')
        .select('name,email')
        .eq('id', updated.user_id)
        .maybeSingle();

      if (user) {
        sendMail({
          to: user.email,

          subject:
            `Update on your request: ${updated.subject}`,

          text:
            `Hi ${user.name},

` +
            `Your request "${updated.subject}" is now: ${updated.status}.` +
            (
              adminReply
                ? '\nHR reply: ' + adminReply
                : ''
            )
        });
      }

      res.json({
        id: updated.id,
        userId: updated.user_id,
        subject: updated.subject,
        message: updated.message,
        status: updated.status,
        adminReply: updated.admin_reply || '',
        createdAt: updated.created_at,
        updatedAt: updated.updated_at || updated.created_at
      });

    } catch (err) {
      console.error('Admin request update error:', err);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
);


module.exports = router;