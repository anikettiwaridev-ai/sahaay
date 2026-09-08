# Speech test clip

`hindi_20s.wav` — 20.0 s, 16 kHz, mono, 16-bit PCM.

Used by `scripts/setup_models.py --bench` to measure the transcription latency
budget in ARCHITECTURE §8 ("transcribe ≤ 4 s for 20 s of audio") and by
BUILD_BRIEFS Phase 0 acceptance 5.

**Source:** [Hindi Dengue Introduction.ogg](https://commons.wikimedia.org/wiki/File:Hindi_Dengue_Introduction.ogg)
from Wikimedia Commons, category *Spoken Hindi Wikipedia*. Licensed **CC BY-SA 3.0**.

**Derivation:** decoded with PyAV, resampled to 16 kHz mono, and cut to seconds
5.0–25.0 of the original 101.6 s recording. The first five seconds are skipped
because they carry the title announcement rather than connected speech.

This is a latency fixture, not an accuracy fixture. Word error rate on
real applicant speech — accented, code-switched, noisy — is Phase 2's
question, and Phase 2 bakes the model ladder off on its own test set.
