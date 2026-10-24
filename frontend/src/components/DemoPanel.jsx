import React, { useState } from 'react';
import { api } from '../api';

const NET_MODES = ['Normal', 'Internet Outage', 'Relay-Only', 'Total Loss'];

export default function DemoPanel({ networkMode, onNetworkChange, onReset, role }) {
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [netError, setNetError] = useState('');

  const handleNetChange = async (mode) => {
    setNetError('');
    try {
      await onNetworkChange(mode);
    } catch (err) {
      setNetError(err.message || 'Network mode change failed.');
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setResetMsg('');
    try {
      await onReset();
      setResetMsg('Demo reset complete. All fixtures reloaded.');
    } catch (err) {
      setResetMsg('Reset failed: ' + (err.message || 'unknown error'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <aside style={{
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
      marginBottom: '20px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      alignItems: 'flex-start',
    }}>
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Demo Network Control
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {NET_MODES.map(mode => (
            <button key={mode} type="button"
              className={networkMode === mode ? 'btn-primary' : 'btn-secondary'}
              style={{ minHeight: '36px', padding: '0 12px', fontSize: '0.82rem' }}
              onClick={() => handleNetChange(mode)}>
              {mode}
            </button>
          ))}
        </div>
        {netError && <div style={{ color: 'var(--warning-text)', fontSize: '0.8rem', marginTop: '6px' }}>⚠ {netError}</div>}
        {networkMode !== 'Normal' && (
          <div style={{ fontSize: '0.78rem', color: 'var(--warning-text)', marginTop: '6px' }}>
            ⚡ Sync disabled in "{networkMode}" mode. New requests will queue locally.
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <button type="button" className="btn-secondary"
          style={{ minHeight: '36px', padding: '0 16px', fontSize: '0.85rem', borderColor: '#f87171', color: '#dc2626' }}
          onClick={handleReset} disabled={resetting}>
          {resetting ? 'Resetting…' : '↺ Reset Demo'}
        </button>
        {resetMsg && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{resetMsg}</div>}
      </div>
    </aside>
  );
}
