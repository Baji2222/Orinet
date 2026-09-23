import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api, { errMsg } from '../api';

const TABS = ['Employees', 'Attendance', 'Leave Requests', 'Holidays', 'Payslips', 'Requests'];

export default function AdminDashboard() {
  const [tab, setTab] = useState('Employees');
  const [employees, setEmployees] = useState([]);

  async function loadEmployees() {
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data);
    } catch {
      // handled inline in each tab where relevant
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? 'tab-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Employees' && <EmployeesTab employees={employees} reload={loadEmployees} />}
        {tab === 'Attendance' && <AttendanceTab employees={employees} />}
        {tab === 'Leave Requests' && <LeaveTab />}
        {tab === 'Holidays' && <HolidaysTab />}
        {tab === 'Payslips' && <PayslipsTab employees={employees} />}
        {tab === 'Requests' && <RequestsTab />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmployeesTab({ employees, reload }) {
  const emptyForm = {
    name: '', email: '', password: '', employeeCode: '', department: '', designation: '', dateOfJoining: '', role: 'employee', netSalary: ''
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (editingId) {
        const { name, department, designation, dateOfJoining, role, password, netSalary } = form;
        const payload = { name, department, designation, dateOfJoining, role, netSalary };
        if (password) payload.password = password;
        await api.put(`/admin/employees/${editingId}`, payload);
        setSuccess('Employee updated.');
      } else {
        await api.post('/admin/employees', form);
        setSuccess('Employee created. Login details were emailed to them.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(emp) {
    setEditingId(emp.id);
    setError('');
    setSuccess('');
    setForm({
      name: emp.name,
      email: emp.email,
      password: '',
      employeeCode: emp.employeeCode,
      department: emp.department || '',
      designation: emp.designation || '',
      dateOfJoining: emp.dateOfJoining || '',
      role: emp.role,
      netSalary: emp.netSalary ?? ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this employee? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/employees/${id}`);
      if (editingId === id) cancelEdit();
      await reload();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <h2>{editingId ? 'Edit Employee' : 'Add Employee'}</h2>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <label className="field">
              <span>Full Name</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Employee Code</span>
              <input required disabled={!!editingId} value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Email</span>
              <input type="email" required disabled={!!editingId} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field">
              <span>{editingId ? 'New Password (optional)' : 'Temporary Password'}</span>
              <input
                required={!editingId}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingId ? 'Leave blank to keep unchanged' : ''}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Department</span>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </label>
            <label className="field">
              <span>Designation</span>
              <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Date of Joining</span>
              <input type="date" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="admin">Admin / HR</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Net Salary (per month)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.netSalary}
              onChange={(e) => setForm({ ...form, netSalary: e.target.value })}
              placeholder="e.g. 45000"
            />
          </label>
          <div className="field-row">
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Saving...' : editingId ? 'Update Employee' : 'Create Employee'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>All Employees ({employees.length})</h2>
        </div>
        <div className="table-wrap">
<table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Dept</th>
              <th>Net Salary</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  {emp.name}
                  <div className="table-subtext">{emp.email}</div>
                </td>
                <td>{emp.employeeCode}</td>
                <td>{emp.department || '—'}</td>
                <td>{emp.netSalary ? `₹${Number(emp.netSalary).toLocaleString('en-IN')}` : '—'}</td>
                <td><span className={`badge role-${emp.role}`}>{emp.role}</span></td>
                <td className="action-cell">
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(emp)}>
                    Edit
                  </button>
                  <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDelete(emp.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AttendanceTab({ employees }) {
  const [logs, setLogs] = useState([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const params = {};
      if (filterEmployee) params.employeeId = filterEmployee;
      if (filterDate) params.date = filterDate;
      const res = await api.get('/admin/attendance', { params });
      setLogs(res.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEmployee, filterDate]);

  return (
    <div className="card">
      <div className="card-header">
        <h2>Attendance Overview</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="filters">
        <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
      </div>
      <div className="table-wrap">
<table className="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr><td colSpan="5" className="empty-row">No attendance logs found.</td></tr>
          )}
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.employeeName} <span className="table-subtext">{l.employeeCode}</span></td>
              <td>{l.date}</td>
              <td>{l.checkIn ? formatTime(l.checkIn) : '—'}</td>
              <td>{l.checkOut ? formatTime(l.checkOut) : '—'}</td>
              <td><span className={`badge status-${l.status}`}>{l.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LeaveTab() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [comments, setComments] = useState({});

  async function load() {
    try {
      const res = await api.get('/admin/leave');
      setLogs(res.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id, status) {
    try {
      await api.put(`/admin/leave/${id}`, { status, adminComment: comments[id] || '' });
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Leave Requests</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="table-wrap">
<table className="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Dates</th>
            <th>Type</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Comment</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr><td colSpan="7" className="empty-row">No leave requests yet.</td></tr>
          )}
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.employeeName} <span className="table-subtext">{l.employeeCode}</span></td>
              <td>{l.fromDate} → {l.toDate}</td>
              <td>{l.type}</td>
              <td>{l.reason || '—'}</td>
              <td><span className={`badge status-${l.status}`}>{l.status}</span></td>
              <td>
                <input
                  type="text"
                  placeholder="Optional comment"
                  defaultValue={l.adminComment}
                  onChange={(e) => setComments({ ...comments, [l.id]: e.target.value })}
                />
              </td>
              <td className="action-cell">
                <button className="btn btn-sm btn-success" onClick={() => updateStatus(l.id, 'approved')} disabled={l.status === 'approved'}>
                  Approve
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => updateStatus(l.id, 'rejected')} disabled={l.status === 'rejected'}>
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function HolidaysTab() {
  const emptyForm = { date: '', name: '', description: '' };
  const [holidays, setHolidays] = useState([]);
  const [balances, setBalances] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [holidayRes, balanceRes] = await Promise.all([
        api.get('/holidays'),
        api.get('/admin/leave-balance')
      ]);
      setHolidays(holidayRes.data);
      setBalances(balanceRes.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (editingId) {
        await api.put(`/holidays/${editingId}`, form);
        setSuccess('Holiday updated. Employee leave balances have been recalculated.');
      } else {
        await api.post('/holidays', form);
        setSuccess('Holiday added. Employee leave balances have been recalculated.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(h) {
    setEditingId(h.id);
    setError('');
    setSuccess('');
    setForm({ date: h.date, name: h.name, description: h.description || '' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this holiday? Employee leave balances will be recalculated.')) return;
    try {
      await api.delete(`/holidays/${id}`);
      if (editingId === id) cancelEdit();
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2>{editingId ? 'Edit Holiday' : 'Add Holiday'}</h2>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <label className="field">
                <span>Date</span>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label className="field">
                <span>Holiday Name</span>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali" />
              </label>
            </div>
            <label className="field">
              <span>Note (optional)</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="field-row">
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? 'Saving...' : editingId ? 'Update Holiday' : 'Add Holiday'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Holiday Calendar ({holidays.length})</h2>
          </div>
          <div className="table-wrap">
<table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 && (
                <tr><td colSpan="4" className="empty-row">No holidays added yet.</td></tr>
              )}
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td>{h.date}</td>
                  <td>{h.name}</td>
                  <td>{h.description || '—'}</td>
                  <td className="action-cell">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(h)}>Edit</button>
                    <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDelete(h.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Employee Leave Balances</h2>
        </div>
        <p className="table-subtext leave-balance-note">
          Every employee earns 1 free leave day per month. Approved leave days that fall on a holiday above
          don't count against the balance, so this table updates automatically whenever holidays are added,
          edited or removed.
        </p>
        <div className="table-wrap">
<table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Allotted</th>
              <th>Used</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {balances.length === 0 && (
              <tr><td colSpan="4" className="empty-row">No employees yet.</td></tr>
            )}
            {balances.map((b) => (
              <tr key={b.employeeId}>
                <td>{b.employeeName} <span className="table-subtext">{b.employeeCode}</span></td>
                <td>{b.totalAllotted}</td>
                <td>{b.used}</td>
                <td>{b.remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function PayslipsTab({ employees }) {
  const [payslips, setPayslips] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ employeeId: '', month: '', year: new Date().getFullYear().toString() });
  const [file, setFile] = useState(null);

  async function load() {
    try {
      const res = await api.get('/admin/payslips');
      setPayslips(res.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!file) {
      setError('Please attach the payslip file (PDF, PNG or JPG).');
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      data.append('employeeId', form.employeeId);
      data.append('month', form.month);
      data.append('year', form.year);
      data.append('file', file);
      await api.post('/admin/payslips', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess('Payslip uploaded. Employee has been notified by email.');
      setForm({ employeeId: '', month: '', year: new Date().getFullYear().toString() });
      setFile(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <h2>Upload Payslip</h2>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Employee</span>
            <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label className="field">
              <span>Month</span>
              <input required placeholder="e.g. August" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
            </label>
            <label className="field">
              <span>Year</span>
              <input required value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>Payslip File (PDF/PNG/JPG)</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" required onChange={(e) => setFile(e.target.files[0])} />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Uploading...' : 'Upload Payslip'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Uploaded Payslips</h2>
        </div>
        <div className="table-wrap">
<table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Month</th>
              <th>Year</th>
              <th>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {payslips.length === 0 && (
              <tr><td colSpan="4" className="empty-row">No payslips uploaded yet.</td></tr>
            )}
            {payslips.map((p) => (
              <tr key={p.id}>
                <td>{p.employeeName} <span className="table-subtext">{p.employeeCode}</span></td>
                <td>{p.month}</td>
                <td>{p.year}</td>
                <td>{formatDate(p.uploadedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RequestsTab() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [replies, setReplies] = useState({});

  async function load() {
    try {
      const res = await api.get('/admin/requests');
      setLogs(res.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id, status) {
    try {
      await api.put(`/admin/requests/${id}`, { status, adminReply: replies[id] || '' });
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Employee Requests</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="table-wrap">
<table className="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Subject</th>
            <th>Message</th>
            <th>Status</th>
            <th>Reply</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr><td colSpan="6" className="empty-row">No requests yet.</td></tr>
          )}
          {logs.map((r) => (
            <tr key={r.id}>
              <td>{r.employeeName} <span className="table-subtext">{r.employeeCode}</span></td>
              <td>{r.subject}</td>
              <td>{r.message}</td>
              <td><span className={`badge status-${r.status}`}>{r.status}</span></td>
              <td>
                <input
                  type="text"
                  placeholder="Reply to employee"
                  defaultValue={r.adminReply}
                  onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })}
                />
              </td>
              <td className="action-cell">
                <button className="btn btn-sm btn-success" onClick={() => updateStatus(r.id, 'resolved')} disabled={r.status === 'resolved'}>
                  Resolve
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString();
}
