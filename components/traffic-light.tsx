"use client"

import { useEffect, useRef } from "react"
import type { google } from "google-maps"

interface TrafficLightProps {
  id: string
  position: { lat: number; lng: number }
  status: "red" | "yellow" | "green"
  onStatusChange?: (id: string, status: "red" | "yellow" | "green") => void
}

export function TrafficLight({ id, position, status, onStatusChange }: TrafficLightProps) {
  const circleRef = useRef<google.maps.Circle | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  // Create and update the traffic light
  useEffect(() => {
    if (!window.googleMap || !position) {
      console.log("No googleMap or position for traffic light", id);
      return;
    }

    console.log(`Creating/updating traffic light ${id} at position`, position, "with status", status);

    // Get status color based on status
    let statusColor;
    switch (status) {
      case "red":
        statusColor = "#FF0000";
        break;
      case "yellow":
        statusColor = "#FFAA00";
        break;
      case "green":
        statusColor = "#00CC00";
        break;
      default:
        statusColor = "#FF0000";
    }

    // Clean up existing circle if needed
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }

    // Create a radius circle for the traffic light
    const circle = new window.google.maps.Circle({
      strokeColor: statusColor,
      strokeOpacity: 0.8,
      strokeWeight: 3,
      fillColor: statusColor,
      fillOpacity: 0.3,
      map: window.googleMap,
      center: position,
      radius: 200,
      clickable: true,
    });

    // Add click listener to the circle
    circle.addListener("click", () => {
      // Create an info window for this traffic light
      const infoContent = `
        <div style="padding: 15px; min-width: 220px; border-left: 4px solid ${statusColor};">
          <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">
            Traffic Light ${id.replace('light-', '')}
          </div>
          <div style="margin-bottom: 8px; font-size: 14px;">
            <strong>Status:</strong> 
            <span style="color: ${statusColor}; font-weight: bold; text-transform: uppercase;">
              ${status}
            </span>
          </div>
          <div style="margin-bottom: 8px; font-size: 14px;">
            <strong>Location:</strong> ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}
          </div>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
        position: position,
      });

      infoWindow.open(window.googleMap);
      infoWindowRef.current = infoWindow;
    });

    // Save references
    circleRef.current = circle;

    // Cleanup on unmount
    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [id, position, status]);

  return null;
} 