import * as eventsRepo from '../repositories/events.repository.js';

export async function createEvent(payload: any) {
  return eventsRepo.createEvent(payload);
}

export async function listEvents(limit?: number) {
  return eventsRepo.listEvents(limit ?? 1000);
}

export async function getEvent(id: number) {
  return eventsRepo.getEventById(id);
}

export async function updateEvent(id: number, payload: any) {
  return eventsRepo.updateEvent(id, payload);
}

export async function deleteEvent(id: number) {
  return eventsRepo.deleteEvent(id);
}
