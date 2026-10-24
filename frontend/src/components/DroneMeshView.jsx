import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api';

const CENTER = [28.6145, 77.2090];

const MESH_COLORS = { connected: '#10b981', weak: '#f59e0b', disconnected: '#6b7280' };

function droneIcon(drone) {
  const statusColor = drone.status === 'survey_active' ? '#6366f1' : drone.status === 'patrolling' ? '#0d9488' : '#94a3b8';
  return L.divIcon({
    className: '',
    html: `<div title="${drone.name} (Simulated)" style="
      background:${statusColor};color:#fff;border-radius:6px;
      width:32px;height:32px;display:flex;align-items:center;
      justify-content:center;font-size:16px;
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(0,0,0,0.4);">🚁</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export default function DroneMeshView({ drones, meshLinks, role, onRefresh }) {
  const [surveying, setSurveying] = useState(false);
  const [surveyMsg, setSurveyMsg] = useState('');
  const [surveyErr, setSurveyErr] = useState('');

  const handleRunSurvey = async () => {
    setSurveying(true);
    setSurveyMsg('');
    setSurveyErr('');
    try {
      const res = await api.runDroneSurvey(role);
      setSurveyMsg(res.message || 'Survey complete. Check Detection Review for new anomalies.');
      onRefresh();
    } catch (err) {
      setSurveyErr(err.message || 'Survey request failed.');
    } finally {
      setSurveying(false);
    }
  };

  // Build drone lat/lng lookup for mesh lines
  const dronePositions = {};
  drones.forEach(d => { dronePositions[d.id] = [d.lat, d.lng]; });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Drone &amp; Mesh Network</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            All drones, mesh relays, and coverage data are <strong>simulated</strong>. No real flight commands are sent.
          </p>
        </div>
        <button type="button" className="btn-primary" style={{ minHeight: '44px', padding: '0 18px' }}
          onClick={handleRunSurvey} disabled={surveying}>
          {surveying ? 'Running Survey…' : '🚁 ' + 'Run Drone Survey (Simulated)'}
        </button>
      </div>

      {surveyMsg && (
        <div role="status" aria-live="polite" className="status-banner" style={{ background: 'var(--success-bg)', color: 'var(--success-text)', marginBottom: '14px' }}>
          ✓ {surveyMsg}
        </div>
      )}
      {surveyErr && (
        <div role="alert" className="status-banner" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', marginBottom: '14px' }}>
          ⚠ {surveyErr}
        </div>
      )}

      {/* Drone Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {drones.map(d => (
          <div key={d.id} className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d.id}</span>
              <span className="badge-sim" style={{ fontSize: '0.72rem' }}>Simulated</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{d.name}</div>
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', fontSize: '0.82rem' }}>
              <span>🔋 {d.battery_pct}%</span>
              <span>📍 Sector {d.current_block}</span>
            </div>
            <div style={{ marginTop: '4px' }}>
              <span className="badge-sim" style={{
                background: d.status === 'survey_active' ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                color: d.status === 'survey_active' ? 'var(--accent-text)' : 'var(--text-muted)',
                fontSize: '0.78rem'
              }}>
                {d.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Mesh Link Status */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>{`Relay Mesh Connectivity (Simulated)`}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {meshLinks.map(link => (
            <div key={link.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px', background: 'var(--bg-card)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem'
            }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: MESH_COLORS[link.status] || '#94a3b8', flexShrink: 0 }}></span>
              <span style={{ fontWeight: 600, minWidth: '80px' }}>{link.source_node}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span style={{ fontWeight: 600 }}>{link.target_node}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{link.signal_quality_dbm} dBm</span>
              <span className="badge-sim" style={{
                background: link.status === 'connected' ? 'var(--success-bg)' : link.status === 'weak' ? 'var(--warning-bg)' : 'var(--neutral-badge)',
                color: link.status === 'connected' ? 'var(--success-text)' : link.status === 'weak' ? 'var(--warning-text)' : 'var(--text-muted)',
              }}>
                {link.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Drone Map */}
      <div style={{ height: '400px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <MapContainer center={CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
            errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          />

          {/* Drone markers */}
          {drones.map(d => (
            <Marker key={d.id} position={[d.lat, d.lng]} icon={droneIcon(d)}>
              <Popup>
                <strong>{d.name}</strong> (Simulated)<br />
                Status: {d.status}<br />
                Battery: {d.battery_pct}%<br />
                Sector: {d.current_block}
              </Popup>
            </Marker>
          ))}

          {/* Coverage circles (labelled simulated) */}
          {drones.map(d => (
            <Circle key={`cov-${d.id}`} center={[d.lat, d.lng]} radius={350}
              pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.08, dashArray: '5 5', weight: 1 }}>
              <Popup>Coverage radius — Simulated, not accurate</Popup>
            </Circle>
          ))}

          {/* Mesh link lines */}
          {meshLinks.map(link => {
            const from = dronePositions[link.source_node];
            const to = dronePositions[link.target_node];
            if (!from || !to) return null;
            return (
              <Polyline key={link.id} positions={[from, to]}
                pathOptions={{ color: MESH_COLORS[link.status] || '#94a3b8', weight: 2, dashArray: link.status === 'weak' ? '6 4' : undefined }} />
            );
          })}
        </MapContainer>
      </div>

      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
        Coverage circles, drone positions, and mesh links are simulated for demonstration only. No real flight operations are represented.
      </div>
    </div>
  );
}
