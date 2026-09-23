import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api, { errMsg } from '../api';

const TABS = ['Attendance', 'Leave', 'Holidays', 'Payslips', 'Requests'];

export default function EmployeeDashboard() {
  const [tab, setTab] = useState('Attendance');

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

        {tab === 'Attendance' && <AttendanceTab />}
        {tab === 'Leave' && <LeaveTab />}
        {tab === 'Holidays' && <HolidaysTab />}
        {tab === 'Payslips' && <PayslipsTab />}
        {tab === 'Requests' && <RequestsTab />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function AttendanceTab() {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const todayStr = now.toISOString().slice(0, 10);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex);
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [todayRes, historyRes, leaveRes, holidayRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/attendance/me'),
        api.get('/leave/me'),
        api.get('/holidays')
      ]);
      setToday(todayRes.data);
      setHistory(historyRes.data);
      setLeaves(leaveRes.data);
      setHolidays(holidayRes.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function checkIn() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/attendance/checkin');
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/attendance/checkout');
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const canCheckIn = !today || !today.checkIn;
  const canCheckOut = today && today.checkIn && !today.checkOut;

  const attendanceByDate = {};
  history.forEach((h) => { attendanceByDate[h.date] = h; });

  const holidaysThisYear = holidays.filter((h) => h.date.startsWith(String(year)));
  const holidayByDate = {};
  holidaysThisYear.forEach((h) => { holidayByDate[h.date] = h; });

  function isOnLeave(dateStr) {
    return leaves.some((l) => l.status === 'approved' && dateStr >= l.fromDate && dateStr <= l.toDate);
  }

  // Clicking a day on the calendar. Only today's cell can actually check in -
  // attempting it for a future date (e.g. tapping tomorrow) is rejected here
  // before any request is sent.
  function handleDayClick(dateStr) {
    setError('');
    setNotice('');
    if (dateStr > todayStr) {
      setError(`Invalid: you tried to check in for ${dateStr}, but that's a future date. Check-in is only allowed for today (${todayStr}).`);
      return;
    }
    if (dateStr === todayStr) {
      if (canCheckIn) {
        setNotice('Use the "Check In" button above to check in for today.');
      } else if (canCheckOut) {
        setNotice('You are checked in for today. Use "Check Out" above when you leave.');
      } else {
        setNotice('You have already checked in and out for today.');
      }
      return;
    }
    const record = attendanceByDate[dateStr];
    const onLeave = isOnLeave(dateStr);
    const holiday = holidayByDate[dateStr];
    if (onLeave) {
      setNotice(`${dateStr}: On approved leave.`);
    } else if (holiday) {
      setNotice(`${dateStr}: Company holiday - ${holiday.name}.`);
    } else if (record && record.checkIn) {
      setNotice(`${dateStr}: Present (in ${formatTime(record.checkIn)}${record.checkOut ? `, out ${formatTime(record.checkOut)}` : ''}).`);
    } else {
      setNotice(`${dateStr}: No attendance record.`);
    }
  }

  const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
  const firstWeekday = new Date(year, selectedMonth, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card">
      <div className="card-header">
        <h2>Today's Attendance</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="attendance-actions">
        <button className="btn btn-primary" onClick={checkIn} disabled={!canCheckIn || busy}>
          Check In
        </button>
        <button className="btn btn-secondary" onClick={checkOut} disabled={!canCheckOut || busy}>
          Check Out
        </button>
        {today && (
          <div className="attendance-status">
            {today.checkIn && <span>In: {formatTime(today.checkIn)}</span>}
            {today.checkOut && <span>Out: {formatTime(today.checkOut)}</span>}
          </div>
        )}
      </div>

      <h3 className="section-title">Attendance Calendar &mdash; {year}</h3>
      <div className="month-pills">
        {MONTH_NAMES.map((m, idx) => (
          <button
            key={m}
            type="button"
            className={`month-pill ${idx === selectedMonth ? 'month-pill-active' : ''}`}
            onClick={() => { setSelectedMonth(idx); setError(''); setNotice(''); }}
          >
            {m.slice(0, 3)}
            {idx === currentMonthIndex && <span className="month-pill-dot" />}
          </button>
        ))}
      </div>

      <div className="calendar">
        <div className="calendar-topline">
          <span className="calendar-month-label">{MONTH_NAMES[selectedMonth]} {year}</span>
          <div className="calendar-legend">
            <span><i className="dot dot-green" />Present</span>
            <span><i className="dot dot-red" />Leave</span>
            <span><i className="dot dot-blue" />Holiday</span>
          </div>
        </div>
        <div className="calendar-grid">
          {WEEKDAY_NAMES.map((d) => (
            <div key={d} className="calendar-weekday">{d}</div>
          ))}
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="calendar-cell calendar-cell-empty" />;
            const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = attendanceByDate[dateStr];
            const holiday = holidayByDate[dateStr];
            const onLeave = isOnLeave(dateStr);

            let cls = 'calendar-cell';
            if (onLeave) cls += ' calendar-cell-leave';
            else if (holiday) cls += ' calendar-cell-holiday';
            else if (record && record.checkIn) cls += ' calendar-cell-present';
            if (dateStr === todayStr) cls += ' calendar-cell-today';
            if (dateStr > todayStr) cls += ' calendar-cell-future';

            return (
              <button
                key={dateStr}
                type="button"
                className={cls}
                title={onLeave ? 'On leave' : holiday ? holiday.name : record?.checkIn ? 'Present' : ''}
                onClick={() => handleDayClick(dateStr)}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <h3 className="section-title">History</h3>
      <div className="table-wrap">
<table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && (
            <tr>
              <td colSpan="4" className="empty-row">No attendance records yet.</td>
            </tr>
          )}
          {history.map((h) => (
            <tr key={h.id}>
              <td>{h.date}</td>
              <td>{h.checkIn ? formatTime(h.checkIn) : '—'}</td>
              <td>{h.checkOut ? formatTime(h.checkOut) : '—'}</td>
              <td>
                <span className={`badge status-${h.status}`}>{h.status}</span>
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

function LeaveTab() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fromDate: '', toDate: '', type: 'casual', reason: '' });

  async function load() {
    try {
      const res = await api.get('/leave/me');
      setHistory(res.data);
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
      await api.post('/leave', form);
      setForm({ fromDate: '', toDate: '', type: 'casual', reason: '' });
      setSuccess('Leave request submitted. HR has been notified by email.');
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
          <h2>Apply for Leave</h2>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <label className="field">
              <span>From</span>
              <input
                type="date"
                required
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                type="date"
                required
                value={form.toDate}
                onChange={(e) => setForm({ ...form, toDate: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="casual">Casual</option>
              <option value="sick">Sick</option>
              <option value="earned">Earned</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label className="field">
            <span>Reason</span>
            <textarea
              rows="3"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Brief reason for HR"
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Leave History</h2>
        </div>
        <div className="table-wrap">
<table className="table">
          <thead>
            <tr>
              <th>Dates</th>
              <th>Type</th>
              <th>Status</th>
              <th>HR Comment</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan="4" className="empty-row">No leave requests yet.</td>
              </tr>
            )}
            {history.map((l) => (
              <tr key={l.id}>
                <td>{l.fromDate} → {l.toDate}</td>
                <td>{l.type}</td>
                <td><span className={`badge status-${l.status}`}>{l.status}</span></td>
                <td>{l.adminComment || '—'}</td>
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

function HolidaysTab() {
  const [holidays, setHolidays] = useState([]);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');

  async function loadHolidays() {
    try {
      const res = await api.get('/holidays');
      setHolidays(res.data);
    } catch (err) {
      console.error('Holiday loading error:', err);
      setError(errMsg(err));
    }
  }

  async function loadBalance() {
    try {
      const res = await api.get('/leave/balance');
      setBalance(res.data);
    } catch (err) {
      // Leave-balance errors must not prevent the holiday calendar
      // from being displayed.
      console.error('Leave balance error:', err);
      setBalance(null);
    }
  }

  async function load() {
    // Load these independently. If /leave/balance returns
    // "User not found", /holidays can still load successfully.
    await Promise.allSettled([
      loadHolidays(),
      loadBalance()
    ]);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <h2>Company Holidays</h2>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="table-wrap">
<table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Holiday</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {holidays.length === 0 && (
              <tr>
                <td colSpan="3" className="empty-row">No holidays added yet.</td>
              </tr>
            )}
            {holidays.map((h) => (
              <tr key={h.id}>
                <td>{h.date}</td>
                <td>{h.name}</td>
                <td>{h.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>My Leave Balance {balance ? `(${balance.year})` : ''}</h2>
        </div>
        {balance && (
          <>
            <div className="leave-balance-summary">
              <div className="lb-stat">
                <span className="lb-value">{balance.totalAllotted}</span>
                <span className="lb-label">Total (1 / month)</span>
              </div>
              <div className="lb-stat">
                <span className="lb-value">{balance.used}</span>
                <span className="lb-label">Used</span>
              </div>
              <div className="lb-stat">
                <span className="lb-value">{balance.remaining}</span>
                <span className="lb-label">Remaining</span>
              </div>
            </div>
            <h3 className="section-title">Where it was used</h3>
            <div className="table-wrap">
<table className="table">
              <thead>
                <tr>
                  <th>Dates</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {balance.breakdown.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-row">No leave taken this year yet.</td>
                  </tr>
                )}
                {balance.breakdown.map((b) => (
                  <tr key={b.id}>
                    <td>{b.fromDate} → {b.toDate}</td>
                    <td>{b.type}</td>
                    <td><span className={`badge status-${b.status}`}>{b.status}</span></td>
                    <td>
                      {b.countsAgainstBalance ? b.workingDays : 0}
                      {b.holidayOverlapDays > 0 ? ` (${b.holidayOverlapDays} on holiday)` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PayslipsTab() {
  const [payslips, setPayslips] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/payslips/me')
      .then((res) => setPayslips(res.data))
      .catch((err) => setError(errMsg(err)));
  }, []);

  async function download(id, originalName) {
    try {
      const res = await api.get(`/payslips/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || 'payslip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Payslips</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="table-wrap">
<table className="table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Year</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payslips.length === 0 && (
            <tr>
              <td colSpan="4" className="empty-row">
                No payslips uploaded yet. HR will upload them here once available.
              </td>
            </tr>
          )}
          {payslips.map((p) => (
            <tr key={p.id}>
              <td>{p.month}</td>
              <td>{p.year}</td>
              <td>{formatDate(p.uploadedAt)}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => download(p.id, p.originalName)}>
                  Download
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

function RequestsTab() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '' });

  async function load() {
    try {
      const res = await api.get('/requests/me');
      setHistory(res.data);
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
      await api.post('/requests', form);
      setForm({ subject: '', message: '' });
      setSuccess('Request sent to HR by email.');
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
          <h2>Raise a Request to HR</h2>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Subject</span>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. Need Form 16"
            />
          </label>
          <label className="field">
            <span>Message</span>
            <textarea
              rows="4"
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Describe your request"
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Sending...' : 'Send Request'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>My Requests</h2>
        </div>
        <div className="table-wrap">
<table className="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>HR Reply</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan="3" className="empty-row">No requests yet.</td>
              </tr>
            )}
            {history.map((r) => (
              <tr key={r.id}>
                <td>{r.subject}</td>
                <td><span className={`badge status-${r.status}`}>{r.status}</span></td>
                <td>{r.adminReply || '—'}</td>
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

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString();
}
