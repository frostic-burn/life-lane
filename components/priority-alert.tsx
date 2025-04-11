"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Volume2, VolumeX, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface PriorityAlertProps {
  alerts: string[]
  directions: string[]
  isSimulationRunning: boolean
  routeInfo?: {
    distance: number
    duration: number
    remainingDistance: number
    remainingDuration: number
    savedTime: number
  }
}

export function PriorityAlert({ alerts, directions, isSimulationRunning, routeInfo }: PriorityAlertProps) {
  const [currentAlert, setCurrentAlert] = useState<string | null>(null)
  const [isNarratorEnabled, setIsNarratorEnabled] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastSpokenAlert, setLastSpokenAlert] = useState<string | null>(null)

  // Update current alert when alerts change
  useEffect(() => {
    if (alerts.length > 0) {
      setCurrentAlert(alerts[0])
    } else if (directions.length > 0) {
      setCurrentAlert(directions[0])
    } else {
      setCurrentAlert(null)
    }
  }, [alerts, directions])

  // Listen for the narrator toggle event
  useEffect(() => {
    const handleNarratorToggle = (event: Event) => {
      const customEvent = event as CustomEvent
      setIsNarratorEnabled(customEvent.detail.enabled)
    }

    window.addEventListener("narrator-toggle", handleNarratorToggle)

    return () => {
      window.removeEventListener("narrator-toggle", handleNarratorToggle)
    }
  }, [])

  // Handle text-to-speech for narrator
  useEffect(() => {
    if (!isNarratorEnabled || !currentAlert || !isSimulationRunning) return

    // Only speak if this is a new alert
    if (currentAlert === lastSpokenAlert) return

    // Check if browser supports speech synthesis
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      // Create a new speech utterance
      const utterance = new SpeechSynthesisUtterance(currentAlert)

      // Customize voice properties for emergency context
      utterance.rate = 1.0 // Normal speed
      utterance.pitch = 1.1 // Slightly higher pitch for urgency
      utterance.volume = 1.0 // Full volume

      // Try to use a more authoritative voice if available
      const voices = window.speechSynthesis.getVoices()
      const preferredVoice = voices.find((voice) => voice.name.includes("Google") && voice.name.includes("US English"))

      if (preferredVoice) {
        utterance.voice = preferredVoice
      }

      // Set speaking state
      setIsSpeaking(true)

      // Remember this alert so we don't repeat it
      setLastSpokenAlert(currentAlert)

      // Add event listener for when speech ends
      utterance.onend = () => {
        setIsSpeaking(false)
      }

      // Speak the alert
      window.speechSynthesis.speak(utterance)

      // Add a visual highlight effect to the alert text
      const alertElement = document.querySelector(".priority-alert-text")
      if (alertElement) {
        alertElement.classList.add("highlight-pulse")
        setTimeout(() => {
          alertElement.classList.remove("highlight-pulse")
        }, 2000)
      }
    }

    // Cleanup function
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
      }
    }
  }, [currentAlert, isNarratorEnabled, isSimulationRunning, lastSpokenAlert])

  // Toggle narrator
  const toggleNarrator = () => {
    if (isNarratorEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setIsNarratorEnabled(!isNarratorEnabled)
  }

  if (!isSimulationRunning || !currentAlert) {
    return null
  }

  // Update the return JSX to add the highlight-pulse class
  return (
    <div className="absolute left-0 right-0 top-0 z-10 mx-auto max-w-3xl p-4">
      <Card className="border-2 border-[#0f53ff] bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-[#0f53ff]" />
              <span className="text-lg font-medium priority-alert-text">{currentAlert}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleNarrator}
              className={isNarratorEnabled ? "bg-[#0f53ff] text-white" : ""}
            >
              {isNarratorEnabled ? (
                <Volume2 className={`h-5 w-5 ${isSpeaking ? "animate-pulse" : ""}`} />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </Button>
          </div>

          {routeInfo && routeInfo.remainingDuration > 0 && (
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-[#0f53ff]" />
              <span>
                Estimated arrival in{" "}
                <span className="font-bold">
                  {Math.floor(routeInfo.remainingDuration / 60)}m {Math.floor(routeInfo.remainingDuration % 60)}s
                </span>
                {routeInfo.savedTime > 0 && (
                  <span className="ml-1 text-green-600">
                    {" "}
                    (Saved {Math.floor(routeInfo.savedTime)}s with traffic control)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

