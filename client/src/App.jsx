import { useState, useRef, useEffect, useCallback } from 'react';

export default function VoiceAgent() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [serverMessage, setServerMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const recognitionRef = useRef(null);
  const hasSubmittedRef = useRef(false);
  const pendingTranscriptRef = useRef('');

  // 1. Separate the actual fetch logic so it accepts a direct string
  const processOrderToBackend = useCallback(async (orderText) => {
    const trimmedOrderText = orderText.trim();
    if (!trimmedOrderText || isSending) return;
    if (pendingTranscriptRef.current === trimmedOrderText) return;
    
    pendingTranscriptRef.current = trimmedOrderText;
    setIsSending(true);
    setServerMessage("Sending to kitchen...");
    
    try {
      const response = await fetch('http://localhost:3000/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: trimmedOrderText }), // Send the exact text
      });
      
      const data = await response.json();
      if (data.success) {
        setServerMessage(data.duplicate ? "Already sent to kitchen." : "✅ Docket printed successfully!");
      } else {
        setServerMessage("❌ Failed to process order.");
      }
    } catch {
      setServerMessage("❌ Server error. Is the backend running?");
      pendingTranscriptRef.current = '';
      hasSubmittedRef.current = false;
    } finally {
      setIsSending(false);
    }
  }, [isSending]);

  // We use a ref to hold the latest version of the function to avoid React stale closures
  const processOrderRef = useRef(processOrderToBackend);
  useEffect(() => {
    processOrderRef.current = processOrderToBackend;
  }, [processOrderToBackend]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = true; 

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      
      const lowerCaseTranscript = currentTranscript.toLowerCase();

      // 2. THE TRIGGER LOGIC
      if (lowerCaseTranscript.includes("send order") && !hasSubmittedRef.current) {
        hasSubmittedRef.current = true;
        console.log("🎯 Trigger word detected!");
        
        // Stop the microphone automatically
        recognition.stop();
        
        // Strip out the trigger word so the AI doesn't get confused
        const finalOrderText = lowerCaseTranscript.replace("send order", "").trim();
        
        // Update the UI one last time
        setTranscript(finalOrderText);
        
        // Fire it to the backend immediately
        processOrderRef.current(finalOrderText);
      } else {
        // If no trigger word, just update the screen normally
        setTranscript(currentTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (!recognitionRef.current) {
        setServerMessage("Your browser doesn't support the Web Speech API. Try Chrome.");
        return;
      }

      setTranscript(''); 
      setServerMessage('');
      hasSubmittedRef.current = false;
      pendingTranscriptRef.current = '';
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Fallback for manual clicking just in case the kitchen is too loud
  const handleManualSend = () => {
    if (isSending) return;
    recognitionRef.current.stop();
    hasSubmittedRef.current = true;
    processOrderToBackend(transcript);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h2>Kitchen Voice Agent</h2>
      
      <button 
        onClick={toggleListening} 
        style={{
          padding: '15px 20px',
          backgroundColor: isListening ? '#ff4444' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          width: '100%',
          fontSize: '16px',
          marginBottom: '20px'
        }}
      >
        {isListening ? '🛑 Stop Recording (Listening for "Send Order")' : '🎤 Start Recording'}
      </button>

      <div style={{ 
        minHeight: '100px', 
        padding: '15px', 
        border: '1px solid #ccc', 
        borderRadius: '8px',
        marginBottom: '20px',
        backgroundColor: '#f9f9f9',
        fontStyle: isListening ? 'italic' : 'normal'
      }}>
        {transcript || "Press start and say an order..."}
      </div>

      <button 
        onClick={handleManualSend} 
        disabled={!transcript.trim() || isListening || isSending}
        style={{
          padding: '15px 20px',
          backgroundColor: (!transcript.trim() || isListening || isSending) ? '#ccc' : '#008CBA',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: (!transcript.trim() || isListening || isSending) ? 'not-allowed' : 'pointer',
          width: '100%',
          fontSize: '16px'
        }}
      >
        {isSending ? 'Sending...' : 'Manual Send (Override)'}
      </button>

      {serverMessage && (
        <p style={{ marginTop: '20px', fontWeight: 'bold', textAlign: 'center' }}>
          {serverMessage}
        </p>
      )}
    </div>
  );
}
