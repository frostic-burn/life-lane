"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Loader } from "@googlemaps/js-api-loader"

interface MapContainerProps {
  children: React.ReactNode
  isDarkMode: boolean
}

export function MapContainer({ children, isDarkMode }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const startMarkerRef = useRef<google.maps.Marker | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  useEffect(() => {
    if (mapRef.current && !window.googleMap) {
      const initMap = async () => {
        const loader = new Loader({
          apiKey: "AIzaSyCrMtqPErZSyTRKLB_pClosV9CRIzVSbU0",
          version: "weekly",
          libraries: ["places", "routes", "geocoding"],
          retries: 3,
          retryDelay: 500,
        })

        try {
          const google = await loader.load()
          console.log("Google Maps loaded successfully")

          // Center on Chandigarh, India
          const chandigarhCenter = { lat: 30.7333, lng: 76.7794 }

          const map = new google.maps.Map(mapRef.current, {
            center: chandigarhCenter,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: isDarkMode ? [
              { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
              {
                featureType: "administrative.locality",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
              },
              {
                featureType: "poi",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
              },
              {
                featureType: "poi.park",
                elementType: "geometry",
                stylers: [{ color: "#263c3f" }],
              },
              {
                featureType: "poi.park",
                elementType: "labels.text.fill",
                stylers: [{ color: "#6b9a76" }],
              },
              {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#38414e" }],
              },
              {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#212a37" }],
              },
              {
                featureType: "road",
                elementType: "labels.text.fill",
                stylers: [{ color: "#9ca5b3" }],
              },
              {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [{ color: "#746855" }],
              },
              {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [{ color: "#1f2835" }],
              },
              {
                featureType: "road.highway",
                elementType: "labels.text.fill",
                stylers: [{ color: "#f3d19c" }],
              },
              {
                featureType: "transit",
                elementType: "geometry",
                stylers: [{ color: "#2f3948" }],
              },
              {
                featureType: "transit.station",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
              },
              {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#17263c" }],
              },
              {
                featureType: "water",
                elementType: "labels.text.fill",
                stylers: [{ color: "#515c6d" }],
              },
              {
                featureType: "water",
                elementType: "labels.text.stroke",
                stylers: [{ color: "#17263c" }],
              },
            ] : [],
          })

          // Remove the default traffic visualization and polylines
          // We'll only show routes when a destination is entered

          // Initialize the startLocation but don't create a marker
          // The marker will only be created when using the RoutePreview component
          if (window) {
            window.startLocation = chandigarhCenter;
          }

          // We are removing the map click listener as per user request
          // No ability to set start location by clicking on the map

          setMapInstance(map)
          setIsMapLoaded(true)

          // Add the map instance to window for child components to access
          if (window) {
            window.googleMap = map
            window.google = google
          }

          // Initialize startLocation but don't create a marker until explicitly requested
          window.startLocation = chandigarhCenter;

          // We are removing the map click listener as per user request
          // No ability to set start location by clicking on the map

          setMapInstance(map)
          setIsMapLoaded(true)

          // Add click event listener to the map to set start location
          map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              window.startLocation = { lat: e.latLng.lat(), lng: e.latLng.lng() }
              console.log("Start location set to:", window.startLocation)
              
              // Dispatch custom event to notify other components
              window.dispatchEvent(new CustomEvent('startLocationChanged', {
                detail: window.startLocation
              }));
            }
          })
        } catch (error) {
          console.error("Error loading Google Maps:", error)
          // Display a fallback UI or message
          setLoadError(`Failed to load Google Maps: ${error.message}`)
          if (mapRef.current) {
            mapRef.current.innerHTML = `
              <div style="display: flex; justify-content: center; align-items: center; height: 100%; flex-direction: column; padding: 20px; text-align: center;">
                <h3>Failed to load Google Maps</h3>
                <p>Please check your internet connection and try again.</p>
              </div>
            `
          }
        }
      }

      initMap()
    }

    // Update map styles when dark mode changes
    if (window.googleMap) {
      window.googleMap.setOptions({
        styles: isDarkMode ? [
          { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
          {
            featureType: "administrative.locality",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
          },
          {
            featureType: "poi",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
          },
          {
            featureType: "poi.park",
            elementType: "geometry",
            stylers: [{ color: "#263c3f" }],
          },
          {
            featureType: "poi.park",
            elementType: "labels.text.fill",
            stylers: [{ color: "#6b9a76" }],
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#38414e" }],
          },
          {
            featureType: "road",
            elementType: "geometry.stroke",
            stylers: [{ color: "#212a37" }],
          },
          {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9ca5b3" }],
          },
          {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#746855" }],
          },
          {
            featureType: "road.highway",
            elementType: "geometry.stroke",
            stylers: [{ color: "#1f2835" }],
          },
          {
            featureType: "road.highway",
            elementType: "labels.text.fill",
            stylers: [{ color: "#f3d19c" }],
          },
          {
            featureType: "transit",
            elementType: "geometry",
            stylers: [{ color: "#2f3948" }],
          },
          {
            featureType: "transit.station",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#17263c" }],
          },
          {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: "#515c6d" }],
          },
          {
            featureType: "water",
            elementType: "labels.text.stroke",
            stylers: [{ color: "#17263c" }],
          },
        ] : [],
      });
    }

    // Cleanup function to handle component unmounting
    return () => {
      if (startMarkerRef.current) {
        startMarkerRef.current.setMap(null);
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      // Don't delete the window.googleMap reference as other components might still need it
    };
  }, [isDarkMode])

  return (
    <div className="relative h-full w-full">
      {loadError ? (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 p-4 text-center">
          <div>
            <h3 className="mb-2 text-lg font-semibold text-red-600">Map Loading Error</h3>
            <p className="mb-4">{loadError}</p>
            <button
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0" ref={mapRef} />
          {isMapLoaded && children}
        </>
      )}
    </div>
  )
}

// Extend the Window interface to include our map instance
declare global {
  interface Window {
    googleMap: google.maps.Map
    google: typeof google
    startLocation: google.maps.LatLngLiteral
  }
}

