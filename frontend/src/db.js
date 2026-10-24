/**
 * Local IndexedDB database using Dexie for offline-first resilience.
 */
import Dexie from 'dexie';

export const db = new Dexie('ResqnetDB');

db.version(1).stores({
  requests: 'clientRequestId, category, transportState, workflowState, createdAt, incidentMode, syncedServerId',
});

export async function saveLocalRequest(data) {
  const record = {
    clientRequestId: data.clientRequestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    category: data.category,
    gridBlockId: data.gridBlockId || 'B4',
    locationLandmark: data.locationLandmark || '',
    peopleCount: data.peopleCount || '1',
    notes: data.notes || '',
    urgency: data.urgency || 'standard',
    transportState: 'saved_locally',
    workflowState: 'awaiting_dispatcher',
    incidentMode: data.incidentMode || 'Disaster',
    createdAt: data.createdAt || new Date().toISOString(),
    syncedServerId: null,
  };
  await db.requests.put(record);
  return record;
}

export async function getLocalRequests() {
  return await db.requests.orderBy('createdAt').reverse().toArray();
}

export async function getPendingRequests() {
  return await db.requests
    .filter(req => req.transportState === 'saved_locally' || req.transportState === 'pending_transmission')
    .toArray();
}

export async function updateLocalRequest(clientRequestId, updates) {
  await db.requests.update(clientRequestId, updates);
}

export async function clearLocalRequests() {
  await db.requests.clear();
}
