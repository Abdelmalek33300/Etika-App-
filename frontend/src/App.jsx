import { useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleSignup(e) {
    e.preventDefault()
    setMessage('Création du compte...')

    const { error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      setMessage('❌ ' + error.message)
    } else {
      setMessage('✅ Compte créé ! Vérifie ton email.')
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial', maxWidth: 400 }}>
      <h1>Inscription MVP</h1>

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">
          Créer mon compte
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 20 }}>
          {message}
        </p>
      )}
    </div>
  )
}

export default App
