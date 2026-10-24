import React from 'react';
import { STRINGS } from '../strings';

export default function Header({
  mode,
  onModeChange,
  role,
  onRoleChange,
  networkMode,
}) {
  const getNetDotClass = () => {
    switch (networkMode) {
      case 'Normal': return 'normal';
      case 'Internet Outage': return 'outage';
      case 'Relay-Only': return 'relay';
      case 'Total Loss': return 'loss';
      default: return 'normal';
    }
  };

  return (
    <header className="app-header" role="banner">
      <div className="brand-section">
        <h1 className="brand-title">RESQNET</h1>
        <span className="badge-sim" aria-label="Simulation prototype">
          {STRINGS.en.simulationBadge}
        </span>
      </div>

      <div className="header-controls">
        {/* Everyday / Disaster Mode Switcher */}
        <div className="mode-toggle" role="group" aria-label="Emergency Mode Switcher">
          <button
            type="button"
            className={`mode-btn ${mode === 'Everyday' ? 'active' : ''}`}
            onClick={() => onModeChange('Everyday')}
            aria-pressed={mode === 'Everyday'}
          >
            {STRINGS.en.modeEveryday}
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'Disaster' ? 'active' : ''}`}
            onClick={() => onModeChange('Disaster')}
            aria-pressed={mode === 'Disaster'}
          >
            {STRINGS.en.modeDisaster}
          </button>
        </div>

        {/* Role Demo Switcher */}
        <div className="role-select-wrapper">
          <label htmlFor="role-select">Role:</label>
          <select
            id="role-select"
            className="role-select"
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
          >
            <option value="Citizen">Citizen</option>
            <option value="Dispatcher">Dispatcher</option>
            <option value="Drone Operator">Drone Operator</option>
            <option value="Responder">Responder</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        {/* Network Status Badge */}
        <div className="net-indicator" title={`Simulated Network: ${networkMode}`}>
          <span className={`net-dot ${getNetDotClass()}`} aria-hidden="true"></span>
          <span>{networkMode}</span>
        </div>
      </div>
    </header>
  );
}
