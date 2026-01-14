import { useState, useCallback, useRef } from 'react';

interface UseVoiceOutputOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: string;
}

interface UseVoiceOutputReturn {
  isSpeaking: boolean;
  isSupported: boolean;
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  voices: SpeechSynthesisVoice[];
}

export const useVoiceOutput = (options: UseVoiceOutputOptions = {}): UseVoiceOutputReturn => {
  const { rate = 1, pitch = 1, volume = 1, voice } = options;
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load available voices
  if (isSupported && voices.length === 0) {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  const speak = useCallback((text: string) => {
    if (!isSupported || !text) return;

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Select voice
    if (voice && voices.length > 0) {
      const selectedVoice = voices.find(v => v.name === voice || v.lang === voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    } else if (voices.length > 0) {
      // Default to a good English voice if available
      const englishVoice = voices.find(v => 
        v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))
      ) || voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, rate, pitch, volume, voice, voices]);

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  const pause = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.pause();
    }
  }, [isSupported]);

  const resume = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.resume();
    }
  }, [isSupported]);

  return {
    isSpeaking,
    isSupported,
    speak,
    stop,
    pause,
    resume,
    voices,
  };
};
