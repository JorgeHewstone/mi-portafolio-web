"use client";

import { useState, type CSSProperties } from 'react';
import type React from 'react';
import ReactMarkdown from 'react-markdown';

// Estilos básicos (puedes moverlos a un archivo .css)
const styles: { [key: string]: CSSProperties } = {
  container: { maxWidth: '700px', margin: '2rem auto', fontFamily: 'Arial, sans-serif' },
  chatBox: { border: '1px solid #ccc', borderRadius: '8px', height: '400px', overflowY: 'auto', padding: '10px', marginBottom: '10px' },
  message: { marginBottom: '10px', padding: '8px', borderRadius: '5px' },
  userMessage: { backgroundColor: '#e0f7fa', textAlign: 'right' },
  botMessage: { backgroundColor: '#f1f1f1' },
  form: { display: 'flex' },
  input: { flexGrow: 1, padding: '8px', borderRadius: '5px', border: '1px solid #ccc' },
  button: { padding: '8px 12px', marginLeft: '10px', border: 'none', borderRadius: '5px', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' },
  loading: { fontStyle: 'italic', color: '#888', textAlign: 'center' },
  error: { color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }
};

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Hola, soy el asistente de [Tu Nombre]. ¿En qué puedo ayudarte?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input || isLoading) return;

    const newUserMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    setMessages(prev => [...prev, { role: 'bot', content: '...' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Ocurrió un error.');
      }

      // ++++++++++ CORRECCIÓN AQUÍ ++++++++++
      if (!response.body) {
        throw new Error("La respuesta del servidor no tiene cuerpo.");
      }
      // +++++++++++++++++++++++++++++++++++++

      // --- Magia de Streaming ---
      const reader = response.body.getReader(); // <-- Esta línea ahora es segura
      const decoder = new TextDecoder();
      let accumulatedResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulatedResponse += decoder.decode(value, { stream: true });
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'bot', content: accumulatedResponse };
          return newMessages;
        });
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1>Chatbot Portafolio</h1>
      <div style={styles.chatBox}>
        {messages.map((msg, index) => (
          <div key={index} style={{
            ...styles.message,
            ...(msg.role === 'user' ? styles.userMessage : styles.botMessage)
          }}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}
      </div>
      
      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregúntame sobre mi experiencia..."
          style={styles.input}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading} style={styles.button}>
          {isLoading ? '...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}