'use client';

import { useState } from 'react';

export default function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  }

  return (
    <div className="nl">
      <div className="lbl" style={{ justifyContent: 'center', marginBottom: '0.8rem' }}>Nyhetsbrev</div>
      <h2>Registrer deg for å motta nyhetsbrev</h2>
      <p>Siste nyheter om maritim sikkerhet, Argostep og norske sjøfartsforskrifter.</p>

      {submitted ? (
        <p style={{ color: 'var(--green)', fontWeight: 600, marginTop: '1.5rem' }}>
          ✓ Du er registrert!
        </p>
      ) : (
        <form className="nl-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Din e-postadresse..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Registrer</button>
        </form>
      )}
    </div>
  );
}
