import React from 'react';
import { STRINGS } from '../strings';

export default function OperatorOverview({
  incidents,
  teams,
  pendingSyncCount,
  onSelectIncident,
  onNavigateTab,
}) {
  const openCount = incidents.filter(i => i.workflow_state !== 'resolved' && i.workflow_state !== 'cancelled').length;
  const criticalCount = incidents.filter(i => i.urgency === 'critical' || i.urgency === 'high').length;
  const activeTeamsCount = teams.filter(t => t.status === 'assigned' || t.status === 'en_route').length;

  // Short prioritized queue (Critical first, then oldest)
  const prioritized = [...incidents]
    .filter(i => i.workflow_state !== 'resolved' && i.workflow_state !== 'cancelled')
    .sort((a, b) => {
      const urgencyRank = { critical: 3, high: 2, standard: 1 };
      const diff = (urgencyRank[b.urgency] || 1) - (urgencyRank[a.urgency] || 1);
      if (diff !== 0) return diff;
      return new Date(a.created_at) - new Date(b.created_at);
    })
    .slice(0, 5);

  const getPriorityReason = (inc) => {
    if (inc.urgency === 'critical') return 'Critical priority: life-safety risk';
    if (inc.category === 'Trapped or stranded') return 'Trapped individuals in rising flood zone';
    if (inc.category === 'Medical help') return 'Urgent medical aid needed';
    if (inc.source_type?.includes('sensor')) return 'Corroborated sensor detection';
    return 'Standard priority: queued for dispatcher review';
  };

  return (
    <div className="operator-overview">
      {/* 4 KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-title">{STRINGS.en.kpiOpen}</div>
          <div className="kpi-value">{openCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">{STRINGS.en.kpiCritical}</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>{criticalCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">{STRINGS.en.kpiUndelivered}</div>
          <div className="kpi-value">{pendingSyncCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">{STRINGS.en.kpiTeams}</div>
          <div className="kpi-value">{activeTeamsCount}</div>
        </div>
      </div>

      {/* Prioritized List */}
      <section style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{STRINGS.en.prioritizedListTitle}</h3>
          <button type="button" className="btn-secondary" onClick={() => onNavigateTab('queue')} style={{ minHeight: '40px', padding: '0 16px' }}>
            View Full Queue →
          </button>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Sector</th>
                <th>Priority Justification</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {prioritized.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No pending priority incidents. All clear.
                  </td>
                </tr>
              ) : (
                prioritized.map((inc) => (
                  <tr key={inc.id} onClick={() => onSelectIncident(inc)}>
                    <td style={{ fontWeight: 600 }}>{inc.id}</td>
                    <td>{inc.category}</td>
                    <td>Sector {inc.grid_block_id || 'B4'}</td>
                    <td style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      {getPriorityReason(inc)}
                    </td>
                    <td>
                      <span className="badge-sim" style={{ background: 'var(--bg-subtle)' }}>
                        {inc.workflow_state}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ minHeight: '34px', padding: '0 12px', fontSize: '0.85rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc);
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
