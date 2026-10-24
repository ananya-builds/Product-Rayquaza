import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header.jsx';
import CitizenView from './components/CitizenView.jsx';
import OperatorOverview from './components/OperatorOverview.jsx';
import OperatorQueue from './components/OperatorQueue.jsx';
import SectorMap from './components/SectorMap.jsx';
import DetectionReview from './components/DetectionReview.jsx';
import DroneMeshView from './components/DroneMeshView.jsx';
import AuditLog from './components/AuditLog.jsx';
import DemoPanel from './components/DemoPanel.jsx';
import { api } from './api.js';
import { STRINGS } from './strings.js';
import { getPendingRequests, updateLocalRequest } from './db.js';
import './index.css';

const POLL_INTERVAL = 5000;

export default function App() {
  const [mode, setMode] = useState('Disaster'); // Everyday | Disaster
  const [role, setRole] = useState('Citizen');
  const [activeTab, setActiveTab] = useState('overview');
  const [networkMode, setNetworkMode] = useState('Normal');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Operator data
  const [incidents, setIncidents] = useState([]);
  const [reports, setReports] = useState([]);
  const [teams, setTeams] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [drones, setDrones] = useState([]);
  const [meshLinks, setMeshLinks] = useState([]);
  const [detections, setDetections] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');

  // Map layer toggles
  const [showShelters, setShowShelters] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);

  const pollRef = useRef(null);

  // ── Browser online/offline listener ────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Fetch all server state ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [
        incs, reps, tms, gbs, shels, drs, mls, dets, auds, demoState
      ] = await Promise.all([
        api.getIncidents(role).catch(() => []),
        api.getReports(role).catch(() => []),
        api.getTeams(role).catch(() => []),
        api.getGridBlocks(role).catch(() => []),
        api.getShelters(role).catch(() => []),
        api.getDrones(role).catch(() => []),
        api.getMeshLinks(role).catch(() => []),
        api.getDetections(role).catch(() => []),
        api.getAuditEvents(role).catch(() => []),
        api.getDemoState(role).catch(() => null),
      ]);
      setIncidents(incs);
      setReports(reps);
      setTeams(tms);
      setBlocks(gbs);
      setShelters(shels);
      setDrones(drs);
      setMeshLinks(mls);
      setDetections(dets);
      setAuditEvents(auds);
      if (demoState?.network_mode) setNetworkMode(demoState.network_mode);
    } catch (_) {}

    // Count local pending requests
    try {
      const pending = await getPendingRequests();
      setPendingSyncCount(pending.length);
    } catch (_) {}
  }, [role]);

  // ── Poll every 5 seconds ───────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchAll]);

  // ── Offline sync attempt ───────────────────────────────────────────────────
  const handleSyncNow = async () => {
    setSyncError('');
    setSyncSuccess('');
    if (!isOnline || networkMode !== 'Normal') {
      setSyncError(
        networkMode !== 'Normal'
          ? `Sync disabled: network mode is "${networkMode}". Switch to Normal to enable sync.`
          : 'Device is offline. Requests will sync automatically when connection is restored.'
      );
      return;
    }
    try {
      const pending = await getPendingRequests();
      if (pending.length === 0) {
        setSyncSuccess('All requests already synced.');
        return;
      }
      const payload = pending.map(r => ({
        client_request_id: r.clientRequestId,
        incident_mode: r.incidentMode,
        category: r.category,
        grid_block_id: r.gridBlockId || 'B4',
        location_landmark: r.locationLandmark,
        people_count: r.peopleCount,
        notes: r.notes,
        transport_state: 'server_received',
        workflow_state: 'awaiting_dispatcher',
      }));
      const res = await api.syncBatch(payload, role);
      // Mark synced in IndexedDB
      for (const synced of res.incidents) {
        if (synced.client_request_id) {
          await updateLocalRequest(synced.client_request_id, {
            transportState: 'server_received',
            syncedServerId: synced.id,
          });
        }
      }
      setSyncSuccess(`Synced ${res.synced_count} request(s) to server.`);
      setPendingSyncCount(0);
      fetchAll();
    } catch (err) {
      setSyncError(err.message || 'Sync failed.');
    }
  };

  // ── Network mode change ────────────────────────────────────────────────────
  const handleNetworkChange = async (newMode) => {
    await api.setNetworkMode(newMode, role);
    setNetworkMode(newMode);
  };

  // ── Demo reset ─────────────────────────────────────────────────────────────
  const handleReset = async () => {
    await api.resetDemo(role);
    setSelectedIncident(null);
    await fetchAll();
  };

  // ── Mode switch keeps state ────────────────────────────────────────────────
  const handleModeChange = (newMode) => {
    setMode(newMode);
    // Switching to citizen-appropriate tab
    if (newMode === 'Everyday' && (activeTab === 'drones' || activeTab === 'detections')) {
      setActiveTab('request');
    }
  };

  const isOperator = role !== 'Citizen';

  // ── Tab definitions ────────────────────────────────────────────────────────
  const tabs = [
    { id: 'request', label: '📋 Request Help', show: true },
    { id: 'overview', label: '📊 Overview', show: isOperator },
    { id: 'queue', label: '⚡ Queue', show: isOperator },
    { id: 'map', label: '🗺 Sector Map', show: isOperator },
    ...(mode === 'Disaster' && isOperator
      ? [
          { id: 'drones', label: '🚁 Drone & Mesh', show: true },
          { id: 'detections', label: '🔍 Detection Review', show: true },
        ]
      : []),
    { id: 'audit', label: '📜 Audit Trail', show: isOperator },
  ].filter(t => t.show);

  // Auto-switch to request tab for citizens
  useEffect(() => {
    if (!isOperator) setActiveTab('request');
    else if (activeTab === 'request') setActiveTab('overview');
  }, [isOperator]);

  return (
    <div className="app-container" data-mode={mode === 'Disaster' ? 'disaster' : undefined}>
      {/* Aria live region for status updates */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', left: '-9999px' }}>
        {syncSuccess || syncError}
      </div>

      <Header
        mode={mode}
        onModeChange={handleModeChange}
        role={role}
        onRoleChange={setRole}
        networkMode={networkMode}
      />

      <main className="main-content" id="main-content">
        {/* Demo Admin Panel (visible to Admin) */}
        {role === 'Admin' && (
          <DemoPanel
            networkMode={networkMode}
            onNetworkChange={handleNetworkChange}
            onReset={handleReset}
            role={role}
          />
        )}

        {/* Offline/network warnings */}
        {(!isOnline || networkMode !== 'Normal') && (
          <div className="status-banner" role="status" style={{ marginBottom: '16px', background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 'var(--radius-md)' }}>
            <span className="status-icon" aria-hidden="true">⚡</span>
            <div>
              <strong>
                {!isOnline ? 'Device offline' : `Simulated: ${networkMode}`}
              </strong>
              <div style={{ fontSize: '0.875rem', marginTop: '2px' }}>
                {!isOnline
                  ? 'Your requests are saved on this device and will sync automatically when connectivity returns.'
                  : networkMode === 'Internet Outage'
                    ? 'Internet path blocked. New requests save locally. Relay path may be active.'
                    : networkMode === 'Relay-Only'
                      ? 'Direct internet unavailable. Mesh relay mode active.'
                      : 'All network paths simulated as lost. Requests save locally only.'}
              </div>
            </div>
          </div>
        )}

        {/* Sync status */}
        {syncSuccess && (
          <div role="status" aria-live="polite" className="status-banner" style={{ background: 'var(--success-bg)', color: 'var(--success-text)', marginBottom: '14px', borderRadius: 'var(--radius-md)' }}>
            ✓ {syncSuccess}
          </div>
        )}
        {syncError && (
          <div role="alert" className="status-banner" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', marginBottom: '14px', borderRadius: 'var(--radius-md)' }}>
            ⚠ {syncError}
          </div>
        )}

        {/* Sync Now + Pending Count */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary"
            style={{ minHeight: '40px', padding: '0 16px', fontSize: '0.88rem' }}
            onClick={handleSyncNow}>
            🔄 Sync Now {pendingSyncCount > 0 ? `(${pendingSyncCount} pending)` : ''}
          </button>
          {pendingSyncCount > 0 && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {pendingSyncCount} request(s) saved locally, not yet transmitted
            </span>
          )}
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <nav className="tabs-nav" aria-label="Application sections">
            {tabs.map(t => (
              <button key={t.id} type="button"
                className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
                aria-current={activeTab === t.id ? 'page' : undefined}>
                {t.label}
              </button>
            ))}
          </nav>
        )}

        {/* Tab Panels */}
        {activeTab === 'request' && (
          <CitizenView
            mode={mode}
            networkMode={networkMode}
            role={role}
            onSyncTriggered={fetchAll}
          />
        )}

        {activeTab === 'overview' && isOperator && (
          <OperatorOverview
            incidents={incidents}
            teams={teams}
            pendingSyncCount={pendingSyncCount}
            onSelectIncident={inc => { setSelectedIncident(inc); setActiveTab('queue'); }}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'queue' && isOperator && (
          <OperatorQueue
            incidents={incidents}
            teams={teams}
            reports={reports}
            role={role}
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
            onCloseDrawer={() => setSelectedIncident(null)}
            onRefresh={fetchAll}
          />
        )}

        {activeTab === 'map' && isOperator && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={showIncidents} onChange={e => setShowIncidents(e.target.checked)} />
                Show incidents
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={showShelters} onChange={e => setShowShelters(e.target.checked)} />
                Show shelters (Simulated)
              </label>
            </div>
            <SectorMap
              blocks={blocks}
              incidents={incidents}
              shelters={shelters}
              showShelters={showShelters}
              showIncidents={showIncidents}
            />
          </div>
        )}

        {activeTab === 'drones' && isOperator && mode === 'Disaster' && (
          <DroneMeshView
            drones={drones}
            meshLinks={meshLinks}
            role={role}
            onRefresh={fetchAll}
          />
        )}

        {activeTab === 'detections' && isOperator && mode === 'Disaster' && (
          <DetectionReview
            detections={detections}
            role={role}
            onRefresh={fetchAll}
          />
        )}

        {activeTab === 'audit' && isOperator && (
          <AuditLog auditEvents={auditEvents} />
        )}
      </main>

      <footer className="app-footer" role="contentinfo">
        <strong>⚠ {STRINGS.en.footerNotice}</strong>
      </footer>
    </div>
  );
}
