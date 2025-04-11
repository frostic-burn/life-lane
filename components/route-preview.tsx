"use client"

import React from 'react'
import { useEffect, useRef } from "react"
import type { google } from "google-maps"
import { StartPointMarker } from "./start-point-marker"
import { TrafficLight } from './traffic-light'

interface RoutePreviewProps {
  startPoint: google.maps.LatLngLiteral
  destination: google.maps.LatLngLiteral
  isSimulationActive?: boolean
  isManuallyEnteredStart?: boolean
  vehicleType?: 'ambulance' | 'fire'
  trafficLights?: Array<{
    id: string
    position: { lat: number; lng: number }
    status: 'red' | 'yellow' | 'green'
  }>
}

export function RoutePreview({
  startPoint,
  destination,
  isSimulationActive = false,
  isManuallyEnteredStart = false,
  vehicleType = 'ambulance',
  trafficLights = []
}: RoutePreviewProps) {
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null)
  const firstRenderRef = useRef(true)
  const prevDestinationRef = useRef<google.maps.LatLngLiteral | null>(null)

  useEffect(() => {
    // Only create or update destination marker if we're not in simulation mode or it's the first render
    // This prevents jittering of the destination marker during simulation
    if (isSimulationActive && !firstRenderRef.current && destinationMarkerRef.current) {
      // During simulation, only update the route but keep the existing markers
      if (window.google && window.googleMap && startPoint && destination) {
        requestRoute(startPoint, destination);
      }
      return;
    }
    
    // Check if destination actually changed to prevent unnecessary updates
    if (
      prevDestinationRef.current &&
      prevDestinationRef.current.lat === destination.lat &&
      prevDestinationRef.current.lng === destination.lng &&
      destinationMarkerRef.current
    ) {
      return;
    }
    
    // Remember this destination for future comparisons
    prevDestinationRef.current = destination;
    firstRenderRef.current = false;
    
    // Clean up previous elements
    cleanupRoute();

    // Only proceed if we have both points and the map is loaded
    if (!startPoint || !destination || !window.google || !window.googleMap) return
    
    // Create a destination marker
    destinationMarkerRef.current = new window.google.maps.Marker({
      position: destination,
      map: window.googleMap,
      title: "Destination",
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        scaledSize: new window.google.maps.Size(40, 40)
      },
      animation: window.google.maps.Animation.DROP
    });
    
    // Add info window to destination marker
    const destInfoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 10px; min-width: 200px;">
          <div style="font-weight: bold; color: #D32F2F; margin-bottom: 8px; font-size: 14px;">
            Destination Point
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Coordinates:</strong> ${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}
          </div>
        </div>
      `
    });
    
    destinationMarkerRef.current.addListener("click", () => {
      destInfoWindow.open(window.googleMap, destinationMarkerRef.current);
    });

    // Create directions renderer for route visualization
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      map: window.googleMap,
      suppressMarkers: true, // Don't show default A/B markers
      polylineOptions: {
        strokeColor: "#4285F4",
        strokeOpacity: 0.8,
        strokeWeight: 5,
      },
    });

    // Request route from Google Directions
    requestRoute(startPoint, destination);
  }, [startPoint, destination, isSimulationActive]);

  // Helper function to request a route
  const requestRoute = (start: google.maps.LatLngLiteral, end: google.maps.LatLngLiteral) => {
    const directionsService = new window.google.maps.DirectionsService();
    
    directionsService.route(
      {
        origin: start,
        destination: end,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && response) {
          // Display the route
          if (directionsRendererRef.current) {
            directionsRendererRef.current.setDirections(response);
          }

          // Don't fit the map to the route during simulation
          // This prevents the map from moving which can cause jitter
          if (window.googleMap && !isSimulationActive) {
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(new window.google.maps.LatLng(start.lat, start.lng));
            bounds.extend(new window.google.maps.LatLng(end.lat, end.lng));
            window.googleMap.fitBounds(bounds);
          }
        } else {
          console.error("Directions request failed: ", status);
          
          // Fallback - create a simple straight line if directions failed
          polylineRef.current = new window.google.maps.Polyline({
            path: [start, end],
            geodesic: true,
            strokeColor: "#4285F4",
            strokeOpacity: 0.8,
            strokeWeight: 5,
            map: window.googleMap,
          });
        }
      }
    );
  };

  // Helper function to clean up map elements
  const cleanupRoute = () => {
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
      destinationMarkerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRoute();
    };
  }, []);

  // Only return null if there's no start point at all
  if (!startPoint) return null;

  return (
    <>
      {/* Pass isMoving prop based on whether simulation is active */}
      <StartPointMarker 
        position={startPoint} 
        isManuallyEntered={isManuallyEnteredStart}
        isMoving={isSimulationActive}
        vehicleType={vehicleType}
      />
      
      {/* Render traffic lights */}
      {trafficLights.map((light) => (
        <TrafficLight
          key={light.id}
          id={light.id}
          position={light.position}
          status={light.status}
        />
      ))}
    </>
  )
} 