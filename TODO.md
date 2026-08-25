# TODO

## Completed ✓

- [x] **Integrate Markov generator for degraded text**
- [x] **Stage progression (verbatim → word markov → char markov)**
- [x] **Voice quality degradation to match text collapse** (LPC → SAM transition)
- [x] **Text overlap/collision detection** (with tolerance scaling)
- [x] **Time-based auto-stepping** (Tue 5pm → Sat 5pm, quadratic easing)

---

## Future Enhancements

### TTS

- [ ] **Integrate Piper TTS for higher quality offline voices**
  
  Current hybrid system (LPC + SAM) works well for the installation. Piper would be an alternative if more natural speech is desired.
  
  Piper is a lightweight neural TTS that runs on CPU (even Raspberry Pi).
  
  #### Setup
  ```bash
  # Download binary (check releases for latest version)
  wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
  tar -xzf piper_amd64.tar.gz
  
  # Download voices from https://huggingface.co/rhasspy/piper-voices
  wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
  wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
  ```
  
  #### Resources
  - Repo: https://github.com/rhasspy/piper
  - Voices: https://huggingface.co/rhasspy/piper-voices
  - ~50MB binary, 15-100MB per voice model

### Visual

- [ ] **Cursor blink during typing?** — Would add typewriter authenticity but might be visually busy with multiple snippets

### Performance

- [ ] **Profile full 96-hour run** — Test in production mode to identify any memory leaks or performance degradation over time
