import React from 'react';
import type { ConnectionState } from '../hooks/useTaskSocket';

type Page = 'workspace' | 'history';

interface NavigationProps {
  connectionStatus: ConnectionState;
  useMock: boolean;
  onToggleMock: (val: boolean) => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  connectionStatus,
  useMock,
  onToggleMock,
  currentPage,
  onNavigate
}) => {
  const getConnLabel = () => {
    if (useMock) return 'Demo Mode';
    if (connectionStatus === 'connected') return 'Live';
    if (connectionStatus === 'connecting') return 'Connecting…';
    if (connectionStatus === 'reconnecting') return 'Reconnecting…';
    return 'Offline';
  };

  const getConnClass = () => {
    if (useMock) return 'mock';
    if (connectionStatus === 'connected') return 'live';
    if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') return 'connecting';
    return 'offline';
  };

  return (
    <nav className="nav-bar">
      <div className="nav-inner">
        {/* Brand */}
        <a className="nav-brand" href="#" onClick={e => { e.preventDefault(); onNavigate('workspace'); }}>
          <div className="nav-brand-icon">🏢</div>
          <div>
            <div className="nav-brand-name">Virtual Office</div>
            <div className="nav-brand-sub">AI Task Manager</div>
          </div>
        </a>

        {/* Links */}
        <div className="nav-links">
          <button
            className={`nav-link ${currentPage === 'workspace' ? 'active' : ''}`}
            onClick={() => onNavigate('workspace')}
          >
            Workspace
          </button>
          <button
            className={`nav-link ${currentPage === 'history' ? 'active' : ''}`}
            onClick={() => onNavigate('history')}
          >
            History
          </button>
        </div>

        {/* Right */}
        <div className="nav-right">
          <div className={`conn-badge`}>
            <span className={`conn-dot ${getConnClass()}`} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>{getConnLabel()}</span>
          </div>

          <button
            className="btn-ghost"
            onClick={() => onToggleMock(!useMock)}
            title={useMock ? 'Switch to live backend' : 'Switch to demo mode'}
            style={{ fontSize: '11.5px' }}
          >
            {useMock ? '⚡ Use Live' : '🎭 Demo'}
          </button>
        </div>
      </div>
    </nav>
  );
};
