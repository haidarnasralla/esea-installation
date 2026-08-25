# TODO

## TTS

- [ ] **Integrate Piper TTS for higher quality offline voices**
  
  Currently using Web Speech API which relies on system voices. Quality varies by OS—good on macOS, robotic on Linux.
  
  Piper is a lightweight neural TTS that runs on CPU (even Raspberry Pi).
  
  ### Setup
  ```bash
  # Download binary (check releases for latest version)
  wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
  tar -xzf piper_amd64.tar.gz
  
  # Download voices from https://huggingface.co/rhasspy/piper-voices
  # Example: US English "lessac" voice
  wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
  wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
  ```
  
  ### Integration options
  1. Run Piper as HTTP server, fetch audio from JS
  2. Pre-generate audio for corpus snippets
  3. Small Node server that shells out to Piper binary
  
  ### Resources
  - Repo: https://github.com/rhasspy/piper
  - Voices: https://huggingface.co/rhasspy/piper-voices
  - ~50MB binary, 15-100MB per voice model

## Visual

- [ ] Consider text overlap/collision detection
- [ ] Cursor blink during typing?

## Collapse Stages

- [ ] Integrate Markov generator for degraded text
- [ ] Stage progression (verbatim → word markov → char markov)
- [ ] Voice quality degradation to match text collapse
