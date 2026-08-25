/**
 * Installation Configuration
 * 
 * MODE:
 * - 'test': Manual stepping via dashboard button
 * - 'production': Time-based auto-stepping (dashboard hidden)
 */

export default {
  MODE: 'test', // ← change to 'production' for installation
  
  // Production timing (only used when MODE === 'production')
  INSTALLATION: {
    startTime: '2026-09-01T09:00:00',  // Tuesday 9am
    endTime: '2026-09-05T18:00:00',    // Saturday 6pm
    totalSteps: 20,
    syncInterval: 60000, // recalculate step every 60 seconds
  },
};
