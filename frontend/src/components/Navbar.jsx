import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">HR Portal</div>
      {user && (
        <div className="navbar-user">
          <div className="navbar-user-info">
            <span className="navbar-user-name">{user.name}</span>
            <span className={`badge role-${user.role}`}>{user.role}</span>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
