import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { playClick, playConnect, playOpen } from '../utils/sound';

const SEAT_DISTANCE = 130;
const DRAG_THRESHOLD = 85;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [plugged, setPlugged] = useState(false);
  const [opening, setOpening] = useState(false);
  const [risen, setRisen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [loginShown, setLoginShown] = useState(false);

  const [dragX, setDragX] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const timers = useRef([]);
  const pluggedRef = useRef(false);

  const buildings = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        h: 30 + Math.random() * 95,
        w: 16 + Math.random() * 22,
        bob: (1 + Math.random() * 0.08).toFixed(3),
        dur: (3 + Math.random() * 3).toFixed(2),
        delay: (Math.random() * 2).toFixed(2),
        windows: Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({
          left: 20 + Math.random() * 60,
          top: 15 + Math.random() * 65,
          dur: (2 + Math.random() * 3).toFixed(2),
          delay: (Math.random() * 3).toFixed(2),
        })),
      })),
    []
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function connect() {
    if (pluggedRef.current) return;
    pluggedRef.current = true;
    setPlugged(true);
    playConnect();
    const t = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    t(() => { setOpening(true); playOpen(); }, 1050);
    t(() => setRisen(true), 1550);
    t(() => setRevealed(true), 1950);
    t(() => setLoginShown(true), 3400);
  }

  function onDown(e) {
    if (pluggedRef.current) return;
    dragging.current = true;
    startX.current = e.touches ? e.touches[0].clientX : e.clientX;
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current || pluggedRef.current) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const dx = Math.max(0, Math.min(SEAT_DISTANCE, x - startX.current));
      setDragX(dx);
      if (dx >= DRAG_THRESHOLD) {
        dragging.current = false;
        setDragX(0);
        connect();
      }
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      setDragX(0);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const stageClass = [
    'auth-stage',
    plugged && 'is-plugged',
    opening && 'is-opening',
    revealed && 'is-revealed',
    loginShown && 'is-login',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="auth-page">
      <div className={stageClass}>
        <div className="scene">
          <div className="scene-sun" />
          <div className="scene-haze" />
          <div className="scene-skyline">
            {buildings.map((b, i) => (
              <div
                key={i}
                className={`bldg${risen ? ' bldg-idle' : ''}`}
                style={{
                  width: `${b.w}px`,
                  height: `${b.h}%`,
                  transitionDelay: `${i * 35}ms`,
                  transform: risen ? 'scaleY(1)' : 'scaleY(0)',
                  '--bob': b.bob,
                  '--bob-dur': `${b.dur}s`,
                  '--bob-delay': `${b.delay}s`,
                }}
              >
                {b.windows.map((w, j) => (
                  <i
                    key={j}
                    className="bldg-win"
                    style={{
                      left: `${w.left}%`,
                      top: `${w.top}%`,
                      animationDuration: `${w.dur}s`,
                      animationDelay: `${w.delay}s`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="scene-floor" />
          <div className="scene-tagline">
            <h2>
              A BRIGHTER TOMORROW
              <br />
              TOGETHER
            </h2>
            <span className="scene-rule" />
          </div>
        </div>

        <div className="door door-l" />
        <div className="door door-r" />

        <div className="intro">
          <div className="intro-logo">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <linearGradient id="hrLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5eead4" />
                  <stop offset="55%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <circle
                cx="50" cy="50" r="34" fill="none"
                stroke="url(#hrLogo)" strokeWidth="11" strokeLinecap="round"
                strokeDasharray="180 40" transform="rotate(-40 50 50)"
              />
              <rect x="66" y="18" width="9" height="9" fill="#f59e0b" transform="rotate(20 70 22)" />
              <rect x="76" y="28" width="6" height="6" fill="#fbbf24" transform="rotate(20 79 31)" />
            </svg>
          </div>

          <div className="intro-name">
            HR PORTAL
            <span className="intro-tiny">EMPLOYEE SELF SERVICE</span>
          </div>
          <div className="intro-words">PEOPLE · ATTENDANCE · LEAVE · PAYROLL</div>

          <div className="plug-rig">
            <div className="socket">
              <span className="socket-hole" />
              <span className="socket-hole" />
              <span className="socket-spark" />
            </div>
            <div
              className="plug"
              onMouseDown={onDown}
              onTouchStart={onDown}
              onClick={() => dragX === 0 && connect()}
              style={
                plugged
                  ? undefined
                  : {
                      transform: `translateY(-50%) translateX(${dragX}px)`,
                      transition: dragX ? 'none' : undefined,
                    }
              }
              role="button"
              tabIndex={0}
              aria-label="Plug in to enter"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && connect()}
            >
              <span className="plug-cord" />
              <span className="plug-body" />
              <span className="plug-pin plug-pin-a" />
              <span className="plug-pin plug-pin-b" />
            </div>
            <div className="powerline" />
          </div>

          <div className="intro-hint">DRAG THE PLUG INTO THE SOCKET</div>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card-logo">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50" cy="50" r="34" fill="none"
                stroke="url(#hrLogo)" strokeWidth="11" strokeLinecap="round"
                strokeDasharray="180 40" transform="rotate(-40 50 50)"
              />
            </svg>
          </div>

          <h1>Welcome Back</h1>
          <p className="auth-subtitle">Sign in with your company email</p>

          {error && <div className="alert alert-error">{error}</div>}

          <label className="field">
            <span>Email</span>
            <div className="field-input">
              <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="field-input field-pw">
              <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="10.5" width="14" height="9" rx="2.2" />
                <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
              </svg>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className={`pw-toggle${showPw ? ' pw-toggle-active' : ''}`}
                onClick={() => { playClick(); setShowPw((v) => !v); }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                aria-pressed={showPw}
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                    <circle cx="12" cy="12" r="2.6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 6 10 6a17.6 17.6 0 0 1-3.7 4.3M6.5 6.6C3.7 8.3 2 12 2 12s3.5 6 10 6c1.4 0 2.6-.27 3.7-.7" />
                    <path d="M9.5 9.8a3 3 0 0 0 4.2 4.2" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="auth-hint">
            Default HR admin: <code>admin@company.com</code> / <code>admin123</code>
          </p>
        </form>
      </div>
    </div>
  );
}
