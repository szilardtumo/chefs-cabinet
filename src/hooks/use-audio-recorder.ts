import { useRef, useState } from 'react';
import { useCallbackRef } from '@/hooks/use-callback-ref';

const CALIBRATION_MS = 300;
const SILENCE_MS = 1500;
const NO_SPEECH_MS = 8000;
const MAX_MS = 45000;

/**
 * Records one clip from the microphone. It stops by itself after a pause in speech, or after a while without any.
 * `onRecorded` gets `null` when nothing was recorded. `analyser` reads the microphone while recording.
 */
export function useAudioRecorder(onRecorded: (audio: Blob | null) => void) {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const stopRef = useRef<() => void>(null);
  const handleRecorded = useCallbackRef(onRecorded);

  async function start() {
    if (stopRef.current) return;
    // Claimed while the microphone opens, so a second tap in the meantime doesn't start another recording
    stopRef.current = () => {};
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((error) => {
      stopRef.current = null;
      throw error;
    });
    // WebM first: Gemini takes it, and MP4 clips from Chrome on Android seem to come through empty.
    // MP4 is for Safari, which can't record WebM
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const startedAt = performance.now();
    // The first moment measures the room; speech and silence are then judged against that background
    let noise = 0;
    let noiseFrames = 0;
    let speechLevel = 0;
    let silenceLevel = 0;
    let spokeAt: number | undefined;
    let quietSince = startedAt;
    let frame = 0;

    const stop = () => {
      cancelAnimationFrame(frame);
      stopRef.current = null;
      if (recorder.state !== 'inactive') recorder.stop();
    };
    stopRef.current = stop;

    const measure = () => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      const now = performance.now();
      if (now - startedAt < CALIBRATION_MS) {
        noise += rms;
        noiseFrames++;
        frame = requestAnimationFrame(measure);
        return;
      }
      if (!speechLevel) {
        const background = noise / Math.max(1, noiseFrames);
        // Kept within limits: never stricter than the old fixed levels (for a quick start that measured the voice),
        // and never so low that a quiet room's hum counts as speech
        speechLevel = Math.min(0.04, Math.max(0.01, background * 3));
        silenceLevel = Math.min(0.015, Math.max(0.005, background * 1.5));
      }
      if (rms > speechLevel) spokeAt = now;
      if (rms > silenceLevel) quietSince = now;

      if (spokeAt !== undefined ? now - quietSince > SILENCE_MS : now - startedAt > NO_SPEECH_MS) stop();
      else if (now - startedAt > MAX_MS) stop();
      else frame = requestAnimationFrame(measure);
    };

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      void audioContext.close();
      setAnalyser(null);
      const audio = new Blob(chunks, { type: recorder.mimeType });
      // Sent even when it never sounded like speech; Gemini decides whether something was said
      handleRecorded(audio.size === 0 ? null : audio);
    };
    recorder.start();
    setAnalyser(analyser);
    frame = requestAnimationFrame(measure);
  }

  return {
    analyser,
    start,
    /** Stops and hands over the clip. */
    stop: () => stopRef.current?.(),
  };
}
