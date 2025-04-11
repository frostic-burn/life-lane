import React, { useEffect, useRef } from 'react';
import type { google } from 'google-maps';
import { Vehicle } from '@/services/vehicle-manager';

interface VehicleMarkerProps {
  vehicle: Vehicle;
  isSelected?: boolean;
  onSelect?: (vehicleId: string) => void;
}

export function VehicleMarker({ vehicle, isSelected = false, onSelect }: VehicleMarkerProps) {
  const markerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const alternateRoutePolylineRef = useRef<google.maps.Polyline | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  // Create and update the vehicle marker when data changes
  useEffect(() => {
    if (!window.google || !window.googleMap) return;
    
    // Create marker if it doesn't exist
    if (!markerRef.current) {
      const icon = {
        url: 'https://cdn-icons-png.flaticon.com/512/2830/2830332.png', // Use same ambulance image for all vehicles
        scaledSize: new window.google.maps.Size(60, 60),
        anchor: new window.google.maps.Point(30, 30)
      };
      
      markerRef.current = new window.google.maps.Marker({
        position: vehicle.currentPosition,
        map: window.googleMap,
        icon,
        title: `${vehicle.type} (ID: ${vehicle.id.substring(0, 4)})`,
        zIndex: 10
      });
      
      // Create info window
      infoWindowRef.current = new window.google.maps.InfoWindow({
        content: createInfoWindowContent(vehicle)
      });
      
      // Add click listener to marker
      markerRef.current.addListener('click', () => {
        if (onSelect) onSelect(vehicle.id);
        if (infoWindowRef.current) {
          infoWindowRef.current.open(window.googleMap, markerRef.current);
        }
      });
      
      // Create polyline for route visualization
      createOrUpdateRoutePolyline();
    } else {
      // Update marker position
      markerRef.current.setPosition(vehicle.currentPosition);
      
      // Update info window content
      if (infoWindowRef.current) {
        infoWindowRef.current.setContent(createInfoWindowContent(vehicle));
      }
      
      // Update route polyline
      createOrUpdateRoutePolyline();
    }
    
    // Update marker icon based on status
    if (markerRef.current) {
      updateMarkerAppearance();
    }
    
    // If selected, open info window
    if (isSelected && markerRef.current && infoWindowRef.current) {
      infoWindowRef.current.open(window.googleMap, markerRef.current);
    }
    
    return () => {
      // Clean up on unmount or when vehicle changes
      cleanupMapObjects();
    };
  }, [vehicle, isSelected, onSelect]);
  
  // Helper function to create info window content
  const createInfoWindowContent = (vehicle: Vehicle) => {
    const statusText = vehicle.status === 'waiting' 
      ? 'Waiting for other vehicle'
      : vehicle.status === 'completed'
        ? 'Arrived at destination'
        : vehicle.conflictDetected
          ? 'Conflict detected'
          : 'Active';
    
    const statusColor = vehicle.status === 'waiting' 
      ? '#FFA500' 
      : vehicle.status === 'completed'
        ? '#00FF00'
        : vehicle.conflictDetected
          ? '#FF0000'
          : '#0088FF';
    
    return `
      <div style="padding: 10px; min-width: 200px; max-width: 300px;">
        <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">
          ${vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1)} ${vehicle.id.substring(0, 4)}
        </div>
        <div style="margin-bottom: 8px; display: flex; align-items: center;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; margin-right: 5px;"></div>
          <strong>Status:</strong> ${statusText}
        </div>
        <div style="margin-bottom: 8px;">
          <strong>Progress:</strong> ${vehicle.progress.toFixed(0)}%
        </div>
        ${vehicle.routeModified ? 
          '<div style="margin-bottom: 8px; color: #FF5722;"><strong>Route modified</strong> to avoid conflict</div>' : ''}
        ${vehicle.waitingFor ? 
          `<div style="margin-bottom: 8px; color: #FF9800;"><strong>Waiting for:</strong> Vehicle ${vehicle.waitingFor.substring(0, 4)}</div>` : ''}
      </div>
    `;
  };
  
  // Helper function to update marker appearance
  const updateMarkerAppearance = () => {
    if (!markerRef.current || !window.google) return;
    
    // Animate marker if vehicle is moving
    if (vehicle.status === 'active' && !vehicle.conflictDetected) {
      markerRef.current.setAnimation(null);
    } else if (vehicle.status === 'waiting') {
      // Bounce animation for waiting vehicles
      markerRef.current.setAnimation(window.google.maps.Animation.BOUNCE);
    } else if (vehicle.conflictDetected) {
      // Bounce animation for vehicles with conflicts
      markerRef.current.setAnimation(window.google.maps.Animation.BOUNCE);
    } else if (vehicle.status === 'completed') {
      // No animation for completed vehicles
      markerRef.current.setAnimation(null);
    }
  };
  
  // Helper function to create or update route polyline
  const createOrUpdateRoutePolyline = () => {
    if (!window.google || !window.googleMap) return;
    
    // Get current position index in route
    const currentIndex = findClosestPointIndex(
      vehicle.onOriginalRoute ? vehicle.route : (vehicle.alternateRoute || vehicle.route),
      vehicle.currentPosition
    );
    
    // Create remaining route path
    const remainingPath = vehicle.onOriginalRoute
      ? vehicle.route.slice(currentIndex)
      : (vehicle.alternateRoute || vehicle.route).slice(currentIndex);
    
    // Create or update main route polyline
    if (!routePolylineRef.current) {
      routePolylineRef.current = new window.google.maps.Polyline({
        path: remainingPath,
        geodesic: true,
        strokeColor: vehicle.onOriginalRoute ? '#4285F4' : '#FF5722', // Blue for original, orange for alternate
        strokeOpacity: 0.7,
        strokeWeight: 4,
        map: window.googleMap,
        zIndex: 5
      });
    } else {
      routePolylineRef.current.setPath(remainingPath);
      routePolylineRef.current.setOptions({
        strokeColor: vehicle.onOriginalRoute ? '#4285F4' : '#FF5722'
      });
    }
    
    // Show alternate route if available
    if (vehicle.alternateRoute && vehicle.onOriginalRoute) {
      if (!alternateRoutePolylineRef.current) {
        alternateRoutePolylineRef.current = new window.google.maps.Polyline({
          path: vehicle.alternateRoute,
          geodesic: true,
          strokeColor: '#FF5722', // Orange for alternate route
          strokeOpacity: 0.4,
          strokeWeight: 3,
          strokeDasharray: [10, 5], // Dashed line
          map: window.googleMap,
          zIndex: 3
        });
      } else {
        alternateRoutePolylineRef.current.setPath(vehicle.alternateRoute);
        alternateRoutePolylineRef.current.setVisible(true);
      }
    } else if (alternateRoutePolylineRef.current) {
      alternateRoutePolylineRef.current.setVisible(false);
    }
  };
  
  // Helper to find closest point index on route
  const findClosestPointIndex = (
    route: google.maps.LatLngLiteral[], 
    position: google.maps.LatLngLiteral
  ): number => {
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    route.forEach((point, index) => {
      const distance = calculateDistance(point, position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    return closestIndex;
  };
  
  // Helper to calculate distance between two points
  const calculateDistance = (
    point1: google.maps.LatLngLiteral,
    point2: google.maps.LatLngLiteral
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };
  
  // Helper to clean up map objects
  const cleanupMapObjects = () => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    
    if (alternateRoutePolylineRef.current) {
      alternateRoutePolylineRef.current.setMap(null);
      alternateRoutePolylineRef.current = null;
    }
    
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }
  };
  
  // This component doesn't render anything directly in React
  // It only creates and manages Google Maps markers imperatively
  return null;
} 