/**
 * Text-to-Speech module
 */

let voices = [];

/**
 * Load available English voices
 */
export function loadVoices() {
  const allVoices = speechSynthesis.getVoices();
  voices = allVoices.filter(v => v.lang.startsWith('en'));
  console.log(`Loaded ${voices.length} English TTS voices (of ${allVoices.length} total)`);
}

/**
 * Initialize TTS (voices load asynchronously in some browsers)
 */
export function initTTS() {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

/**
 * Speak text with random voice variation
 */
export function speak(text) {
  if (voices.length === 0) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voices[Math.floor(Math.random() * voices.length)];
  utterance.rate = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
  utterance.pitch = 0.8 + Math.random() * 0.4;

  speechSynthesis.speak(utterance);
}
