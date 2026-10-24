import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, LayerGroup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default icon in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CENTER = [28.6145, 77.2090];

function blocksToGeoJSON(blocks) {
  return {
    type: 'FeatureCollection',
    features: blocks.map(b => ({
      type: 'Feature',
      properties: { code: b.code, name: b.name, risk_level: b.risk_level },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [b.bounds.west, b.bounds.north],
          [b.bounds.east, b.bounds.north],
          [b.bounds.east, b.bounds.south],
          [b.bounds.west, b.bounds.south],
          [b.bounds.west, b.bounds.north],
        ]],
      },
    })),
  };
}

function blockStyle(feature) {
  const risk = feature.properties.risk_level;
  const colors = { high: '#f87171', caution: '#fbbf24', normal: '#6ee7b7' };
  return {
    color: '#475569',
    weight: 1.5,
    fillColor: colors[risk] || '#6ee7b7',
    fillOpacity: 0.18,
  };
}

function incidentIcon(inc) {
  const isHigh = inc.urgency === 'critical' || inc.urgency === 'high';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${isHigh ? '#6366f1' : '#0d9488'};
      color:#fff;
      border-radius:50%;
      width:28px;height:28px;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;
      border:2px solid rgba(255,255,255,0.8);
      box-shadow:0 1px 4px rgba(0,0,0,0.3);" title="${inc.id}">!</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function shelterIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#059669;color:#fff;border-radius:4px;
      width:26px;height:26px;display:flex;align-items:center;
      justify-content:center;font-size:13px;font-weight:700;
      border:2px solid rgba(255,255,255,0.8);box-shadow:0 1px 4px rgba(0,0,0,0.3);" 
      title="Shelter (Simulated)">🏠</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function SectorMap({ blocks, incidents, shelters, showShelters, showIncidents }) {
  const geoData = blocksToGeoJSON(blocks);

  return (
    <div style={{ height: '520px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {blocks.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
          Loading sector map…
        </div>
      ) : (
        <MapContainer center={CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
          {/* Online tiles — fail gracefully */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© OpenStreetMap contributors'
            errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          />

          {/* Grid blocks */}
          {blocks.length > 0 && (
            <GeoJSON
              data={geoData}
              style={blockStyle}
              onEachFeature={(feature, layer) => {
                layer.bindTooltip(`Sector ${feature.properties.code} · ${feature.properties.risk_level} risk`, { permanent: false });
              }}
            />
          )}

          {/* Incidents */}
          {showIncidents && incidents
            .filter(i => i.workflow_state !== 'resolved' && i.workflow_state !== 'cancelled')
            .map(inc => {
              // Place at approximate block center
              const block = blocks.find(b => b.code === inc.grid_block_id);
              if (!block) return null;
              const lat = (block.bounds.north + block.bounds.south) / 2 + (Math.random() - 0.5) * 0.002;
              const lng = (block.bounds.east + block.bounds.west) / 2 + (Math.random() - 0.5) * 0.002;
              return (
                <Marker key={inc.id} position={[lat, lng]} icon={incidentIcon(inc)}>
                  <Popup>
                    <strong>{inc.id}</strong><br />
                    {inc.category}<br />
                    Sector {inc.grid_block_id} · {inc.workflow_state}
                  </Popup>
                </Marker>
              );
            })}

          {/* Shelters */}
          {showShelters && shelters.map(sh => (
            <Marker key={sh.id} position={[sh.lat, sh.lng]} icon={shelterIcon()}>
              <Popup>
                <strong>{sh.name}</strong><br />
                <em>(Simulated)</em><br />
                Capacity: {sh.occupancy}/{sh.capacity}<br />
                Status: {sh.status}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', padding: '10px 4px', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>🟢 Normal risk</span>
        <span>🟡 Caution</span>
        <span>🔴 High risk</span>
        {showIncidents && <span style={{ color: 'var(--accent)' }}>● Active incident</span>}
        {showShelters && <span style={{ color: '#059669' }}>🏠 Shelter (Simulated)</span>}
      </div>
    </div>
  );
}
