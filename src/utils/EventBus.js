// Simple in-memory event bus to coordinate UI updates across screens
// Usage:
//  import EventBus from '../utils/EventBus';
//  EventBus.on('balance:updated', (data) => { ... });
//  EventBus.emit('balance:updated', { accountId, newBalance });

class EventBusImpl {
  constructor() {
    this.listeners = {};
  }

  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  off(eventName, callback) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
  }

  emit(eventName, payload) {
    const cbs = this.listeners[eventName] || [];
    cbs.forEach(cb => {
      try { cb(payload); } catch (e) { /* no-op */ }
    });
  }
}

const EventBus = new EventBusImpl();
export default EventBus;


