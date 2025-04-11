"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Search, MapPin, AlertTriangle, Sun, Moon, Clock, Check, BanIcon, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface ControlPanelProps {
  onStartSimulation: (startPoint: string, destination: string, vehicleType: 'ambulance' | 'fire') => void
  onPreviewRoute: (startPoint: string, destination: string, vehicleType: 'ambulance' | 'fire') => void
  onResetSimulation: () => void
  isSimulationRunning: boolean
  currentDestination: string
  directions: string[]
  alerts: Array<{title: string, message: string}> 
  onAddAmbulance: () => void
  ambulanceCount: number
  isDarkMode: boolean
  onToggleDarkMode: () => void
  routeInfo?: {
    steps?: Array<{
      instruction: string;
      distance: string;
      maneuver?: string;
      completed: boolean;
      _forceUpdate?: number;
    }>;
    currentStepIndex?: number;
    normalEstimatedTime?: number | null;
    optimizedEstimatedTime?: number | null;
    hasReachedDestination?: boolean;
    _updateTimestamp?: number;
    distance?: number;
    remainingDuration?: number;
    savedTime?: number;
  }
}

// Predefined locations in Chandigarh
const CHANDIGARH_LOCATIONS = [
  { name: "Sector 17", coords: "30.7433,76.7839" },
  { name: "PGI Hospital", coords: "30.7649,76.7764" },
  { name: "Elante Mall", coords: "30.7056,76.8013" },
  { name: "Sukhna Lake", coords: "30.7426,76.8089" },
  { name: "Rock Garden", coords: "30.7512,76.8044" },
  { name: "ISBT Sector 43", coords: "30.7076,76.7913" },
  { name: "Chandigarh Railway Station", coords: "30.6798,76.8078" },
  { name: "Government Medical College", coords: "30.7372,76.7698" },
  { name: "Panjab University", coords: "30.7603,76.7664" },
  { name: "Chandigarh Airport", coords: "30.6735,76.7885" },
]

