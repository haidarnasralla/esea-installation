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
    // Installation runs from Tuesday 25 Aug 5pm to Saturday 29 Aug 5pm
    // Total duration: 96 hours (4 full days)
    startTime: '2026-08-25T17:00:00+01:00',  // Tuesday 5pm BST
    endTime: '2026-08-29T17:00:00+01:00',    // Saturday 5pm BST
    
    totalSteps: 20,
    syncInterval: 60000, // recalculate step every 60 seconds
  },
};
