import { useState } from 'react'
import { useVoiceRecording } from '../hooks/useVoiceRecording.js'
import { cleanupVoiceNote } from '../utils/anthropic.js'

const IconMic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)
const IconStop = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>
)
const IconSparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
  </svg>
)
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)

export default function VoiceNote({ value, onChange, apiKey, showToast }) {
  const { isRecording, transcript, error, startRecording, stopRecording, clearTranscript, setTranscript } = useVoiceRecording()
  const [cleaning, setCleaning] = useState(false)
  const [localText, setLocalText] = useState(value || '')

  const displayText = transcript || localText

  const handleToggle = () => {
    if (isRecording) {
      stopRecording()
      const cleaned = transcript.trim()
      if (cleaned) {
        const combined = localText ? localText + '\n' + cleaned : cleaned
        setLocalText(combined)
        onChange(combined)
      }
      clearTranscript()
    } else {
      startRecording()
    }
  }

  const handleTextChange = (e) => {
    const v = e.target.value
    setLocalText(v)
    onChange(v)
  }

  const handleCleanup = async () => {
    const text = transcript || localText
    if (!text.trim()) return
    setCleaning(true)
    try {
      const cleaned = await cleanupVoiceNote(text, apiKey)
      if (transcript) {
        clearTranscript()
        setLocalText(cleaned)
      } else {
        setLocalText(cleaned)
      }
      onChange(cleaned)
      showToast('Voice note cleaned up!', 'success')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setCleaning(false)
    }
  }

  const handleClear = () => {
    clearTranscript()
    setLocalText('')
    onChange('')
  }

  const hasContent = !!(transcript || localText)

  return (
    <div className="voice-section">
      <div className="voice-section-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, color: 'var(--text3)' }}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
        </svg>
        <span className="voice-section-title">Voice Note</span>
        {isRecording && (
          <span className="recording-label">
            <span className="recording-dot" />
            Recording
          </span>
        )}
      </div>

      <div className="voice-controls">
        {error && <div className="error-msg">{error}</div>}

        <div className="voice-row">
          <button
            className={`mic-btn ${isRecording ? 'recording' : 'idle'}`}
            onClick={handleToggle}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <IconStop /> : <IconMic />}
          </button>

          <div className="voice-right">
            <textarea
              className="voice-transcript"
              placeholder={isRecording ? 'Listening…' : 'Tap mic to record, or type your note…'}
              value={isRecording ? transcript : localText}
              onChange={isRecording ? undefined : handleTextChange}
              readOnly={isRecording}
            />
            {hasContent && (
              <div className="voice-actions">
                <button
                  className="ai-btn"
                  onClick={handleCleanup}
                  disabled={cleaning || isRecording}
                >
                  {cleaning ? <span className="spinner" style={{ borderColor: 'rgba(167,139,250,0.3)', borderTopColor: 'var(--purple)' }} /> : <IconSparkle />}
                  {cleaning ? 'Cleaning…' : 'Clean with AI'}
                </button>
                <button className="clear-btn" onClick={handleClear} disabled={isRecording}>
                  <IconTrash />
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