export function ControlPanel({
  onStartSimulation,
  onPreviewRoute,
  onResetSimulation,
  isSimulationRunning,
  currentDestination,
  directions,
  alerts,
  onAddAmbulance,
  ambulanceCount,
  isDarkMode,
  onToggleDarkMode,
  routeInfo,
}: ControlPanelProps) {
  const [startPoint, setStartPoint] = useState("")
  const [destination, setDestination] = useState("")
  const [emergencyType, setEmergencyType] = useState("ambulance")
  const [selectedStartLocation, setSelectedStartLocation] = useState("")
  const [selectedDestLocation, setSelectedDestLocation] = useState("")
  const [isNarratorEnabled, setIsNarratorEnabled] = useState(true)
  
  // Add a local version of current step to ensure UI updates even if props don't change
  const [localCurrentStep, setLocalCurrentStep] = useState(0)
  
  // Track when routeInfo updates to force re-render
  const [lastRouteInfoUpdate, setLastRouteInfoUpdate] = useState(Date.now())

  // Connect the narrator switch to the actual narrator functionality
  // Add a function to handle narrator toggle
  const handleNarratorToggle = (checked: boolean) => {
    setIsNarratorEnabled(checked)

    // Dispatch a custom event that PriorityAlert can listen for
    const event = new CustomEvent("narrator-toggle", { detail: { enabled: checked } })
    window.dispatchEvent(event)

    // Provide feedback
    if (checked) {
      // Create a temporary alert to confirm narrator is enabled
      const alertElement = document.createElement("div")
      alertElement.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50"
      alertElement.textContent = "Voice narrator enabled"
      document.body.appendChild(alertElement)

      setTimeout(() => {
        alertElement.style.opacity = "0"
        alertElement.style.transition = "opacity 0.5s"
        setTimeout(() => {
          document.body.removeChild(alertElement)
        }, 500)
      }, 2000)
    }
  }

  // Update input fields when predefined locations are selected
  useEffect(() => {
    if (selectedStartLocation) {
      const location = CHANDIGARH_LOCATIONS.find((loc) => loc.name === selectedStartLocation)
      if (location) {
        setStartPoint(location.coords)
      }
    }
  }, [selectedStartLocation])

  useEffect(() => {
    if (selectedDestLocation) {
      const location = CHANDIGARH_LOCATIONS.find((loc) => loc.name === selectedDestLocation)
      if (location) {
        setDestination(location.coords)
      }
    }
  }, [selectedDestLocation])
  
  // Force update local state when routeInfo changes
  useEffect(() => {
    if (routeInfo) {
      // Update local step to match the current step from routeInfo
      if (typeof routeInfo.currentStepIndex === 'number') {
        setLocalCurrentStep(routeInfo.currentStepIndex);
      }
      
      // Register that we received an update to force re-render
      setLastRouteInfoUpdate(Date.now());
      
      // Log when we get updates to help debug
      if (routeInfo.steps && routeInfo.steps.length > 0) {
        console.log(`ControlPanel received routeInfo update. Current step: ${routeInfo.currentStepIndex}, Total steps: ${routeInfo.steps.length}`);
      }
    }
  }, [routeInfo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (startPoint.trim() && destination.trim()) {
      onStartSimulation(startPoint, destination, emergencyType as 'ambulance' | 'fire')

      // Auto-switch to directions tab after starting simulation
      const tabsElement = document.querySelector('[role="tablist"]')
      if (tabsElement) {
        const directionsTab = tabsElement.querySelector('[value="directions"]') as HTMLElement
        if (directionsTab) {
          setTimeout(() => {
            directionsTab.click()
          }, 500)
        }
      }
    } else {
      alert("Please enter both start point and destination")
    }
  }

  // Preview button click handler
  const handlePreviewClick = () => {
    if (startPoint.trim() && destination.trim()) {
      onPreviewRoute(startPoint, destination, emergencyType as 'ambulance' | 'fire')
    } else {
      alert("Please enter both start point and destination")
    }
  }

  // Format time in minutes and seconds
  const formatTime = (seconds: number | null | undefined): string => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  // Auto-switch to directions tab after starting simulation
  useEffect(() => {
    if (isSimulationRunning) {
      const tabsElement = document.querySelector('[role="tablist"]')
      if (tabsElement) {
        const directionsTab = tabsElement.querySelector('[value="directions"]') as HTMLElement
        if (directionsTab) {
          setTimeout(() => {
            directionsTab.click()
          }, 500)
        }
      }
    }
  }, [isSimulationRunning]);

  // Update tabs content for directions and alerts
  return (
    <div className={`w-96 border-r ${isDarkMode ? "bg-gray-900 text-gray-100" : "bg-background"} p-4 overflow-y-auto`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Control Panel</h2>
        <Button variant="outline" size="icon" onClick={onToggleDarkMode}>
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>

      <Tabs defaultValue="route" className={isDarkMode ? "text-white" : ""}>
        <TabsList className={`grid w-full grid-cols-2 ${isDarkMode ? "bg-gray-700 text-gray-300" : ""}`}>
          <TabsTrigger 
            value="route" 
            className={isDarkMode ? "data-[state=active]:bg-gray-800 data-[state=active]:text-white" : ""}
          >
            Route Control
          </TabsTrigger>
          <TabsTrigger 
            value="directions" 
            className={isDarkMode ? "data-[state=active]:bg-gray-800 data-[state=active]:text-white" : ""}
          >
            Directions & Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="route">
          <Card className={isDarkMode ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader className={isDarkMode ? "text-white" : ""}>
              <CardTitle>Emergency Route Control</CardTitle>
              <CardDescription className={isDarkMode ? "text-gray-400" : ""}>
                Set start and destination points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    Start Point
                  </label>
                  <Select
                    disabled={isSimulationRunning}
                    value={selectedStartLocation}
                    onValueChange={setSelectedStartLocation}
                  >
                    <SelectTrigger className={isDarkMode ? "bg-gray-700 text-white border-gray-600" : ""}>
                      <SelectValue placeholder="Select start location" className={isDarkMode ? "text-gray-200" : ""} />
                    </SelectTrigger>
                    <SelectContent className={isDarkMode ? "bg-gray-800 text-white border-gray-700" : ""}>
                      {CHANDIGARH_LOCATIONS.map((location) => (
                        <SelectItem 
                          key={location.name} 
                          value={location.name}
                          className={isDarkMode ? "text-white hover:bg-gray-700" : ""}
                        >
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter start coordinates"
                      className={`pl-8 ${isDarkMode ? "bg-gray-700 text-white border-gray-600 placeholder-gray-400" : ""}`}
                      value={startPoint}
                      onChange={(e) => setStartPoint(e.target.value)}
                      disabled={isSimulationRunning}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    Destination
                  </label>
                  <Select
                    disabled={isSimulationRunning}
                    value={selectedDestLocation}
                    onValueChange={setSelectedDestLocation}
                  >
                    <SelectTrigger className={isDarkMode ? "bg-gray-700 text-white border-gray-600" : ""}>
                      <SelectValue placeholder="Select destination" className={isDarkMode ? "text-gray-200" : ""} />
                    </SelectTrigger>
                    <SelectContent className={isDarkMode ? "bg-gray-800 text-white border-gray-700" : ""}>
                      {CHANDIGARH_LOCATIONS.map((location) => (
                        <SelectItem 
                          key={location.name} 
                          value={location.name}
                          className={isDarkMode ? "text-white hover:bg-gray-700" : ""}
                        >
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter destination coordinates"
                      className={`pl-8 ${isDarkMode ? "bg-gray-700 text-white border-gray-600 placeholder-gray-400" : ""}`}
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      disabled={isSimulationRunning}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    Emergency Vehicle Type
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={emergencyType === "ambulance" ? "default" : "outline"}
                      onClick={() => setEmergencyType("ambulance")}
                      disabled={isSimulationRunning}
                      className="flex-1"
                    >
                      🚑 Ambulance
                    </Button>
                    <Button
                      type="button"
                      variant={emergencyType === "fire" ? "default" : "outline"}
                      onClick={() => setEmergencyType("fire")}
                      disabled={isSimulationRunning}
                      className="flex-1"
                    >
                      🚒 Fire Truck
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      className={`flex-1 ${isSimulationRunning ? "bg-red-500 hover:bg-red-600" : ""}`} 
                      disabled={!startPoint.trim() || !destination.trim()}
                    >
                      {isSimulationRunning ? "Stop Simulation" : "Start Simulation"}
                    </Button>
                    
                    {!isSimulationRunning && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1"
                        onClick={handlePreviewClick}
                      >
                        Preview Route
                      </Button>
                    )}
                  </div>

                  {isSimulationRunning && (
                    <div className="mt-2">
                      <Button variant="secondary" size="sm" className="w-full" onClick={onAddAmbulance}>
                        Add Emergency Vehicle ({ambulanceCount})
                      </Button>
                    </div>
                  )}
                </div>
              </form>

              {isSimulationRunning && currentDestination && (
                <div className={`mt-4 rounded-md ${isDarkMode ? "bg-gray-700" : "bg-muted"} p-3`}>
                  <div className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    Active Emergency Route
                  </div>
                  <div className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    {currentDestination}
                  </div>

                  {routeInfo && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className={`text-sm ${isDarkMode ? "text-gray-200" : ""}`}>
                          Distance: <span className="font-medium">{routeInfo.distance?.toFixed(2)} km</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className={`text-sm ${isDarkMode ? "text-gray-200" : ""}`}>
                          Estimated Time: <span className="font-medium">{formatTime(routeInfo.remainingDuration)}</span>
                          {routeInfo.savedTime && routeInfo.savedTime > 0 && (
                            <span className="ml-1 text-green-500">(Saved {Math.floor(routeInfo.savedTime)}s)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={isDarkMode ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800"}
                    >
                      Route Active
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={isDarkMode ? "bg-blue-900 text-blue-300" : "bg-blue-100 text-blue-800"}
                    >
                      {ambulanceCount} Ambulance{ambulanceCount > 1 ? "s" : ""} Active
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              {isSimulationRunning ? (
                <>
                  <Button variant="outline" onClick={onAddAmbulance} className="w-full">
                    Add Another Ambulance
                  </Button>
                  <Button variant="destructive" onClick={onResetSimulation} className="w-full">
                    Stop Simulation
                  </Button>
                </>
              ) : (
                <Button type="submit" onClick={handleSubmit} className="w-full">
                  Start Emergency Route
                </Button>
              )}
            </CardFooter>
          </Card>

          <div className="mt-4">
            <Card className={isDarkMode ? "bg-gray-800 border-gray-700" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm ${isDarkMode ? "text-white" : ""}`}>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDarkMode ? "text-gray-300" : ""}`}>Route Optimization:</span>
                    <Badge
                      variant="outline"
                      className={
                        isSimulationRunning
                          ? isDarkMode
                            ? "bg-green-900 text-green-300"
                            : "bg-green-100 text-green-800"
                          : isDarkMode
                            ? "bg-gray-700 text-gray-400"
                            : "bg-gray-100"
                      }
                    >
                      {isSimulationRunning ? "Active" : "Standby"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDarkMode ? "text-gray-300" : ""}`}>Vehicle Tracking:</span>
                    <Badge
                      variant="outline"
                      className={
                        isSimulationRunning
                          ? isDarkMode
                            ? "bg-green-900 text-green-300"
                            : "bg-green-100 text-green-800"
                          : isDarkMode
                            ? "bg-gray-700 text-gray-400"
                            : "bg-gray-100"
                      }
                    >
                      {isSimulationRunning ? "Active" : "Standby"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="directions">
          <Card className={isDarkMode ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader className={isDarkMode ? "text-white" : ""}>
              <CardTitle>Navigation Instructions</CardTitle>
              <CardDescription className={isDarkMode ? "text-gray-400" : ""}>
                Turn-by-turn directions and alerts
              </CardDescription>
              
              {/* Voice Narrator Toggle */}
              <div className="flex items-center space-x-2 mt-2">
                <Switch 
                  id="narrator-mode" 
                  checked={isNarratorEnabled}
                  onCheckedChange={handleNarratorToggle}
                />
                <Label htmlFor="narrator-mode" className={isDarkMode ? "text-white" : ""}>Voice Narrator</Label>
              </div>
              
              {/* Time comparison section */}
              {routeInfo?.normalEstimatedTime && routeInfo?.optimizedEstimatedTime && (
                <div className="mt-4 bg-blue-900 p-3 rounded-md">
                  <h3 className="text-white font-medium">Estimated Time Comparison</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-red-700 p-2 rounded">
                      <div className="text-xs text-gray-200">Without System</div>
                      <div className="text-white font-bold">
                        {formatTime(routeInfo.normalEstimatedTime)}
                      </div>
                    </div>
                    <div className="bg-green-700 p-2 rounded">
                      <div className="text-xs text-gray-200">With System</div>
                      <div className="text-white font-bold">
                        {formatTime(routeInfo.optimizedEstimatedTime)}
                      </div>
                    </div>
                  </div>
                  {routeInfo.normalEstimatedTime && routeInfo.optimizedEstimatedTime && (
                    <div className="mt-2 text-green-300 text-sm font-medium text-center">
                      Time Saved: {formatTime(routeInfo.normalEstimatedTime - routeInfo.optimizedEstimatedTime)}
                    </div>
                  )}
                </div>
              )}
              
              {/* Destination reached message */}
              {routeInfo?.hasReachedDestination && (
                <div className="mt-3 bg-green-700 p-3 rounded-md text-white font-bold text-center">
                  Destination Reached!
                </div>
              )}
            </CardHeader>
            
            <CardContent className={isDarkMode ? "text-gray-300" : ""}>
              {!routeInfo?.steps?.length && !isSimulationRunning ? (
                <div className="text-center py-6">
                  <BanIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <h3 className={`text-lg font-medium mb-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>No Active Route</h3>
                  <p className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
                    Start an emergency route to see directions.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Add a key with lastRouteInfoUpdate to force re-rendering when we receive updates */}
                  <div key={`steps-container-${lastRouteInfoUpdate}`}>
                    {routeInfo?.steps?.map((step, index) => (
                      <div 
                        key={`nav-step-${index}-${step._forceUpdate || lastRouteInfoUpdate}`} 
                        className={`p-3 rounded-md border ${
                          index === routeInfo.currentStepIndex
                            ? isDarkMode 
                              ? "bg-blue-900 border-blue-700 text-white" 
                              : "bg-blue-50 border-blue-200"
                            : isDarkMode
                              ? "bg-gray-700 border-gray-600"
                              : "bg-gray-50 border-gray-200"
                        } ${step.completed ? "opacity-70" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                            index === routeInfo.currentStepIndex
                              ? isDarkMode
                                ? "bg-blue-500 text-white"
                                : "bg-blue-500 text-white"
                              : step.completed
                                ? isDarkMode
                                  ? "bg-gray-600 text-gray-300"
                                  : "bg-gray-400 text-white"
                                : isDarkMode
                                  ? "bg-gray-600 text-gray-300" 
                                  : "bg-gray-300 text-gray-700"
                          }`}>
                            {step.completed ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <span className="text-xs">{index + 1}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`${step.completed ? "line-through" : ""} ${
                              isDarkMode ? "text-gray-200" : ""
                            }`}
                            >
                              {step.instruction}
                            </p>
                            {step.distance && (
                              <p className={`text-xs ${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}>
                                {step.distance}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Debug information */}
                  {isSimulationRunning && routeInfo?.steps && (
                    <div className="mt-2 text-xs text-gray-500">
                      Showing step {routeInfo.currentStepIndex !== undefined ? routeInfo.currentStepIndex + 1 : 0} of {routeInfo.steps.length}
                    </div>
                  )}
                </div>
              )}

              {alerts.length > 0 && (
                <div className="mt-6">
                  <h3 className={`text-sm font-medium mb-2 ${isDarkMode ? "text-white" : ""}`}>System Alerts</h3>
                  <div className="space-y-2">
                    {alerts.map((alert, index) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded-md ${
                          isDarkMode 
                            ? "bg-red-900 text-red-100" 
                            : "bg-red-50 text-red-800"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{alert.title}</p>
                            <p className={`text-xs ${isDarkMode ? "text-red-200" : "text-red-700"}`}>{alert.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            
            <CardFooter>
              <Button
                variant="secondary"
                onClick={onResetSimulation}
                className="w-full"
                disabled={!isSimulationRunning}
              >
                Reset Simulation
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

