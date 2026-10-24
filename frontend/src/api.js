/**
 * RESQNET Central API client.
 * Injects X-Demo-Role header, provides polling helpers, and sync management.
 */

export const API_BASE = '/api';

export async function fetchWithRole(endpoint, role = 'Citizen', options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Demo-Role': role,
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch (_) {}
    const err = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }

  return await response.json();
}

export const api = {
  getIncidents: (role, mode) => fetchWithRole(`/incidents${mode ? `?mode=${mode}` : ''}`, role),
  getIncident: (id, role) => fetchWithRole(`/incidents/${id}`, role),
  updateIncident: (id, data, role) => fetchWithRole(`/incidents/${id}`, role, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  assignTeam: (incidentId, teamId, role) => fetchWithRole(`/incidents/${incidentId}/assignments`, role, {
    method: 'POST',
    body: JSON.stringify({ team_id: teamId }),
  }),
  linkReport: (incidentId, reportId, role) => fetchWithRole(`/incidents/${incidentId}/link-report`, role, {
    method: 'POST',
    body: JSON.stringify({ report_id: reportId }),
  }),

  logCall: (data, role) => fetchWithRole('/reports', role, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getReports: (role) => fetchWithRole('/reports', role),

  getDetections: (role) => fetchWithRole('/detections', role),
  reviewDetection: (id, data, role) => fetchWithRole(`/detections/${id}/review`, role, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getGridBlocks: (role) => fetchWithRole('/grid-blocks', role),
  getDrones: (role) => fetchWithRole('/drones', role),
  getMeshLinks: (role) => fetchWithRole('/mesh-links', role),
  getTeams: (role) => fetchWithRole('/teams', role),
  getShelters: (role) => fetchWithRole('/shelters', role),
  getAuditEvents: (role) => fetchWithRole('/audit-events', role),

  getDemoState: (role) => fetchWithRole('/demo/state', role),
  setNetworkMode: (mode, role) => fetchWithRole('/demo/network', role, {
    method: 'POST',
    body: JSON.stringify({ network_mode: mode }),
  }),
  runDroneSurvey: (role) => fetchWithRole('/demo/survey', role, {
    method: 'POST',
  }),
  resetDemo: (role) => fetchWithRole('/demo/reset', role, {
    method: 'POST',
  }),

  syncBatch: (incidents, role) => fetchWithRole('/sync/batch', role, {
    method: 'POST',
    body: JSON.stringify({ incidents }),
  }),

  structureCallAI: (callNotes, role) => fetchWithRole('/ai/structure-call', role, {
    method: 'POST',
    body: JSON.stringify({ call_notes: callNotes }),
  }),
};
