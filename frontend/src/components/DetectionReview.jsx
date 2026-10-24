import React, { useState } from 'react';
import { STRINGS } from '../strings';
import { api } from '../api';

const STATUS_LABELS = {
  new_unverified: 'New — Unreviewed',
  under_human_review: 'Under Human Review',
  possible_person_confirmed: 'Possible Person Confirmed',
  linked_to_existing_incident: 'Linked to Incident',
  false_positive: 'False Positive',
};

const SENSOR_ICONS = { Thermal: '🌡', 'Normal Camera': '📷', Both: '🌡+📷' };

export default function DetectionReview({ detections, role, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [corrobId, setCorrobId] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const canConfirm = role === 'Dispatcher' || role === 'Admin';
  const canStart = role === 'Dispatcher' || role === 'Admin' || role === 'Drone Operator';

  const doAction = async (detId, action, extra = {}) => {
    setIsWorking(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await api.reviewDetection(detId, { action, review_notes: reviewNotes, ...extra }, role);
      setActionSuccess(`Action '${action}' completed for ${detId}.`);
      if (res.incident) setActionSuccess(`Action '${action}' completed. Incident created: ${res.incident.id}`);
      setReviewNotes('');
      setCorrobId('');
      onRefresh();
      setSelected(null);
    } catch (err) {
      setActionError(err.message || String(err));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px' }}>Sensor Detection Review Queue</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          All detections are simulated. No facial recognition. No identity inference.
          Limitations: animals, hot surfaces, debris, obstruction may trigger sensors.
        </p>
      </div>

      {actionSuccess && (
        <div role="status" aria-live="polite" className="status-banner" style={{ background: 'var(--success-bg)', color: 'var(--success-text)', marginBottom: '14px' }}>
          ✓ {actionSuccess}
        </div>
      )}
      {actionError && (
        <div role="alert" className="status-banner" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', marginBottom: '14px' }}>
          ⚠ {actionError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {detections.map(det => (
          <div key={det.id} className="detection-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{det.id}</span>
                <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {SENSOR_ICONS[det.sensor_source] || '📡'} {det.sensor_source}
                </span>
                <span style={{ marginLeft: '10px' }} className="badge-sim">
                  {STATUS_LABELS[det.status] || det.status}
                </span>
              </div>
              <span className="badge-sim" style={{ fontSize: '0.75rem', background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
                Simulated
              </span>
            </div>

            {/* Mandatory labels for all unreviewed detections */}
            {det.status === 'new_unverified' && (
              <div style={{ background: 'var(--info-bg)', color: 'var(--info-text)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '0.875rem', fontWeight: 500 }}>
                {det.unreviewed_label}
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {det.sensor_origin_label}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '10px', fontSize: '0.875rem' }}>
              <div><strong>Sector:</strong> {det.grid_block_id}</div>
              <div><strong>{STRINGS.en.confidenceUncalibrated}</strong> {Math.round(det.confidence * 100)}% (uncalibrated)</div>
              <div><strong>{STRINGS.en.uncertaintyMeters}</strong> ±{det.uncertainty_meters}m</div>
              <div><strong>Lat/Lng:</strong> {det.lat.toFixed(4)}, {det.lng.toFixed(4)}</div>
            </div>

            {/* Evidence preview — locked until review started */}
            <div style={{ background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '0.85rem' }}>
              {det.is_locked
                ? `🔒 ${STRINGS.en.lockedEvidence}`
                : `📁 Evidence unlocked: ${det.evidence_preview}`}
            </div>

            {/* Corroborating observation note */}
            {det.corroborating_detection_id && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Linked corroborating observation: {det.corroborating_detection_id}. {STRINGS.en.noFusionClaim}
              </div>
            )}

            {/* Limitations notice */}
            <div className="limitations-box">{det.limitations_note}</div>

            {/* Reviewer notes if any */}
            {det.review_notes && (
              <div style={{ marginTop: '8px', fontSize: '0.85rem', padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <strong>Reviewer note:</strong> {det.review_notes}
              </div>
            )}

            {/* Action buttons */}
            {det.status !== 'false_positive' && det.status !== 'linked_to_existing_incident' && (
              <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {det.status === 'new_unverified' && canStart && (
                  <button type="button" className="btn-secondary" style={{ fontSize: '0.875rem', minHeight: '38px', padding: '0 14px' }}
                    onClick={() => doAction(det.id, 'start')} disabled={isWorking}>
                    {STRINGS.en.startReview}
                  </button>
                )}
                {(det.status === 'under_human_review' || det.status === 'new_unverified') && canStart && (
                  <button type="button" className="btn-secondary" style={{ fontSize: '0.875rem', minHeight: '38px', padding: '0 14px' }}
                    onClick={() => doAction(det.id, 'false_positive')} disabled={isWorking}>
                    {STRINGS.en.markFalsePositive}
                  </button>
                )}
                {canStart && (
                  <button type="button" className="btn-secondary" style={{ fontSize: '0.875rem', minHeight: '38px', padding: '0 14px' }}
                    onClick={() => doAction(det.id, 'rescan')} disabled={isWorking}>
                    {STRINGS.en.requestRescan}
                  </button>
                )}
                {det.status === 'under_human_review' && canConfirm && (
                  <button type="button" className="btn-primary" style={{ fontSize: '0.875rem', minHeight: '38px', padding: '0 14px' }}
                    onClick={() => setSelected(det)} disabled={isWorking}>
                    {STRINGS.en.corroborateConfirm}
                  </button>
                )}
                {det.status === 'possible_person_confirmed' && canConfirm && (
                  <button type="button" className="btn-primary" style={{ fontSize: '0.875rem', minHeight: '38px', padding: '0 14px', background: '#7c3aed' }}
                    onClick={() => doAction(det.id, 'create_incident')} disabled={isWorking}>
                    {STRINGS.en.createIncidentAction}
                  </button>
                )}
                {!canConfirm && det.status === 'under_human_review' && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                    ⛔ Confirm / Create Incident: Dispatcher or Admin only
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {detections.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No detections in queue. Run a drone survey to generate simulated sensor anomalies.
          </div>
        )}
      </div>

      {/* Confirm dialog for corroborate + notes */}
      {selected && (
        <div className="modal-backdrop">
          <div className="modal-content" role="dialog" aria-modal="true">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '12px' }}>
              Confirm Possible Person — {selected.id}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Confirming marks this detection as a possible person requiring follow-up. It does <strong>not</strong> dispatch any team — that is a separate step.
            </p>

            <div className="form-group">
              <label className="form-label">Corroborating observation ID (optional):</label>
              <input type="text" className="form-input" placeholder="e.g. DET-002"
                value={corrobId} onChange={e => setCorrobId(e.target.value)} />
              {corrobId && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{STRINGS.en.noFusionClaim}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Reviewer Notes:</label>
              <textarea className="form-textarea" rows="3"
                placeholder="Describe what was observed and the basis for confirmation…"
                value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={isWorking}
                onClick={() => doAction(selected.id, 'confirm', { corroborating_detection_id: corrobId || undefined })}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
