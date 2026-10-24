import React, { useState } from 'react';
import { STRINGS } from '../strings';
import { api } from '../api';

export default function OperatorQueue({
  incidents,
  teams,
  reports,
  role,
  selectedIncident,
  onSelectIncident,
  onCloseDrawer,
  onRefresh,
}) {
  const [filterBlock, setFilterBlock] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Log Call form state
  const [callNotes, setCallNotes] = useState('');
  const [callLocation, setCallLocation] = useState('');
  const [callCategory, setCallCategory] = useState('Trapped or stranded');
  const [callSector, setCallSector] = useState('B4');
  const [callPeople, setCallPeople] = useState('1');
  const [callPhone, setCallPhone] = useState('');
  const [linkToIncidentId, setLinkToIncidentId] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  const filteredIncidents = incidents.filter(i => {
    if (filterBlock !== 'ALL' && i.grid_block_id !== filterBlock) return false;
    return true;
  });

  // Check for duplicate suggestions when logging call
  const duplicateSuggestion = incidents.find(i => 
    i.workflow_state !== 'resolved' &&
    (i.location_landmark?.toLowerCase().includes(callLocation.toLowerCase().trim()) ||
     callLocation.toLowerCase().includes(i.grid_block_id?.toLowerCase() || ''))
  );

  const handleAiStructure = async () => {
    if (!callNotes.trim()) return;
    setAiLoading(true);
    setActionError('');
    try {
      const res = await api.structureCallAI(callNotes, role);
      if (res.category) setCallCategory(res.category);
      if (res.grid_block_id) setCallSector(res.grid_block_id);
      if (res.location_landmark) setCallLocation(res.location_landmark);
      if (res.people_count) setCallPeople(res.people_count);
      setAiSuggested(true);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveLogCall = async () => {
    if (!callNotes.trim()) return;
    try {
      const report = await api.logCall({
        caller_notes: callNotes,
        caller_location: callLocation || `Sector ${callSector}`,
        caller_phone: callPhone,
        incident_id: linkToIncidentId || (duplicateSuggestion ? duplicateSuggestion.id : null),
      }, role);

      // If linking to an incident, link it
      if (linkToIncidentId) {
        await api.linkReport(linkToIncidentId, report.id, role);
      } else if (!duplicateSuggestion) {
        // Optionally create an incident from this call
        await api.syncBatch([{
          category: callCategory,
          grid_block_id: callSector,
          location_landmark: callLocation || `Sector ${callSector}`,
          people_count: callPeople,
          notes: `Logged call: ${callNotes}`,
          source_type: 'call_log',
          urgency: 'high',
        }], role);
      }

      setShowLogCallModal(false);
      setCallNotes('');
      setCallLocation('');
      setCallPhone('');
      setLinkToIncidentId('');
      setAiSuggested(false);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleVerify = async (incident) => {
    setActionError('');
    try {
      await api.updateIncident(incident.id, {
        workflow_state: 'dispatcher_acknowledged',
      }, role);
      setActionSuccess('Incident acknowledged by dispatcher.');
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleResolve = async (incident) => {
    setActionError('');
    try {
      await api.updateIncident(incident.id, {
        workflow_state: 'resolved',
      }, role);
      setActionSuccess('Incident resolved successfully.');
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleAssignTeam = async () => {
    if (!selectedTeamId || !selectedIncident) return;
    setActionError('');
    try {
      await api.assignTeam(selectedIncident.id, selectedTeamId, role);
      setShowAssignDialog(false);
      setSelectedTeamId('');
      setActionSuccess(`Assigned team ${selectedTeamId} to ${selectedIncident.id}`);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div className="operator-queue">
      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn-primary"
            style={{ minHeight: '44px', padding: '0 18px', fontSize: '0.95rem' }}
            onClick={() => setShowLogCallModal(true)}
          >
            ☎ {STRINGS.en.logCallButton}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ minHeight: '44px', padding: '0 16px', fontSize: '0.95rem' }}
            onClick={() => setShowFilters(!showFilters)}
          >
            {STRINGS.en.filterButton} {filterBlock !== 'ALL' ? `(${filterBlock})` : ''}
          </button>
        </div>

        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Showing {filteredIncidents.length} incidents
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, marginRight: '10px' }}>Filter by Sector:</label>
          <select
            value={filterBlock}
            onChange={(e) => setFilterBlock(e.target.value)}
            className="form-select"
            style={{ minWidth: '140px' }}
          >
            <option value="ALL">All Sectors</option>
            {['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4'].map(b => (
              <option key={b} value={b}>Sector {b}</option>
            ))}
          </select>
        </div>
      )}

      {actionSuccess && (
        <div className="status-banner" style={{ background: 'var(--success-bg)', color: 'var(--success-text)', marginBottom: '16px' }}>
          ✓ {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="status-banner" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', marginBottom: '16px' }}>
          ⚠ {actionError}
        </div>
      )}

      {/* Incident Queue Table */}
      <div className="data-table-wrapper">
        <table className="data-table" role="table" aria-label="Incident Queue">
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Sector</th>
              <th>Time</th>
              <th>Transport</th>
              <th>Workflow State</th>
              <th>Assigned Team</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                  No incidents in queue.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((inc) => (
                <tr key={inc.id} onClick={() => onSelectIncident(inc)}>
                  <td style={{ fontWeight: 600 }}>{inc.id}</td>
                  <td>{inc.category}</td>
                  <td>Sector {inc.grid_block_id || 'B4'}</td>
                  <td>{new Date(inc.created_at).toLocaleTimeString()}</td>
                  <td>
                    <span className="badge-sim">{inc.transport_state}</span>
                  </td>
                  <td>
                    <span className="badge-sim" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
                      {inc.workflow_state}
                    </span>
                  </td>
                  <td>{inc.assigned_team?.name || inc.assigned_team_id || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ minHeight: '32px', padding: '0 10px', fontSize: '0.8rem' }}
                      onClick={() => onSelectIncident(inc)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Incident Drawer (Right Side) */}
      {selectedIncident && (
        <div className="drawer-backdrop" onClick={onCloseDrawer}>
          <aside className="drawer-panel" onClick={(e) => e.stopPropagation()} aria-label="Incident Details">
            <div className="drawer-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Incident {selectedIncident.id}</h3>
              <button type="button" className="btn-secondary" style={{ minHeight: '32px', padding: '0 8px' }} onClick={onCloseDrawer}>
                ✕
              </button>
            </div>

            <div>
              <p><strong>Category:</strong> {selectedIncident.category}</p>
              <p><strong>Location:</strong> {selectedIncident.location_landmark || `Sector ${selectedIncident.grid_block_id}`}</p>
              <p><strong>Sector:</strong> {selectedIncident.grid_block_id}</p>
              <p><strong>People:</strong> {selectedIncident.people_count}</p>
              <p><strong>Urgency:</strong> {selectedIncident.urgency}</p>
              <p><strong>Transport:</strong> {selectedIncident.transport_state}</p>
              <p><strong>Workflow:</strong> {selectedIncident.workflow_state}</p>
              <p><strong>Team:</strong> {selectedIncident.assigned_team?.name || selectedIncident.assigned_team_id || 'None allocated'}</p>
              <p><strong>Reported:</strong> {new Date(selectedIncident.created_at).toLocaleString()}</p>
              {selectedIncident.notes && (
                <div style={{ marginTop: '10px', background: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                  <strong>Notes:</strong> {selectedIncident.notes}
                </div>
              )}
            </div>

            {/* Linked reports */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>Linked Call Logs</h4>
              {reports.filter(r => r.incident_id === selectedIncident.id).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No call logs linked to this incident.</p>
              ) : (
                reports.filter(r => r.incident_id === selectedIncident.id).map(r => (
                  <div key={r.id} style={{ background: 'var(--bg-subtle)', padding: '8px', borderRadius: 'var(--radius-sm)', marginBottom: '6px', fontSize: '0.85rem' }}>
                    <strong>{r.id}:</strong> {r.caller_notes} ({r.caller_location})
                  </div>
                ))
              )}
            </div>

            {/* Operator Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
              {selectedIncident.workflow_state === 'awaiting_dispatcher' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleVerify(selectedIncident)}
                >
                  Verify / Acknowledge
                </button>
              )}

              {selectedIncident.workflow_state !== 'resolved' && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAssignDialog(true)}
                >
                  Assign Response Team...
                </button>
              )}

              {selectedIncident.workflow_state !== 'resolved' && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#059669' }}
                  onClick={() => handleResolve(selectedIncident)}
                >
                  Resolve Incident
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Team Assignment Confirmation Dialog */}
      {showAssignDialog && (
        <div className="modal-backdrop">
          <div className="modal-content" role="dialog" aria-modal="true" aria-label="Confirm Team Assignment">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '14px' }}>
              Confirm Team Assignment
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Allocating a team dispatches an operational task to that unit. Please select an available unit:
            </p>

            <div className="form-group">
              <label className="form-label">Available Response Teams:</label>
              <select
                className="form-select"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              >
                <option value="">Select team...</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.team_type}) - Sector {t.current_block} [{t.status}]
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAssignTeam}
                disabled={!selectedTeamId}
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      {showLogCallModal && (
        <div className="modal-backdrop">
          <div className="modal-content" role="dialog" aria-modal="true" aria-label="Log Emergency Call">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '14px' }}>
              Log Emergency Call
            </h3>

            <div className="form-group">
              <label className="form-label">Caller Notes (Raw transcription):</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="e.g., Caller reported water rising near Sector B4 market, family of 4 stranded on roof"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
              ></textarea>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                onClick={handleAiStructure}
                disabled={aiLoading || !callNotes.trim()}
              >
                {aiLoading ? 'Processing...' : '✨ Helper: Extract Structured Fields'}
              </button>
              {aiSuggested && (
                <span className="badge-sim" style={{ marginLeft: '10px', background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
                  {STRINGS.en.aiSuggestBadge}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Category:</label>
                <input
                  type="text"
                  className="form-input"
                  value={callCategory}
                  onChange={(e) => setCallCategory(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sector:</label>
                <select
                  className="form-select"
                  value={callSector}
                  onChange={(e) => setCallSector(e.target.value)}
                >
                  {['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4'].map(s => (
                    <option key={s} value={s}>Sector {s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Location Landmark:</label>
              <input
                type="text"
                className="form-input"
                value={callLocation}
                onChange={(e) => setCallLocation(e.target.value)}
                placeholder="e.g. Near Sector B4 Community School"
              />
            </div>

            {duplicateSuggestion && (
              <div style={{ background: 'var(--info-bg)', color: 'var(--info-text)', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '0.85rem' }}>
                💡 <strong>Duplicate link suggestion:</strong> Matches active incident {duplicateSuggestion.id} ({duplicateSuggestion.category} at {duplicateSuggestion.location_landmark || duplicateSuggestion.grid_block_id}).
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowLogCallModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveLogCall}
                disabled={!callNotes.trim()}
              >
                Save Call Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
