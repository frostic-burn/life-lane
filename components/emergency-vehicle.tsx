"use client"

import { useEffect, useRef, useState } from "react"
import type { google } from "google-maps"

interface EmergencyVehicleProps {
  id: string
  position: { lat: number; lng: number }
  route: google.maps.LatLngLiteral[]
  vehicleType?: "ambulance" | "fire"
  onUpdatePosition?: (id: string, position: { lat: number; lng: number }) => void
  color?: string
}

export function EmergencyVehicle({
  id,
  position,
  route,
  vehicleType = "ambulance",
  onUpdatePosition,
  color = "#0f53ff",
}: EmergencyVehicleProps) {
  const markerRef = useRef<google.maps.Marker | null>(null)
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const [heading, setHeading] = useState(0)
  const pulseCircleRef = useRef<google.maps.Circle | null>(null)

  // Calculate heading based on current and next position
  useEffect(() => {
    if (route.length < 2) return

    // Find the next point in the route
    const currentIndex = route.findIndex(
      (point) => Math.abs(point.lat - position.lat) < 0.0001 && Math.abs(point.lng - position.lng) < 0.0001,
    )

    if (currentIndex >= 0 && currentIndex < route.length - 1) {
      const nextPoint = route[currentIndex + 1]
      const heading = calculateHeading(position, nextPoint)
      setHeading(heading)
    }
  }, [position, route])

  // Create and update the emergency vehicle marker
  useEffect(() => {
    if (!window.googleMap) return

    // Create marker for emergency vehicle if it doesn't exist
    if (!markerRef.current) {
      // Use a custom ambulance icon with larger size
      const ambulanceIcon = {
        url:
          vehicleType === "ambulance"
            ? "https://cdn-icons-png.flaticon.com/512/2869/2869823.png" // Ambulance top view
            : "https://cdn-icons-png.flaticon.com/512/2991/2991301.png", // Fire truck image
        anchor: new window.google.maps.Point(25, 25),
        scaledSize: new window.google.maps.Size(50, 50), // Larger size
        rotation: heading,
      }

      const marker = new window.google.maps.Marker({
        position,
        map: window.googleMap,
        icon: ambulanceIcon,
        title: `Emergency Vehicle ${id}`,
        zIndex: 1000,
        animation: window.google.maps.Animation.DROP, // Drop animation when first created
      })

      // Create pulsing effect with larger radius to indicate emergency status
      const pulseCircle = new window.google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.7,
        strokeWeight: 3,
        fillColor: color,
        fillOpacity: 0.4, // More opaque for better visibility
        map: window.googleMap,
        center: position,
        radius: 150, // 150 meter effect radius (increased)
        zIndex: 10,
      })
      
      // Animate the pulse effect with more dramatic size changes
      let growingSize = true;
      const pulseInterval = setInterval(() => {
        if (!pulseCircle) return;
        
        const currentRadius = pulseCircle.getRadius();
        if (growingSize) {
          pulseCircle.setRadius(currentRadius + 15); // Faster growth
          if (currentRadius > 300) growingSize = false; // Larger maximum size
        } else {
          pulseCircle.setRadius(currentRadius - 15); // Faster shrinking
          if (currentRadius < 150) growingSize = true;
        }
      }, 80); // Faster pulse interval
      
      pulseCircleRef.current = pulseCircle;

      // Add info window to show details on click
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 12px;">
            <div style="font-weight: bold; color: #d00; font-size: 16px; margin-bottom: 8px;">
              EMERGENCY ${vehicleType === "ambulance" ? "AMBULANCE" : "FIRE TRUCK"} #${id}
            </div>
            <div style="margin-bottom: 5px;">
              <strong>Status:</strong> <span style="color: #FF0000; font-weight: bold;">ACTIVE</span>
            </div>
            <div style="margin-bottom: 5px;">
              <strong>Speed:</strong> 60 km/h
            </div>
            <div style="margin-bottom: 5px;">
              <strong>Traffic Control:</strong> Enabled
            </div>
            <div style="font-style: italic; margin-top: 8px; font-size: 12px;">
              Traffic lights along route are being controlled automatically
            </div>
          </div>
        `,
      })

      // Open info window initially to draw attention
      infoWindow.open(window.googleMap, marker);
      setTimeout(() => infoWindow.close(), 5000); // Auto-close after 5 seconds

      marker.addListener("click", () => {
        infoWindow.open(window.googleMap, marker)
      })

      markerRef.current = marker
      
      // Cleanup function to clear interval when component unmounts
      return () => {
        clearInterval(pulseInterval);
      };
    } else {
      // Update existing marker position
      markerRef.current.setPosition(position)

      // Update icon rotation based on heading
      const icon = markerRef.current.getIcon() as google.maps.Icon
      if (icon) {
        icon.rotation = heading
        markerRef.current.setIcon(icon)
      }
      
      // Update pulse circle position
      if (pulseCircleRef.current) {
        pulseCircleRef.current.setCenter(position);
      }
    }

    // Create or update the route polyline with highlighted path
    if (!polylineRef.current) {
      // Create animated dash symbol for the route
      const lineSymbol = {
        path: 'M 0,-1 0,1',
        strokeOpacity: 1,
        strokeWeight: 3,
        scale: 3,
      };
      
      const polyline = new window.google.maps.Polyline({
        path: route,
        geodesic: true,
        strokeColor: color, // Use the provided color for this vehicle's route
        strokeOpacity: 0.8,
        strokeWeight: 5, // Thicker line for better visibility
        map: window.googleMap,
        zIndex: 5,
        icons: [{
          icon: lineSymbol,
          offset: '0',
          repeat: '20px'
        }],
      })
      
      // Animate the line to show direction of travel
      let count = 0;
      window.setInterval(() => {
        if (!polylineRef.current) return;
        
        count = (count + 1) % 200;
        
        const icons = polylineRef.current.get('icons');
        icons[0].offset = (count / 2) + '%';
        polylineRef.current.set('icons', icons);
      }, 50);
      
      polylineRef.current = polyline
    } else {
      polylineRef.current.setPath(route)
      polylineRef.current.setOptions({
        strokeColor: color,
      })
    }

    // Notify parent component about position update
    if (onUpdatePosition) {
      onUpdatePosition(id, position)
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null)
      }
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
      }
      if (pulseCircleRef.current) {
        pulseCircleRef.current.setMap(null)
      }
    }
  }, [position, route, heading, id, vehicleType, onUpdatePosition, color])

  return null // This component doesn't render anything directly
}

// Helper function to calculate heading between two points
function calculateHeading(start: google.maps.LatLngLiteral, end: google.maps.LatLngLiteral): number {
  const startLat = (start.lat * Math.PI) / 180
  const startLng = (start.lng * Math.PI) / 180
  const endLat = (end.lat * Math.PI) / 180
  const endLng = (end.lng * Math.PI) / 180

  const dLng = endLng - startLng
  const y = Math.sin(dLng) * Math.cos(endLat)
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng)

  let heading = (Math.atan2(y, x) * 180) / Math.PI
  heading = (heading + 360) % 360 // Normalize to 0-360

  return heading
}

