"use client"

import { useState, useEffect, useRef } from "react"
import { MapContainer } from "@/components/map-container"
import { ControlPanel } from "@/components/control-panel"
import { EmergencySimulation } from "@/components/emergency-simulation"
import { RoutePreview } from "@/components/route-preview" 
import { useEmergencyRoute } from "@/hooks/use-emergency-route"
import { StartPointMarker } from "@/components/start-point-marker"
import { AddVehicleModal } from "@/components/add-vehicle-modal"
import { MultiVehicleDisplay, VehicleStatusIndicator } from "@/components/multi-vehicle-display"
import { VehicleManager, Vehicle as VehicleType } from "@/services/vehicle-manager"

export default function Home() {
  const [destination, setDestination] = useState("")
  const [startPoint, setStartPoint] = useState("")
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isRoutePreviewActive, setIsRoutePreviewActive] = useState(false)
  // State for storing coordinates
  const [startCoords, setStartCoords] = useState<google.maps.LatLngLiteral | undefined>(undefined)
  const [destCoords, setDestCoords] = useState<google.maps.LatLngLiteral | undefined>(undefined)
  const [isManuallyEnteredStart, setIsManuallyEnteredStart] = useState(false)
  const [animationInterval, setAnimationInterval] = useState<NodeJS.Timeout | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [vehicleType, setVehicleType] = useState<'ambulance' | 'fire'>('ambulance');
  // Add routeInfo state
  const [routeInfo, setRouteInfo] = useState<{
    steps: Array<{
      instruction: string;
      distance: string;
      maneuver?: string;
      completed: boolean;
      _forceUpdate?: number;
    }>;
    currentStepIndex: number;
    normalEstimatedTime: number | null;
    optimizedEstimatedTime: number | null;
    hasReachedDestination: boolean;
    _updateTimestamp?: number;
  }>({
    steps: [],
    currentStepIndex: 0,
    normalEstimatedTime: null,
    optimizedEstimatedTime: null,
    hasReachedDestination: false
  });
  
  const routePointsRef = useRef<google.maps.LatLngLiteral[]>([]);
  const vehiclePositionRef = useRef<google.maps.LatLngLiteral | null>(null);

  const {
    vehicles,
    directions,
    alerts,
    currentDestination,
    startSimulation,
    resetSimulation,
    addAmbulance,
  } = useEmergencyRoute()

  // State for directional instructions
  const [directionSteps, setDirectionSteps] = useState<Array<{
    instruction: string;
    distance: string;
    maneuver?: string;
    completed: boolean;
    _forceUpdate?: number;
  }>>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [normalEstimatedTime, setNormalEstimatedTime] = useState<number | null>(null);
  const [optimizedEstimatedTime, setOptimizedEstimatedTime] = useState<number | null>(null);
  const [hasReachedDestination, setHasReachedDestination] = useState(false);
  const [showReachedMessage, setShowReachedMessage] = useState(false);

  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [additionalVehicles, setAdditionalVehicles] = useState<VehicleType[]>([]);
  const [vehicleManager] = useState<VehicleManager>(() => new VehicleManager());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isMapViewFreezed, setIsMapViewFreezed] = useState(false);
  
  // Traffic light management - restored
  const [trafficLights, setTrafficLights] = useState<Array<{
    id: string;
    position: google.maps.LatLngLiteral;
    status: "red" | "yellow" | "green";
    lastChanged: number;
    cycleTime: number;
  }>>([]);

  // Function to speak navigation instructions using the Web Speech API
  const speakInstruction = (instruction: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(instruction);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      window.speechSynthesis.speak(utterance);
      console.log("Speaking:", instruction);
    } else {
      console.warn("Speech synthesis not supported in this browser");
    }
  };

  // Listen for window.startLocation - but only the initial value, not map clicks
  useEffect(() => {
    if (window.startLocation && !startCoords) {
      setStartCoords(window.startLocation);
    }
  }, [startCoords]);

  // Parse coordinates from string or coordinates
  const parseCoordinates = (coordStr: string): google.maps.LatLngLiteral | null => {
    try {
      if (coordStr.includes(",")) {
        const [lat, lng] = coordStr.split(",").map((coord) => Number.parseFloat(coord.trim()))
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      }
      return null
    } catch (error) {
      console.error("Failed to parse coordinates:", error)
      return null
    }
  }

  // Preview the route without starting simulation
  const handlePreviewRoute = (
    startPointInput: string, 
    dest: string,
    selectedVehicleType: 'ambulance' | 'fire' = 'ambulance'
  ) => {
    setStartPoint(startPointInput)
    setDestination(dest)
    setVehicleType(selectedVehicleType)
    
    // First try to use the manually entered start point coordinates
    let start = parseCoordinates(startPointInput);
    let isManualStart = false;
    
    // Only fall back to the map marker if the user didn't enter valid coordinates
    if (start) {
      isManualStart = true; // User entered valid coordinates
    } else if (window.startLocation) {
      start = window.startLocation;
      isManualStart = false; // Using map marker
    }
    
    if (start) {
      setStartCoords(start)
      setIsManuallyEnteredStart(isManualStart)
    } else {
      alert("Invalid start location. Please enter valid coordinates or click on the map to set a start point.");
      return;
    }
    
    // Parse destination coordinates
    const destCoordinates = parseCoordinates(dest)
    if (destCoordinates) {
      setDestCoords(destCoordinates)
      setIsRoutePreviewActive(true)
    } else {
      alert("Invalid destination. Please enter valid coordinates.");
    }
  }

  // Function to calculate normal and optimized estimated times
  const calculateEstimatedTimes = (response: google.maps.DirectionsResult) => {
    if (!response.routes || !response.routes[0] || !response.routes[0].legs || !response.routes[0].legs[0]) {
      return { normal: null, optimized: null };
    }
    
    // Get the normal time from Google's directions
    const normalTimeSeconds = response.routes[0].legs[0].duration?.value || 0;
    
    // Calculate optimized time (75% of normal time to simulate our system's efficiency)
    const optimizedTimeSeconds = Math.floor(normalTimeSeconds * 0.75);
    
    return { 
      normal: normalTimeSeconds, 
      optimized: optimizedTimeSeconds 
    };
  };

  // Function to parse and extract directions steps from Google Directions API
  const extractDirectionSteps = (response: google.maps.DirectionsResult) => {
    if (!response.routes || !response.routes[0] || !response.routes[0].legs || !response.routes[0].legs[0]) {
      return [];
    }
    
    const leg = response.routes[0].legs[0];
    return leg.steps.map(step => ({
      instruction: step.instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
      distance: step.distance?.text || '',
      maneuver: step.maneuver || '',
      completed: false
    }));
  };

  // Audio element for bell sound
  useEffect(() => {
    // No need to try to load a non-existent file
    // Just create the audio object when needed
    return () => {
      // Clean up
      delete (window as any).bellSound;
    };
  }, []);

  // Function to play bell sound
  const playBellSound = () => {
    try {
      // Create a new audio instance each time to allow overlapping sounds
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3');
      audio.volume = 0.5; // Set volume to 50%
      audio.play().catch(err => console.error("Error playing sound:", err));
    } catch (err) {
      console.error("Error setting up sound:", err);
    }
  };

  // Simple animation function that moves the start point along the route
  const animateMarkerAlongRoute = (
    start: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral
  ) => {
    console.log("Starting marker animation from", start, "to", destination);
    
    // Clear any existing animation
    if (animationInterval) {
      clearInterval(animationInterval);
    }
    
    // Reset passed traffic lights
    passedTrafficLightsRef.current = new Set();
    
    // Create a simple route if we don't have one
    if (routePointsRef.current.length < 2) {
      // Create a more detailed straight-line route with 50 points
      const points: google.maps.LatLngLiteral[] = [];
      for (let i = 0; i <= 50; i++) {
        const fraction = i / 50;
        points.push({
          lat: start.lat + (destination.lat - start.lat) * fraction,
          lng: start.lng + (destination.lng - start.lng) * fraction,
        });
      }
      routePointsRef.current = points;
      console.log("Created simple route with", points.length, "points");
    }
    
    // Generate traffic lights along the route
    const lights = generateTrafficLights(routePointsRef.current);
    setTrafficLights(lights);
    console.log("Generated", lights.length, "traffic lights along the route");
    
    // Force re-render with delay to ensure traffic lights are created
    setTimeout(() => {
      console.log("Forcing traffic light update");
      setTrafficLights([...lights]);
    }, 500);
    
    setAnimationProgress(0);
    
    // Initialize the vehicle position reference
    vehiclePositionRef.current = start;
    
    // Only set the map view once at the beginning to show both start and destination
    if (window.googleMap && !isMapViewFreezed) {
      // Create a bounds object that includes both start and destination
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(new window.google.maps.LatLng(start.lat, start.lng));
      bounds.extend(new window.google.maps.LatLng(destination.lat, destination.lng));
      
      // Also include all traffic lights
      lights.forEach(light => {
        bounds.extend(new window.google.maps.LatLng(light.position.lat, light.position.lng));
      });
      
      // Fit the map to these bounds with less padding for tighter zoom
      window.googleMap.fitBounds(bounds, 20); // Reduced padding from 100 to 20
      
      // After fitting bounds, zoom in a bit more for better visibility
      setTimeout(() => {
        if (window.googleMap && !isMapViewFreezed) {
          const currentZoom = window.googleMap.getZoom() || 15;
          // Increase zoom level by 1 to get closer
          window.googleMap.setZoom(currentZoom + 1);
          console.log("Increased zoom level for better traffic light visibility");
        }
      }, 500);
      
      console.log("Set closer map view to show traffic lights more clearly");
    }
    
    // Calculate random duration between 30-60 seconds for more realistic emergency response
    const minDuration = 30; // 30 seconds minimum
    const maxDuration = 60; // 60 seconds maximum
    const randomDuration = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
    const totalDurationMs = randomDuration * 1000;
    
    // Store start time to calculate elapsed time
    const startTime = Date.now();
    
    // Calculate total distance for speed calculation
    const totalDistance = calculateTotalRouteDistance(routePointsRef.current);
    
    // Update animation variables
    const updateIntervalMs = 200; // 200ms
    const totalSteps = totalDurationMs / updateIntervalMs;
    let currentStep = 0;
    let lastPosition = { ...start };
    
    console.log(`Animation will run for ${randomDuration} seconds with ${totalSteps} steps`);
    console.log(`Total route distance: ${totalDistance.toFixed(2)} km`);
    
    // Set vehicle info in state
    setVehicleInfo({
      startTime,
      duration: randomDuration,
      distance: totalDistance,
      speed: totalDistance / (randomDuration / 3600) // km/h
    });
    
    const interval = setInterval(() => {
      currentStep++;
      
      // Calculate progress as a fraction from 0 to 1
      const progress = Math.min(currentStep / totalSteps, 1);
      setAnimationProgress(progress * 100);
      
      // Update elapsed time and remaining time
      const elapsedTime = (Date.now() - startTime) / 1000; // seconds
      const remainingTime = Math.max(0, randomDuration - elapsedTime);
      
      // Update vehicle info with current values - remove speed calculation
      setVehicleInfo(prev => ({
        ...prev,
        elapsedTime,
        remainingTime
      }));
      
      // IMPROVED NAVIGATION STEP LOGIC with more reliable updates - completely redesigned
      if (directionSteps.length > 0 && routePointsRef.current.length > 0) {
        // Calculate progress percentage to determine step
        const completionPercent = progress * 100;
        
        // Use distance-based progress tracking for more accurate step changes
        // Get current vehicle position
        const currentVehiclePosition = vehiclePositionRef.current;
        
        if (currentVehiclePosition) {
          // Calculate which step we should be on based on distance traveled
          let closestStepIndex = 0;
          let cumulativeDistanceTraveled = 0;
          let totalRouteDistance = calculateTotalRouteDistance(routePointsRef.current);
          
          // Progression based on percentage of total route completed
          const distanceTraveled = completionPercent / 100 * totalRouteDistance;
          
          // Map distance traveled to step index with a slightly accelerated progression
          // This ensures steps change slightly before the vehicle actually reaches that point
          const stepProgressionRate = 1.1; // Accelerate step changes by 10%
          const acceleratedDistanceTraveled = distanceTraveled * stepProgressionRate;
          
          // Calculate which step corresponds to this distance
          const stepsPerKm = directionSteps.length / totalRouteDistance;
          const calculatedStepIndex = Math.min(
            Math.floor(acceleratedDistanceTraveled * stepsPerKm),
            directionSteps.length - 1
          );
          
          // Set a minimum step index based on progress to ensure steps advance
          // This guarantees that by 75% progress, we've seen at least 75% of the steps
          const minimumStep = Math.floor(completionPercent / 100 * directionSteps.length * 0.9);
          
          // Take the maximum to ensure we never go backwards in steps
          const newStepIndex = Math.max(calculatedStepIndex, minimumStep);
          
          // Only update if the step changed
          if (newStepIndex !== currentStepIndex) {
            console.log(`Navigation step changing from ${currentStepIndex} to ${newStepIndex} (${completionPercent.toFixed(1)}% complete)`);
            
            // Update the current step index
            setCurrentStepIndex(newStepIndex);
            
            // Create a completely fresh array with updated completion status
            const updatedSteps = directionSteps.map((step, idx) => {
              return {
                ...step,
                instruction: step.instruction,
                distance: step.distance,
                maneuver: step.maneuver,
                completed: idx < newStepIndex,
                // Add a timestamp to force React to see this as a new object
                _forceUpdate: Date.now() + (idx * 100)
              };
            });
            
            // Force replace the steps array
            setDirectionSteps(updatedSteps);
            
            // Update route info with a completely new object
            const updatedRouteInfo = {
              steps: updatedSteps,
              currentStepIndex: newStepIndex,
              normalEstimatedTime: normalEstimatedTime,
              optimizedEstimatedTime: optimizedEstimatedTime,
              hasReachedDestination: progress >= 1,
              _updateTimestamp: Date.now()
            };
            
            setRouteInfo(updatedRouteInfo);
          }
        }
      }
      
      // Log progress every 10%
      if (currentStep % Math.ceil(totalSteps/10) === 0) {
        console.log(`Animation progress: ${Math.round(progress * 100)}%`);
      }
      
      // If we have route points, interpolate between them
      if (routePointsRef.current.length > 1) {
        const routeIndex = Math.min(
          Math.floor(progress * (routePointsRef.current.length - 1)),
          routePointsRef.current.length - 2
        );
        
        const currentPoint = routePointsRef.current[routeIndex];
        const nextPoint = routePointsRef.current[routeIndex + 1];
        const subProgress = (progress * (routePointsRef.current.length - 1)) - routeIndex;
        
        // Interpolate between current and next point
        const newPosition = {
          lat: currentPoint.lat + (nextPoint.lat - currentPoint.lat) * subProgress,
          lng: currentPoint.lng + (nextPoint.lng - currentPoint.lng) * subProgress,
        };
        
        // Always update position for smoother animation
        setStartCoords(newPosition);
        lastPosition = { ...newPosition };
        
        // Update the vehicle position reference
        vehiclePositionRef.current = newPosition;
      }
      
      // If we're done, show the reached destination message but don't clear interval yet
      if (progress >= 1 && !hasReachedDestination) {
        console.log("Animation complete - destination reached");
        setHasReachedDestination(true);
        
        // Speak destination reached without delay
        speakInstruction("You have reached your destination.");
        
        // Show the reached message
        setShowReachedMessage(true);
        
        // Update route info for the control panel
        setRouteInfo(prev => ({
          ...prev,
          hasReachedDestination: true
        }));
        
        // Mark all direction steps as completed
        setDirectionSteps(prev => 
          prev.map(step => ({
            ...step,
            completed: true
          }))
        );
        
        // Set final position to destination
        setStartCoords(destination);
        vehiclePositionRef.current = destination;
        
        // Stop the simulation - remove the 5 second delay
        clearInterval(interval);
        setAnimationInterval(null);
        console.log("Simulation stopped immediately after reaching destination");
        // Properly stop simulation
        setIsSimulationRunning(false);
      }
      
      // When checking if we're near traffic lights:
      // Check for traffic lights that were passed
      if (vehiclePositionRef.current) {
        trafficLights.forEach(light => {
          // If we haven't passed this light yet
          if (!passedTrafficLightsRef.current.has(light.id)) {
            // Calculate distance to the traffic light
            const distanceToLight = calculateDistance(vehiclePositionRef.current!, light.position);
            
            // If we're very close to the traffic light (within 50 meters)
            if (distanceToLight < 0.05) {
              console.log(`Passing traffic light ${light.id}`);
              // Play bell sound
              playBellSound();
              // Mark this light as passed
              passedTrafficLightsRef.current.add(light.id);
            }
          }
        });
      }
      
      // Update traffic lights based on new vehicle position
      updateTrafficLights();
    }, updateIntervalMs);
    
    setAnimationInterval(interval);
  };

  // Calculate total distance of route in kilometers
  const calculateTotalRouteDistance = (points: google.maps.LatLngLiteral[]): number => {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += calculateDistance(points[i], points[i + 1]);
    }
    
    return totalDistance;
  };

  // Add state for vehicle information
  const [vehicleInfo, setVehicleInfo] = useState<{
    startTime?: number;
    duration?: number;
    distance?: number;
    speed?: number;
    elapsedTime?: number;
    remainingTime?: number;
    currentSpeed?: number;
  }>({});

  // Updated handleStartSimulation to freeze map view
  const handleStartSimulation = (
    startPointInput: string, 
    dest: string, 
    selectedVehicleType: 'ambulance' | 'fire' = 'ambulance'
  ) => {
    console.log("Starting route animation with:", { startPointInput, dest, selectedVehicleType });
    
    // Reset states
    setHasReachedDestination(false);
    setShowReachedMessage(false);
    
    // Update vehicle type
    setVehicleType(selectedVehicleType);
    
    // First preview the route to set up coordinates
    handlePreviewRoute(startPointInput, dest, selectedVehicleType);
    
    // Parse coordinates directly
    const start = parseCoordinates(startPointInput) || window.startLocation;
    const destination = parseCoordinates(dest);
    
    // Only proceed if we have valid coordinates
    if (!start || !destination) {
      console.error("Could not start animation: invalid coordinates", { start, destination });
      alert("Please enter valid coordinates for both start and destination points.");
      return;
    }
    
    console.log("Starting animation with coordinates:", { start, destination });
    
    // Freeze map view during simulation if needed
    setIsMapViewFreezed(true);
       
    // Store route points from Google Directions API
    // This would be populated by the RoutePreview component
    if (window.googleMap && window.google) {
      const directionsService = new window.google.maps.DirectionsService();
      
      directionsService.route(
        {
          origin: start,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          if (status === window.google.maps.DirectionsStatus.OK && response) {
            // Extract route points
            const points: google.maps.LatLngLiteral[] = [];
            const route = response.routes[0];
            const path = route.overview_path;
            
            // Convert Google's LatLng objects to LatLngLiteral
            path.forEach(point => {
              points.push({
                lat: point.lat(),
                lng: point.lng(),
              });
            });
            
            routePointsRef.current = points;
            console.log("Got actual route with", points.length, "points");
            
            // Extract direction steps
            const steps = extractDirectionSteps(response);
            setDirectionSteps(steps);
            setCurrentStepIndex(0);
            console.log("Extracted direction steps:", steps);
            
            // Calculate and set estimated times
            const times = calculateEstimatedTimes(response);
            setNormalEstimatedTime(times.normal);
            setOptimizedEstimatedTime(times.optimized);
            
            // Speak ONLY the starting announcement, not the first instruction
            speakInstruction("Starting emergency route guidance.");
            
            // Start the animation
            animateMarkerAlongRoute(start, destination);
            
            // Update UI state
            setIsSimulationRunning(true);
            setIsRoutePreviewActive(true); // Keep route visible
            
            // Set route info for the control panel
            setRouteInfo({
              steps: steps,
              currentStepIndex: 0,
              normalEstimatedTime: times.normal,
              optimizedEstimatedTime: times.optimized,
              hasReachedDestination: false
            });
          } else {
            console.error("Could not get directions, using simple route");
            routePointsRef.current = [];
            setDirectionSteps([]);
            setNormalEstimatedTime(null);
            setOptimizedEstimatedTime(null);
            animateMarkerAlongRoute(start, destination);
            
            setIsSimulationRunning(true);
            setIsRoutePreviewActive(true);
          }
        }
      );
    } else {
      // Fallback for when Google Maps is not available
      console.log("Google Maps not available, using simple route");
      routePointsRef.current = [];
      setDirectionSteps([]);
      setNormalEstimatedTime(null);
      setOptimizedEstimatedTime(null);
      animateMarkerAlongRoute(start, destination);
      
      setIsSimulationRunning(true);
      setIsRoutePreviewActive(true);
    }
  }
  
  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationInterval) {
        clearInterval(animationInterval);
      }
    };
  }, [animationInterval]);

  // Updated handleResetSimulation to clear animation
  const handleResetSimulation = () => {
    // Clear any running animation
    if (animationInterval) {
      clearInterval(animationInterval);
      setAnimationInterval(null);
    }
    
    resetSimulation();
    setIsSimulationRunning(false);
    setDestination("");
    setIsRoutePreviewActive(false);
    setAnimationProgress(0);
    // Keep the start coordinates but clear destination
    setDestCoords(undefined);
    
    // Clear additional vehicles
    vehicleManager.clearAll();
    setAdditionalVehicles([]);
    setSelectedVehicleId(null);
  }

  // Updated handleAddAmbulance to open the modal
  const handleAddAmbulance = () => {
    setIsAddVehicleModalOpen(true);
  }

  // Function to handle adding a new vehicle
  const handleAddVehicle = (startPoint: string, destination: string, vehicleType: 'ambulance' | 'fire') => {
    console.log("Adding additional vehicle:", { startPoint, destination, vehicleType });
    
    // Parse coordinates
    const startCoords = parseCoordinates(startPoint);
    const destCoords = parseCoordinates(destination);
    
    if (!startCoords || !destCoords) {
      alert("Invalid coordinates for new vehicle. Please enter valid lat,lng values.");
      return;
    }
    
    // Get route using Google Maps Directions API
    if (window.googleMap && window.google) {
      const directionsService = new window.google.maps.DirectionsService();
      
      // For selected demo scenarios, force alternate route
      const forceAlternateRoute = startPoint.includes("30.7433,76.7839") || // Sector 17
                                  startPoint.includes("30.7056,76.8013") || // Elante Mall
                                  startPoint.includes("30.6798,76.8078");  // Railway Station
      
      directionsService.route(
        {
          origin: startCoords,
          destination: destCoords,
          travelMode: window.google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: true,
          optimizeWaypoints: false,
          // For conflict scenarios, we want to add a waypoint to create an intersecting route
          ...(forceAlternateRoute && {
            waypoints: [{
              location: new window.google.maps.LatLng(
                startCoords.lat + (destCoords.lat - startCoords.lat) * 0.5 + 0.003,
                startCoords.lng + (destCoords.lng - startCoords.lng) * 0.5 - 0.003
              ),
              stopover: false
            }]
          })
        },
        (response, status) => {
          if (status === window.google.maps.DirectionsStatus.OK && response) {
            // Extract route points
            const points: google.maps.LatLngLiteral[] = [];
            
            // For conflict scenarios, use an alternate route if available
            const routeIndex = forceAlternateRoute && response.routes.length > 1 ? 1 : 0;
            const route = response.routes[routeIndex];
            const path = route.overview_path;
            
            // Convert Google's LatLng objects to LatLngLiteral
            path.forEach(point => {
              points.push({
                lat: point.lat(),
                lng: point.lng(),
              });
            });
            
            // Generate traffic lights for this route path
            const vehicleLights = generateTrafficLights(points);
            console.log(`Generated ${vehicleLights.length} traffic lights for additional vehicle route`);
            
            // Merge with existing traffic lights, avoiding duplicates by position
            const existingPositions = new Map(trafficLights.map(light => 
              [`${light.position.lat.toFixed(5)},${light.position.lng.toFixed(5)}`, light]
            ));
            
            vehicleLights.forEach(light => {
              const posKey = `${light.position.lat.toFixed(5)},${light.position.lng.toFixed(5)}`;
              if (!existingPositions.has(posKey)) {
                existingPositions.set(posKey, light);
              }
            });
            
            // Update traffic lights
            const mergedLights = Array.from(existingPositions.values());
            setTrafficLights(mergedLights);
            
            // Extract direction steps
            const steps = extractDirectionSteps(response);
            
            // Add vehicle to manager
            const vehicleId = vehicleManager.addVehicle(
              vehicleType, 
              startCoords, 
              destCoords, 
              points,
              steps
            );
            
            // Start the vehicle animation
            animateAdditionalVehicle(vehicleId);
            
            // Add to our UI state
            const vehicle = vehicleManager.getVehicle(vehicleId);
            if (vehicle) {
              setAdditionalVehicles(prev => [...prev, vehicle]);
              setSelectedVehicleId(vehicleId);
              
              // Ensure map shows all vehicles
              updateMapBoundsForAllVehicles();
              
              // For conflict demo, log and add alert
              if (forceAlternateRoute) {
                console.log("Using alternate route for conflict demonstration");
                alerts.unshift("Conflict scenario activated - using alternate route to demonstrate conflict resolution");
              }
            }
          } else {
            console.error("Could not get directions for additional vehicle");
            alert("Could not calculate route for new vehicle. Please try different coordinates.");
          }
        }
      );
    } else {
      alert("Google Maps is not available. Please try again later.");
    }
  }
  
  // Function to animate additional vehicles
  const animateAdditionalVehicle = (vehicleId: string) => {
    const vehicle = vehicleManager.getVehicle(vehicleId);
    if (!vehicle || vehicle.route.length < 2) return;
    
    console.log(`Starting animation for additional vehicle ${vehicleId}`);
    
    // Calculate random duration between 30-60 seconds
    const minDuration = 30;
    const maxDuration = 60;
    const randomDuration = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
    const totalDurationMs = randomDuration * 1000;
    
    // Update animation variables
    const updateIntervalMs = 200; // 200ms
    const totalSteps = totalDurationMs / updateIntervalMs;
    let currentStep = 0;
    
    // Store vehicle's passed traffic lights
    const passedTrafficLights = new Set<string>();
    
    const interval = setInterval(() => {
      currentStep++;
      
      // Calculate progress as a fraction from 0 to 1
      const progress = Math.min(currentStep / totalSteps, 1);
      
      // If we have route points, interpolate between them
      if (vehicle.route.length > 1) {
        const routeIndex = Math.min(
          Math.floor(progress * (vehicle.route.length - 1)),
          vehicle.route.length - 2
        );
        
        const currentPoint = vehicle.route[routeIndex];
        const nextPoint = vehicle.route[routeIndex + 1];
        const subProgress = (progress * (vehicle.route.length - 1)) - routeIndex;
        
        // Interpolate between current and next point
        const newPosition = {
          lat: currentPoint.lat + (nextPoint.lat - currentPoint.lat) * subProgress,
          lng: currentPoint.lng + (nextPoint.lng - currentPoint.lng) * subProgress,
        };
        
        // Update vehicle position
        vehicleManager.updateVehiclePosition(
          vehicleId, 
          newPosition, 
          progress * 100,
          Math.floor(progress * vehicle.steps.length)
        );
        
        // Check if we're near traffic lights
        trafficLights.forEach(light => {
          // If we haven't passed this light yet
          if (!passedTrafficLights.has(light.id)) {
            // Calculate distance to the traffic light
            const distanceToLight = calculateDistance(newPosition, light.position);
            
            // If we're very close to the traffic light (within 50 meters)
            if (distanceToLight < 0.05) {
              console.log(`Vehicle ${vehicleId} passing traffic light ${light.id}`);
              // Play bell sound
              playBellSound();
              // Mark this light as passed
              passedTrafficLights.add(light.id);
              
              // Update traffic light status - turn green for emergency vehicles
              setTrafficLights(prevLights => 
                prevLights.map(tl => 
                  tl.id === light.id ? {...tl, status: "green", lastChanged: Date.now()} : tl
                )
              );
            }
          }
        });
        
        // Check if any waiting vehicles can resume
        vehicleManager.checkAndResumeWaitingVehicles();
        
        // Try to return to original route if on alternate
        vehicleManager.returnToOriginalRoute(vehicleId);
        
        // Update our UI state with the latest vehicles
        setAdditionalVehicles([...vehicleManager.getAllVehicles()]);
      }
      
      // If we're done, clean up
      if (progress >= 1) {
        clearInterval(interval);
        console.log(`Animation complete for vehicle ${vehicleId}`);
        
        // Update final state
        vehicleManager.updateVehiclePosition(
          vehicleId,
          vehicle.destination,
          100,
          vehicle.steps.length - 1
        );
        
        // Update our UI state
        setAdditionalVehicles([...vehicleManager.getAllVehicles()]);
      }
    }, updateIntervalMs);
  }
  
  // Function to update map bounds to show all vehicles
  const updateMapBoundsForAllVehicles = () => {
    if (!window.googleMap || isMapViewFreezed) return;
    
    const bounds = new window.google.maps.LatLngBounds();
    
    // Add main vehicle if active
    if (startCoords) {
      bounds.extend(new window.google.maps.LatLng(startCoords.lat, startCoords.lng));
    }
    
    if (destCoords) {
      bounds.extend(new window.google.maps.LatLng(destCoords.lat, destCoords.lng));
    }
    
    // Add all additional vehicles
    vehicleManager.getAllVehicles().forEach(vehicle => {
      bounds.extend(new window.google.maps.LatLng(
        vehicle.currentPosition.lat, 
        vehicle.currentPosition.lng
      ));
      
      bounds.extend(new window.google.maps.LatLng(
        vehicle.destination.lat, 
        vehicle.destination.lng
      ));
    });
    
    // Fit map to bounds
    window.googleMap.fitBounds(bounds, 50);
  }
  
  // Select a vehicle to focus on
  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    
    const vehicle = vehicleManager.getVehicle(vehicleId);
    if (vehicle && window.googleMap) {
      // Center map on selected vehicle
      window.googleMap.panTo(vehicle.currentPosition);
      window.googleMap.setZoom(15); // Closer zoom
    }
  }
  
  // Add cleanup for vehicle animations on unmount
  useEffect(() => {
    return () => {
      vehicleManager.clearAll();
    };
  }, []);

  // In the render method, convert string[] alerts to {title, message}[] alerts
  // Fix for the alerts type error
  const formattedAlerts = alerts.map(alert => ({ 
    title: "System Alert", 
    message: alert 
  }));

  // Add a diagnostics effect to log updates to help debug
  useEffect(() => {
    if (routeInfo && routeInfo.steps && routeInfo.steps.length > 0) {
      console.log(`routeInfo was updated with ${routeInfo.steps.length} steps, current step: ${routeInfo.currentStepIndex}`);
    }
  }, [routeInfo]);

  // Call this function when the map is initialized - use fixed positions for ALL controls
  useEffect(() => {
    // Small delay to ensure map is loaded
    setTimeout(() => {
      if (window.googleMap) {
        // Set ALL map controls to fixed positions
        window.googleMap.setOptions({
          zoomControl: true,
          zoomControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_BOTTOM
          },
          scrollwheel: true,
          draggable: true,
          disableDoubleClickZoom: false,
          mapTypeControl: true,
          mapTypeControlOptions: {
            position: window.google.maps.ControlPosition.LEFT_BOTTOM,
            style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR
          },
          streetViewControl: true,
          streetViewControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_BOTTOM
          },
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_TOP
          }
        });
        
        console.log("Map controls configured with fixed positions");
      }
    }, 1000);
  }, []);

  // Implement a COMPLETELY NEW navigation instructions update mechanism
  useEffect(() => {
    // Aggressive update mechanism: Force updates very frequently
    if (isSimulationRunning) {
      console.log("Setting up aggressive navigation update interval");
      
      // Create a high-frequency update interval
      const aggressiveUpdateInterval = setInterval(() => {
        if (routeInfo && routeInfo.steps && routeInfo.steps.length > 0) {
          // Calculate current progress
          const progressPercent = animationProgress;
          
          // Determine step based on progress
          const newStepIndex = Math.min(
            Math.floor((progressPercent / 100) * routeInfo.steps.length),
            routeInfo.steps.length - 1
          );
          
          console.log(`Forcing navigation update: Progress ${progressPercent.toFixed(1)}%, Step ${newStepIndex+1}/${routeInfo.steps.length}`);
          
          // Create entirely new step objects to ensure React detects changes
          const forceUpdatedSteps = routeInfo.steps.map((step, idx) => ({
            ...step,
            instruction: step.instruction,
            distance: step.distance,
            maneuver: step.maneuver,
            completed: idx < newStepIndex,
            _forceUpdate: Date.now() + idx // Unique timestamp for each step
          }));
          
          // Force update both state variables
          setCurrentStepIndex(newStepIndex);
          setDirectionSteps(forceUpdatedSteps);
          
          // Create a completely new routeInfo object
          setRouteInfo({
            steps: forceUpdatedSteps,
            currentStepIndex: newStepIndex,
            normalEstimatedTime,
            optimizedEstimatedTime,
            hasReachedDestination: progressPercent >= 100,
            _updateTimestamp: Date.now()
          });
        }
      }, 200); // Ultra-fast updates - 5 times per second
      
      return () => clearInterval(aggressiveUpdateInterval);
    }
  }, [isSimulationRunning, animationProgress, routeInfo?.steps?.length]);
  
  // Helper function to calculate distance between two points in kilometers
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

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  // Add button to toggle map view freezing
  const toggleMapViewFreeze = () => {
    setIsMapViewFreezed(!isMapViewFreezed);
  }

  // Generate traffic lights along the route with random initial states
  const generateTrafficLights = (routePoints: google.maps.LatLngLiteral[]) => {
    if (routePoints.length < 4) {
      console.log("Not enough route points to create traffic lights");
      return [];
    }
    
    const lights = [];
    // Place lights at regular intervals, but not at the very start or end
    const interval = Math.max(1, Math.floor(routePoints.length / 5)); // More frequent traffic lights
    
    console.log(`Generating traffic lights with interval ${interval} for ${routePoints.length} points`);
    
    // Possible traffic light states to simulate normal traffic
    const possibleStates = ["red", "yellow", "green"] as const;
    
    for (let i = interval; i < routePoints.length - interval; i += interval) {
      // Add a small offset to position lights slightly to the side of the road
      const offset = 0.0005; // Increased geographical offset for better visibility
      const position = {
        lat: routePoints[i].lat + (Math.random() > 0.5 ? offset : -offset),
        lng: routePoints[i].lng + (Math.random() > 0.5 ? offset : -offset),
      };
      
      // Randomly select an initial state to simulate realistic traffic
      const randomState = possibleStates[Math.floor(Math.random() * possibleStates.length)];
      
      const light = {
        id: `light-${i}`,
        position: position,
        status: randomState,
        lastChanged: Date.now(), // Track when this light last changed state
        cycleTime: 5000 + Math.floor(Math.random() * 5000), // Random cycle time (5-10 seconds)
      };
      
      lights.push(light);
      console.log(`Created traffic light at position:`, position, `with initial state:`, randomState);
    }
    
    console.log(`Generated ${lights.length} traffic lights along the route`);
    return lights;
  };

  // Update traffic light status based on vehicle position and simulate regular traffic changes
  const updateTrafficLights = () => {
    if (!vehiclePositionRef.current) return;
    
    const now = Date.now();
    
    setTrafficLights(prevLights => {
      return prevLights.map(light => {
        // Calculate distance from vehicle to this light
        const distance = calculateDistance(
          vehiclePositionRef.current!,
          light.position
        );
        
        // First determine if this light would normally change based on its cycle time
        const timeSinceLastChange = now - (light.lastChanged || now);
        const shouldChangeCycle = timeSinceLastChange > (light.cycleTime || 8000);
        
        // Determine status based on emergency vehicle distance (priority) or normal cycle
        let newStatus = light.status;
        
        // Emergency vehicle has priority within 500 meters
        if (distance < 0.5) {
          newStatus = "green";
        } else if (distance < 1.0) {
          newStatus = "yellow";
        } else if (shouldChangeCycle) {
          // Normal traffic light cycle if outside emergency vehicle's influence
          // Cycle: red -> green -> yellow -> red
          if (light.status === "red") newStatus = "green";
          else if (light.status === "green") newStatus = "yellow";
          else if (light.status === "yellow") newStatus = "red";
        }
        
        // Only update lastChanged if the state actually changed
        const lastChanged = light.status !== newStatus ? now : (light.lastChanged || now);
        
        return {
          ...light,
          status: newStatus,
          lastChanged: lastChanged,
        };
      });
    });
  };

  // Track passed traffic lights to avoid playing sound multiple times
  const passedTrafficLightsRef = useRef<Set<string>>(new Set());

  return (
    <main className={`flex min-h-screen flex-col ${isDarkMode ? "bg-gray-900 text-gray-100" : ""}`}>
      <div className={`flex h-16 items-center border-b px-4 ${isDarkMode ? "border-gray-700 bg-gray-900" : ""}`}>
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-green-500 text-transparent bg-clip-text">LifeLane</h1>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ControlPanel
          onStartSimulation={handleStartSimulation}
          onPreviewRoute={handlePreviewRoute}
          onResetSimulation={handleResetSimulation}
          isSimulationRunning={isSimulationRunning}
          currentDestination={currentDestination}
          directions={directions}
          alerts={formattedAlerts}
          onAddAmbulance={handleAddAmbulance}
          ambulanceCount={vehicles.length + additionalVehicles.length}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          routeInfo={routeInfo}
        />
        <div className="relative flex-1">
          <MapContainer isDarkMode={isDarkMode}>
            {/* Primary route preview */}
            {startCoords && destCoords && (
              <RoutePreview 
                startPoint={startCoords} 
                destination={destCoords} 
                isSimulationActive={isSimulationRunning || animationInterval !== null}
                isManuallyEnteredStart={isManuallyEnteredStart}
                vehicleType={vehicleType}
                trafficLights={trafficLights}
              />
            )}
            
            {/* Multiple vehicles display */}
            <MultiVehicleDisplay 
              vehicles={additionalVehicles} 
              isDarkMode={isDarkMode} 
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={handleSelectVehicle}
            />
            
            {/* Emergency simulation when running - always render this component */}
            {isSimulationRunning && (
              <EmergencySimulation />
            )}
          </MapContainer>

          {/* Display selected vehicle status if any is selected */}
          {selectedVehicleId && additionalVehicles.length > 0 && (
            <VehicleStatusIndicator 
              vehicle={additionalVehicles.find(v => v.id === selectedVehicleId)!} 
              isDarkMode={isDarkMode}
            />
          )}

          {/* Vehicle selector - shown when multiple vehicles are present */}
          {additionalVehicles.length > 0 && (
            <div className={`absolute top-20 left-4 z-20 p-2 rounded-lg shadow-lg ${isDarkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
              <div className="text-sm font-semibold mb-2">Vehicles</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {additionalVehicles.map(vehicle => (
                  <button
                    key={vehicle.id}
                    onClick={() => handleSelectVehicle(vehicle.id)}
                    className={`w-full text-left px-2 py-1 text-xs rounded flex items-center ${
                      selectedVehicleId === vehicle.id 
                        ? isDarkMode ? 'bg-blue-800' : 'bg-blue-100'
                        : isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div 
                      className={`w-2 h-2 rounded-full mr-2 ${
                        vehicle.status === 'waiting' ? 'bg-yellow-500' :
                        vehicle.status === 'completed' ? 'bg-green-500' :
                        vehicle.conflictDetected ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                    ></div>
                    <span>
                      {vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1)} {vehicle.id.substring(0, 4)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top-right corner navigation instructions - Only show when vehicle has NOT reached destination */}
          {(isSimulationRunning || animationInterval || additionalVehicles.length > 0) && (
            <div 
              key={`nav-container-${Date.now()}`}
              className={`absolute top-16 right-4 z-10 w-96 max-h-[calc(100vh-100px)] overflow-y-auto rounded-md shadow-lg ${isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}
            >
              <div className={`p-3 font-medium border-b ${isDarkMode ? "border-gray-700 text-white" : "border-gray-200"} sticky top-0 ${isDarkMode ? "bg-gray-800" : "bg-white"} z-10`}>
                <div className="flex justify-between items-center">
                  <span>Navigation Instructions</span>
                  <button 
                    className={`text-xs px-2 py-1 rounded ${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"}`}
                    onClick={() => setIsMapViewFreezed(!isMapViewFreezed)}
                  >
                    {isMapViewFreezed ? 'Unfreeze Map' : 'Freeze Map'}
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto">
                {/* Main vehicle instructions */}
                {routeInfo && routeInfo.steps && routeInfo.steps.length > 0 && 
                 !hasReachedDestination && !showReachedMessage && (
                  <div>
                    <div className={`px-3 py-2 text-sm font-semibold ${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100"}`}>
                      Primary Vehicle {hasReachedDestination ? "(Arrived)" : ""}
                    </div>
                    <div className="p-2 space-y-2">
                      {routeInfo.steps.map((step, index) => (
                        <div 
                          key={`main-nav-step-${index}-${Date.now()}`} 
                          className={`p-2 rounded-md ${
                            index === routeInfo.currentStepIndex
                              ? isDarkMode 
                                ? "bg-blue-900 text-white" 
                                : "bg-blue-50 border-blue-200"
                              : isDarkMode
                                ? "bg-gray-700 text-gray-300"
                                : "bg-gray-50"
                          } ${step.completed ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${
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
                              {step.completed ? "✓" : index + 1}
                            </div>
                            <div className="flex-1 text-sm">
                              <span className={`${step.completed ? "line-through" : ""}`}>{step.instruction}</span>
                              {step.distance && (
                                <span className={`text-xs block ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                  {step.distance}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional vehicles instructions */}
                {additionalVehicles.length > 0 && (
                  <div>
                    {additionalVehicles.map(vehicle => (
                      <div key={`vehicle-${vehicle.id}`}>
                        <div 
                          className={`px-3 py-2 text-sm font-semibold ${
                            selectedVehicleId === vehicle.id
                              ? isDarkMode ? "bg-blue-800 text-white" : "bg-blue-100"
                              : isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100"
                          } cursor-pointer`}
                          onClick={() => handleSelectVehicle(vehicle.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div 
                                className={`w-2 h-2 rounded-full mr-2 ${
                                  vehicle.status === 'waiting' ? 'bg-yellow-500' :
                                  vehicle.status === 'completed' ? 'bg-green-500' :
                                  vehicle.conflictDetected ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                              ></div>
                              <span>
                                Vehicle {vehicle.id.substring(0, 4)} {vehicle.status === 'completed' ? "(Arrived)" : ""}
                              </span>
                            </div>
                            <div className="text-xs">
                              {vehicle.progress.toFixed(0)}% Complete
                            </div>
                          </div>
                        </div>
                        
                        {/* Only show steps for selected or single vehicle */}
                        {(selectedVehicleId === vehicle.id || additionalVehicles.length === 1) && (
                          <div className="p-2 space-y-2">
                            {vehicle.steps.map((step, index) => (
                              <div 
                                key={`add-nav-step-${vehicle.id}-${index}`} 
                                className={`p-2 rounded-md ${
                                  index === vehicle.currentStepIndex
                                    ? isDarkMode 
                                      ? "bg-blue-900 text-white" 
                                      : "bg-blue-50 border-blue-200"
                                    : isDarkMode
                                      ? "bg-gray-700 text-gray-300"
                                      : "bg-gray-50"
                                } ${step.completed ? "opacity-60" : ""}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                                    index === vehicle.currentStepIndex
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
                                    {step.completed ? "✓" : index + 1}
                                  </div>
                                  <div className="flex-1 text-sm">
                                    <span className={`${step.completed ? "line-through" : ""}`}>{step.instruction}</span>
                                    {step.distance && (
                                      <span className={`text-xs block ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                        {step.distance}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* No active routes message */}
                {(!routeInfo?.steps || routeInfo.steps.length === 0 || hasReachedDestination || showReachedMessage) && 
                 additionalVehicles.length === 0 && (
                  <div className="p-4 text-center">
                    <span className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
                      No active navigation routes
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top Progress Bar */}
          {(isSimulationRunning || animationInterval) && (
            <div className={`absolute left-0 right-0 top-0 p-3 ${isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white/80 shadow-md"} transition-all duration-300`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <span className={`font-medium ${isDarkMode ? "text-blue-300" : "text-blue-600"}`}>
                    Emergency Route
                  </span>
                  {vehicleType && (
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      vehicleType === 'ambulance' 
                        ? isDarkMode ? 'bg-red-900 text-red-100' : 'bg-red-100 text-red-800' 
                        : isDarkMode ? 'bg-orange-900 text-orange-100' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {vehicleType === 'ambulance' ? 'Ambulance' : 'Fire Truck'}
                    </span>
                  )}
                  
                  {additionalVehicles.length > 0 && (
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      isDarkMode ? 'bg-blue-900 text-blue-100' : 'bg-blue-100 text-blue-800'
                    }`}>
                      +{additionalVehicles.length} additional {additionalVehicles.length === 1 ? 'vehicle' : 'vehicles'}
                    </span>
                  )}
                </div>
                <div className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                  {animationProgress.toFixed(0)}% Complete
                </div>
              </div>

              {/* Progress bar */}
              <div className={`h-2 w-full overflow-hidden rounded-full ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`}>
                <div
                  className={`h-full rounded-full transition-all ${
                    hasReachedDestination 
                      ? isDarkMode ? "bg-green-500" : "bg-green-500" 
                      : isDarkMode ? "bg-blue-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${animationProgress}%` }}
                />
              </div>

              {/* Destination reached message */}
              {showReachedMessage && (
                <div className={`mt-2 text-center font-bold ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
                  Destination Reached!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Add Vehicle Modal */}
      <AddVehicleModal 
        isOpen={isAddVehicleModalOpen}
        onClose={() => setIsAddVehicleModalOpen(false)}
        onAddVehicle={handleAddVehicle}
      />

      {/* Map control toggle button */}
      {(isSimulationRunning || additionalVehicles.length > 0) && (
        <button
          onClick={toggleMapViewFreeze}
          className={`absolute right-4 bottom-20 z-20 px-3 py-2 rounded-md shadow-lg text-sm ${
            isDarkMode 
              ? isMapViewFreezed ? 'bg-blue-800 text-white' : 'bg-gray-700 text-white'
              : isMapViewFreezed ? 'bg-blue-100 text-blue-800' : 'bg-white text-gray-800'
          }`}
        >
          {isMapViewFreezed ? 'Free Map Movement' : 'Lock Map View'}
        </button>
      )}
    </main>
  )
}

