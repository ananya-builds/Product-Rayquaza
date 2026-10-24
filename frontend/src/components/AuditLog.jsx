import React from 'react';

const EVENT_ICONS = {
  sync_ingest: '🔄',
  workflow_update: '📋',
  assignment: '👥',
  call_logged: '☎',
  link_report: '🔗',
  detection_review_started: '🔍',
  detection_confirmed: '✓',
  detection_false_positive: '✗',
  detection_rescan_requested: '🔁',
  incident_from_detection: '⚠',
  network_mode_changed: '🌐',
  survey_executed: '🚁',
  system_init: '⚙',
};

export default function AuditLog({ auditEvents }) {
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Audit Trail</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Immutable log of all reviews, assignments, resolutions, syncs, and role actions.
          {auditEvents.length > 0 && ` ${auditEvents.length} events recorded.`}
        </p>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table" role="table" aria-label="Audit Event Log">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                  No audit events yet.
                </td>
              </tr>
            ) : (
              auditEvents.map(ev => (
                <tr key={ev.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(ev.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span aria-hidden="true">{EVENT_ICONS[ev.event_type] || '📌'}</span>
                      <span className="badge-sim" style={{ fontSize: '0.78rem' }}>{ev.event_type}</span>
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>{ev.entity_type}</span>: {ev.entity_id}
                  </td>
                  <td>
                    <span className="badge-sim" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)', fontSize: '0.78rem' }}>
                      {ev.actor_role}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '360px' }}>
                    {ev.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
