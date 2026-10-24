import React, { useState, useEffect } from 'react';
import { STRINGS } from '../strings';
import { saveLocalRequest, getLocalRequests } from '../db';
import { api } from '../api';

export default function CitizenView({
  mode,
  networkMode,
  role,
  onSyncTriggered,
}) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [locationLandmark, setLocationLandmark] = useState('');
  const [gridBlockId, setGridBlockId] = useState('B4');
  const [peopleCount, setPeopleCount] = useState('1');
  const [notes, setNotes] = useState('');
  const [localRequests, setLocalRequests] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSubmittedId, setJustSubmittedId] = useState(null);

  const categories = mode === 'Everyday'
    ? STRINGS.en.everydayCategories
    : STRINGS.en.disasterCategories;

  useEffect(() => {
    loadLocalRequests();
  }, []);

  const loadLocalRequests = async () => {
    try {
      const reqs = await getLocalRequests();
      setLocalRequests(reqs);
    } catch (_) {}
  };

  const handleSimulateGPS = () => {
    setGridBlockId('B4');
    setLocationLandmark('Near Sector B4 Community Center (Simulated GPS)');
  };

  const handleNextStep = () => {
    if (step === 1 && !category) return;
    if (step === 2 && !locationLandmark) return;
    setStep(prev => prev + 1);
  };

  const handleSendRequest = async () => {
    setIsSubmitting(true);
    const newReq = {
      category,
      gridBlockId,
      locationLandmark,
      peopleCount,
      notes,
      incidentMode: mode,
    };

    // 1. Always save to local IndexedDB first
    const saved = await saveLocalRequest(newReq);
    setJustSubmittedId(saved.clientRequestId);

    // 2. If network is Normal and browser is online, attempt immediate sync
    if (networkMode === 'Normal' && navigator.onLine) {
      try {
        await api.syncBatch([
          {
            client_request_id: saved.clientRequestId,
            incident_mode: saved.incidentMode,
            category: saved.category,
            grid_block_id: saved.gridBlockId,
            location_landmark: saved.locationLandmark,
            people_count: saved.peopleCount,
            notes: saved.notes,
            transport_state: 'server_received',
            workflow_state: 'awaiting_dispatcher',
          }
        ], role);
        if (onSyncTriggered) onSyncTriggered();
      } catch (err) {
        // If 503 or error, it remains saved_locally in IndexedDB
      }
    }

    await loadLocalRequests();
    setIsSubmitting(false);
    setStep(5); // Show status confirmation
  };

  const resetForm = () => {
    setStep(1);
    setCategory('');
    setLocationLandmark('');
    setPeopleCount('1');
    setNotes('');
    setJustSubmittedId(null);
  };

  const renderStatusCard = (req) => {
    let statusText = STRINGS.en.savedLocally;
    let detailText = STRINGS.en.savedLocallyDesc;
    let icon = '💾';

    if (req.transportState === 'relay_received') {
      statusText = STRINGS.en.relayReceived;
      detailText = STRINGS.en.relayReceivedDesc;
      icon = '📡';
    } else if (req.transportState === 'server_received') {
      icon = '🏢';
      if (req.workflowState === 'awaiting_dispatcher') {
        statusText = STRINGS.en.deliveredToSystem;
        detailText = STRINGS.en.deliveredToSystemDesc;
      } else if (req.workflowState === 'under_review' || req.workflowState === 'dispatcher_acknowledged') {
        statusText = STRINGS.en.underReview;
        detailText = 'A dispatcher is currently evaluating sector details.';
      } else if (req.workflowState === 'assigned') {
        statusText = STRINGS.en.assignedToTeam;
        detailText = 'Allocated to an emergency response team.';
      } else if (req.workflowState === 'responder_accepted') {
        statusText = STRINGS.en.responderAccepted;
        detailText = 'A response team has acknowledged and accepted this dispatch.';
      } else if (req.workflowState === 'in_progress') {
        statusText = STRINGS.en.inProgress;
        detailText = 'Responders are actively operating at the location.';
      } else if (req.workflowState === 'resolved') {
        statusText = STRINGS.en.resolved;
        detailText = 'Assistance operation completed.';
        icon = '✓';
      }
    }

    return (
      <div key={req.clientRequestId} className="status-banner" role="status" aria-live="polite">
        <span className="status-icon" aria-hidden="true">{icon}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{statusText}</div>
          <div style={{ fontSize: '0.9rem', marginTop: '4px', opacity: 0.9 }}>{detailText}</div>
          <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--text-muted)' }}>
            Category: {req.category} · Sector: {req.gridBlockId} · People: {req.peopleCount} · Time: {new Date(req.createdAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="citizen-flow">
      {/* 4-Step Wizard */}
      {step <= 4 && (
        <section className="citizen-wizard-card" aria-label="Emergency Request Form">
          <div className="wizard-step-indicator">
            Step {step} of 4 · {mode} Mode
          </div>

          {step === 1 && (
            <div>
              <h2 className="wizard-question">{STRINGS.en.step1Title}</h2>
              <div className="choice-list" role="radiogroup" aria-label="Category choices">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`choice-btn ${category === c.id ? 'selected' : ''}`}
                    onClick={() => setCategory(c.id)}
                    role="radio"
                    aria-checked={category === c.id}
                  >
                    <span>{c.label}</span>
                    <span className="choice-desc">{c.desc}</span>
                  </button>
                ))}
              </div>
              <div className="wizard-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleNextStep}
                  disabled={!category}
                >
                  {STRINGS.en.nextButton}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="wizard-question">{STRINGS.en.step2Title}</h2>
              <div style={{ marginBottom: '20px' }}>
                <button
                  type="button"
                  className="choice-btn"
                  onClick={handleSimulateGPS}
                  style={{ width: '100%', marginBottom: '16px' }}
                >
                  <span>📍 {STRINGS.en.useMyLocation}</span>
                  <span className="choice-desc">Sets sector to Sector B4 (Simulated GPS sensor)</span>
                </button>

                <div className="form-group">
                  <label htmlFor="landmark-input" className="form-label">{STRINGS.en.orTypeLandmark}</label>
                  <input
                    id="landmark-input"
                    type="text"
                    className="form-input"
                    placeholder={STRINGS.en.landmarkPlaceholder}
                    value={locationLandmark}
                    onChange={(e) => setLocationLandmark(e.target.value)}
                  />
                </div>
              </div>
              <div className="wizard-actions">
                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                  {STRINGS.en.backButton}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleNextStep}
                  disabled={!locationLandmark.trim()}
                >
                  {STRINGS.en.nextButton}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="wizard-question">{STRINGS.en.step3Title}</h2>
              <div className="choice-list" role="radiogroup">
                {STRINGS.en.peopleChoices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={`choice-btn ${peopleCount === choice ? 'selected' : ''}`}
                    onClick={() => setPeopleCount(choice)}
                    role="radio"
                    aria-checked={peopleCount === choice}
                  >
                    <span>{choice}</span>
                  </button>
                ))}
              </div>
              <div className="wizard-actions">
                <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                  {STRINGS.en.backButton}
                </button>
                <button type="button" className="btn-primary" onClick={handleNextStep}>
                  {STRINGS.en.nextButton}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="wizard-question">{STRINGS.en.step4Title}</h2>
              <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                <p><strong>Category:</strong> {category}</p>
                <p><strong>Location:</strong> {locationLandmark}</p>
                <p><strong>People needing help:</strong> {peopleCount}</p>
              </div>

              <div className="form-group">
                <label htmlFor="notes-input" className="form-label">{STRINGS.en.notesLabel}</label>
                <textarea
                  id="notes-input"
                  className="form-textarea"
                  rows="3"
                  placeholder={STRINGS.en.notesPlaceholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>

              <div className="wizard-actions">
                <button type="button" className="btn-secondary" onClick={() => setStep(3)}>
                  {STRINGS.en.backButton}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSendRequest}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording...' : STRINGS.en.sendButton}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Post-submission Status Screen */}
      {step === 5 && (
        <section className="citizen-wizard-card" aria-label="Request Status Confirmation">
          <h2 className="wizard-question">Request Status</h2>
          {localRequests.filter(r => r.clientRequestId === justSubmittedId).map(renderStatusCard)}
          <button type="button" className="btn-primary" onClick={resetForm} style={{ marginTop: '16px' }}>
            Submit Another Request
          </button>
        </section>
      )}

      {/* Your Requests List */}
      <section style={{ maxWidth: '600px', margin: '30px auto' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '14px' }}>
          {STRINGS.en.yourRequests} ({localRequests.length})
        </h3>
        {localRequests.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{STRINGS.en.noRequests}</p>
        ) : (
          localRequests.map(renderStatusCard)
        )}
      </section>
    </div>
  );
}
