import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';

// Helper to check if API key is present
const API_KEY = process.env.API_KEY || '';

interface UseLiveGeminiReturn {
  isConnected: boolean;
  isError: boolean;
  errorMessage: string;
  volume: number; // 0 to 100
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useLiveGemini = (): UseLiveGeminiReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [volume, setVolume] = useState(0);

  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Audio Node Refs
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Session & Playback Refs
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const rafIdRef = useRef<number | null>(null);

  // Initialize Audio Contexts
  const initializeAudioContexts = () => {
    // Input needs 16kHz for Gemini
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    
    // Output can be higher quality, usually 24kHz for Gemini Live
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });

    // Setup Output Node
    if (outputAudioContextRef.current) {
      outputGainNodeRef.current = outputAudioContextRef.current.createGain();
      outputGainNodeRef.current.connect(outputAudioContextRef.current.destination);
    }
  };

  // Volume Visualization Loop
  const updateVolume = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Smooth visual transition
      setVolume(prev => prev * 0.8 + average * 0.2); 
    }
    rafIdRef.current = requestAnimationFrame(updateVolume);
  }, []);

  const cleanup = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Stop all playing sources
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) { /* ignore */ }
    });
    audioSourcesRef.current.clear();

    // Close inputs
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Reset session refs
    sessionPromiseRef.current = null;
    nextStartTimeRef.current = 0;
    analyserRef.current = null;

    setIsConnected(false);
  }, []);

  const disconnect = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
    }
    cleanup();
  }, [cleanup]);

  const connect = useCallback(async () => {
    if (!API_KEY) {
      setIsError(true);
      setErrorMessage("API Key not found in environment.");
      return;
    }

    try {
      setIsError(false);
      setErrorMessage('');
      
      // 1. Initialize Audio Contexts
      initializeAudioContexts();
      
      // 2. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 3. Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      // 4. Setup Visualizer Analyser
      if (inputAudioContextRef.current) {
        analyserRef.current = inputAudioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      }
      updateVolume();

      // 5. Connect to Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: "You are a helpful, witty, and friendly AI assistant. Keep responses concise and conversational.",
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Opened");
            setIsConnected(true);

            // Connect Mic to Processor
            if (inputAudioContextRef.current) {
               inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
               // Connect to Analyser for visualization
               if (analyserRef.current) {
                 inputSourceRef.current.connect(analyserRef.current);
               }
               
               // Use ScriptProcessor for raw PCM access (Standard for this API usage)
               // Buffer size 4096 provides a good balance between latency and stability
               processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
               
               processorRef.current.onaudioprocess = (e) => {
                 const inputData = e.inputBuffer.getChannelData(0);
                 const pcmBlob = createBlob(inputData);
                 
                 // Send to Gemini
                 if (sessionPromiseRef.current) {
                   sessionPromiseRef.current.then(session => {
                     session.sendRealtimeInput({ media: pcmBlob });
                   }).catch(err => {
                     console.error("Error sending input:", err);
                   });
                 }
               };

               inputSourceRef.current.connect(processorRef.current);
               processorRef.current.connect(inputAudioContextRef.current.destination);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current && outputGainNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              
              // Sync Time
              nextStartTimeRef.current = Math.max(
                nextStartTimeRef.current,
                ctx.currentTime
              );

              try {
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  ctx,
                  24000,
                  1
                );

                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputGainNodeRef.current);
                
                source.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(source);
                });

                source.start(nextStartTimeRef.current);
                audioSourcesRef.current.add(source);
                
                nextStartTimeRef.current += audioBuffer.duration;
              } catch (err) {
                console.error("Error decoding/playing audio:", err);
              }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              console.log("Interrupted by user");
              audioSourcesRef.current.forEach(src => {
                 try { src.stop(); } catch (e) {}
              });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Session Closed");
            cleanup();
          },
          onerror: (err) => {
            console.error("Session Error:", err);
            setErrorMessage("Connection error occurred.");
            setIsError(true);
            cleanup();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (error: any) {
      console.error("Connection setup failed:", error);
      setErrorMessage(error.message || "Failed to connect to microphone or API.");
      setIsError(true);
      cleanup();
    }
  }, [cleanup, updateVolume]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnected,
    isError,
    errorMessage,
    volume,
    connect,
    disconnect
  };
};