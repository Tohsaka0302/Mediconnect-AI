import React, { useState } from 'react';
import '../styles/landing.css';

const Insights = () => {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');

  const handleAskAI = () => {
    if (question.trim() === '') return;

    setResponse(`🤖 AI Suggestion: Based on patient history, consider using Treatment Y as next step.`);
  };

  return (
    <div className="aiinsight-container">
      <h1>🧠 AI Insight Panel</h1>
      <p>Ask AI for treatment suggestions, summaries, or cross-hospital comparisons.</p>

      <textarea
        placeholder="Ask something like 'What’s the best treatment plan for Patient X?'"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      ></textarea>

      <button onClick={handleAskAI}>Ask AI</button>

      {response && (
        <div className="ai-response">
          <strong>AI Response:</strong>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
};

export default Insights;
