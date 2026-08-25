/**
 * Installation Configuration
 * 
 * MODE:
 * - 'test': Manual stepping via dashboard button
 * - 'production': Time-based auto-stepping (dashboard hidden)
 */

export default {
  MODE: 'test', // ← change to 'production' for installation
  
  // TTS Engine Selection
  // - 'hybrid': LPC voices (Daniel/Samantha/Whisper) with SAM fallback (default)
  // - 'sam': SAM only (Software Automatic Mouth, 1982 C64 synth)
  // - 'lpc': LPC only (TMS5100/Speak&Spell style, limited vocab)
  TTS_ENGINE: 'hybrid',
  
  // Production timing (only used when MODE === 'production')
  INSTALLATION: {
    // Installation runs Tuesday 25 Aug to Saturday 29 Aug 2026
    startDate: '2026-08-25',
    endDate: '2026-08-29',
    
    // Gallery hours (degradation only progresses during these hours)
    openHour: 10,  // 10am
    closeHour: 17, // 5pm (7 hours per day, 35 hours total)
    
    totalSteps: 20,
    syncInterval: 60000, // recalculate step every 60 seconds
  },
};
