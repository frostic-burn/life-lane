"use client"

import React, { useEffect } from "react"
import { EmergencyVehicle } from "./emergency-vehicle"
import { TrafficLight } from "./traffic-light"
import { useEmergencyRoute } from "@/hooks/use-emergency-route"

export function EmergencySimulation() {
  const {
    vehicles,
    trafficLights,
    isSimulationActive,
    directions,
    alerts,
    currentDestination,
    routeInfo,
  } = useEmergencyRoute()

  // Add more visible debugging
  console.log("Emergency Simulation Component", {
    isSimulationActive,
    vehiclesCount: vehicles.length,
    trafficLightsCount: trafficLights.length,
    routeInfo
  });

  // Center the map on the vehicle if it's moving
  useEffect(() => {
    if (vehicles.length > 0 && isSimulationActive && window.googleMap) {
      console.log("Following emergency vehicle:", vehicles[0]);
      const mainVehicle = vehicles[0]
      
      // Follow the vehicle with smooth animation
      window.googleMap.panTo({
        lat: mainVehicle.position.lat,
        lng: mainVehicle.position.lng,
      })
      
      // Zoom in a bit for better visibility of traffic lights
      if (window.googleMap.getZoom() < 14) {
        window.googleMap.setZoom(14)
      }
    }
  }, [vehicles, isSimulationActive])

  // Don't return null even if simulation is not active
  // This allows us to debug and see if the component is being rendered

  return (
    <>
      {/* Render all traffic lights */}
      {trafficLights.map((light) => (
        <TrafficLight
          key={light.id}
          id={light.id}
          position={light.position}
          status={light.status}
        />
      ))}

      {/* Render all emergency vehicles */}
      {vehicles.map((vehicle) => (
        <EmergencyVehicle
          key={vehicle.id}
          id={vehicle.id}
          position={vehicle.position}
          route={vehicle.route}
          color={vehicle.color}
        />
      ))}


      {/* Alerts and turn-by-turn directions */}
      <div className="fixed bottom-4 left-4 z-50 max-w-md">
        {/* Alerts */}
        <div className="mb-2 max-h-32 overflow-y-auto rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:bg-gray-800/90">
          <h3 className="mb-1 text-lg font-semibold">Alerts</h3>
          <ul className="space-y-1">
            {alerts.map((alert, index) => (
              <li 
                key={index} 
                className={`text-sm ${
                  alert.includes("IMPORTANT") ? "text-red-500 font-bold" : 
                  alert.includes("Traffic light") ? "text-green-500" : 
                  "text-gray-700 dark:text-gray-300"
                }`}
              >
                {alert}
              </li>
            ))}
          </ul>
        </div>

        {/* Turn-by-turn directions */}
        {directions.length > 0 && (
          <div className="rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:bg-gray-800/90">
            <h3 className="mb-1 text-lg font-semibold">Directions</h3>
            <ol className="list-decimal pl-5 text-sm">
              {directions.slice(0, 5).map((direction, index) => (
                <li key={index} dangerouslySetInnerHTML={{ __html: direction }} />
              ))}
            </ol>
          </div>
        )}
      </div>
    </>
  )
}

// Helper function to calculate distance between two points in kilometers
function calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Helper function to format time in minutes and seconds
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
} 