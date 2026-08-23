import { useState, useRef, useEffect } from 'react';

export default function VoiceAgent() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [serverMessage, setServerMessage] = useState('');
  
  // useRef keeps the recognition instance alive across renders
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check for browser support (Chrome/Edge use webkit prefix)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setServerMessage("Your browser doesn't support the Web Speech API. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening until explicitly stopped
    recognition.interimResults = true; // Show words as they are spoken

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript(''); // Clear old order
      setServerMessage('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendOrder = async () => {
    if (!transcript) return;
    
    setServerMessage("Sending to kitchen...");
    
    try {
      const response = await fetch('http://localhost:3000/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      
      const data = await response.json();
      if (data.success) {
        setServerMessage("✅ Docket printed successfully!");
        setTranscript(''); // Reset for the next customer
      } else {
        setServerMessage("❌ Failed to process order.");
      }
    } catch (error) {
      setServerMessage("❌ Server error. Is the backend running?");
    }
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
        {isListening ? '🛑 Stop Recording' : '🎤 Start Recording'}
      </button>

      <div style={{ 
        minHeight: '100px', 
        padding: '15px', 
        border: '1px solid #ccc', 
        borderRadius: '8px',
        marginBottom: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        {transcript || "Press start and say an order..."}
      </div>

      <button 
        onClick={sendOrder} 
        disabled={!transcript || isListening}
        style={{
          padding: '15px 20px',
          backgroundColor: (!transcript || isListening) ? '#ccc' : '#008CBA',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: (!transcript || isListening) ? 'not-allowed' : 'pointer',
          width: '100%',
          fontSize: '16px'
        }}
      >
        Send to Kitchen
      </button>

      {serverMessage && (
        <p style={{ marginTop: '20px', fontWeight: 'bold', textAlign: 'center' }}>
          {serverMessage}
        </p>
      )}
    </div>
  );
}