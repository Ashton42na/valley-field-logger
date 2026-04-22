import { useState, useRef, useCallback } from 'react'

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const isRecordingRef = useRef(false)
  const finalRef = useRef('')

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.')
      return
    }

    finalRef.current = ''
    setError(null)

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalRef.current += chunk + ' '
        } else {
          interim += chunk
        }
      }
      setTranscript(finalRef.current + interim)
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      if (event.error === 'aborted') return
      setError(`Mic error: ${event.error}`)
      isRecordingRef.current = false
      setIsRecording(false)
    }

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start() } catch {}
      } else {
        setIsRecording(false)
      }
    }

    recognitionRef.current = recognition
    isRecordingRef.current = true
    setIsRecording(true)

    try {
      recognition.start()
    } catch (e) {
      setError('Could not start recording: ' + e.message)
      isRecordingRef.current = false
      setIsRecording(false)
    }
  }, [])

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  const clearTranscript = useCallback(() => {
    finalRef.current = ''
    setTranscript('')
    setError(null)
  }, [])

  return {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
    setTranscript
  }
}
