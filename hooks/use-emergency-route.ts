"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface TrafficLight {
  id: string
  position: { lat: number; lng: number }
  status: "red" | "yellow" | "green"
}

interface EmergencyVehicle {
  id: string
  position: { lat: number; lng: number }
  route: google.maps.LatLngLiteral[]
  currentStep: number
  color: string
}

interface RouteInfo {
  distance: number // in kilometers
  duration: number // in seconds
  remainingDistance: number
  remainingDuration: number
  savedTime: number // time saved due to traffic light control
}

// Declare google as a global variable to avoid Typescript errors
declare global {
  interface Window {
    google: typeof google
    googleMap: google.maps.Map
  }
}

// Vehicle speed in km/h
const VEHICLE_SPEED = 50

// Colors for different vehicles
const VEHICLE_COLORS = [
  "#0f53ff", // Blue
  "#ff5722", // Orange
  "#4caf50", // Green
  "#9c27b0", // Purple
  "#e91e63", // Pink
]

export function useEmergencyRoute() {
  const [vehicles, setVehicles] = useState<EmergencyVehicle[]>([])
  const [trafficLights, setTrafficLights] = useState<TrafficLight[]>([])
  const [simulationInterval, setSimulationInterval] = useState<NodeJS.Timeout | null>(null)
  const [isSimulationActive, setIsSimulationActive] = useState(false)
  const [directions, setDirections] = useState<string[]>([])
  const [alerts, setAlerts] = useState<string[]>([])
  const [currentDestination, setCurrentDestination] = useState("")
  const [routeWaypoints, setRouteWaypoints] = useState<google.maps.LatLngLiteral[]>([])
  const [routeInfo, setRouteInfo] = useState<RouteInfo>({
    distance: 0,
    duration: 0,
    remainingDistance: 0,
    remainingDuration: 0,
    savedTime: 0,
  })

  // Get the main vehicle position and route (for backward compatibility)
  const vehiclePosition = vehicles.length > 0 ? vehicles[0].position : null
  const route = vehicles.length > 0 ? vehicles[0].route : []

  const requestRouteRef = useRef<
    (
      origin: google.maps.LatLngLiteral,
      destination: google.maps.LatLngLiteral,
      callback: (route: google.maps.LatLngLiteral[]) => void,
      forceAlternative?: boolean,
    ) => void
  >(() => {})

  // Generate traffic lights at intersections along the route
  const generateTrafficLights = useCallback((routePath: google.maps.LatLngLiteral[]) => {
    if (routePath.length < 2) return []

    const lights: TrafficLight[] = []

    // Place traffic lights at regular intervals along the route
    // In a real implementation, you would identify actual intersections
    for (let i = 0; i < routePath.length; i += Math.floor(routePath.length / 8)) {
      if (i > 0 && i < routePath.length - 1) {
        lights.push({
          id: `light-${i}`,
          position: routePath[i],
          status: "red", // Default status
        })
      }
    }

    return lights
  }, [])

  // Create a fallback route when Google Directions fails
  const createFallbackRoute = useCallback(
    (
      origin: google.maps.LatLngLiteral,
      destination: google.maps.LatLngLiteral,
      callback: (route: google.maps.LatLngLiteral[]) => void,
    ) => {
      const numPoints = 20 // Number of points in our fallback route
      const path: google.maps.LatLngLiteral[] = []

      for (let i = 0; i <= numPoints; i++) {
        const fraction = i / numPoints
        path.push({
          lat: origin.lat + (destination.lat - origin.lat) * fraction,
          lng: origin.lng + (destination.lng - origin.lng) * fraction,
        })
      }

      // Add a simple direction for the fallback route
      setDirections(["Proceed directly to destination"])
      setRouteWaypoints(path)

      // Calculate straight-line distance and estimated duration
      const distance = calculateDistance(origin, destination)
      const duration = (distance / VEHICLE_SPEED) * 3600 // Convert to seconds

      setRouteInfo({
        distance,
        duration,
        remainingDistance: distance,
        remainingDuration: duration,
        savedTime: 0,
      })

      // Add an alert about using fallback route
      setAlerts((prev: string[]) => ["Using fallback route - optimal directions unavailable", ...prev])

      callback(path)
    },
    [],
  )

  // Format time in minutes and seconds
  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }, [])

  // Initialize Navigation SDK if available
  const initializeNavigationSDK = useCallback((path: google.maps.LatLngLiteral[]) => {
    if (!window.google || !window.googleMap || path.length < 2) return

    try {
      // Check if Navigation SDK is available
      if (window.google.maps.navigation) {
        const navigationService = new window.google.maps.navigation.Navigation({
          map: window.googleMap,
        })

        // Set up navigation route
        navigationService.route(
          {
            origin: path[0],
            destination: path[path.length - 1],
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result: any) => {
            if (result) {
              console.log("Navigation route established")
            }
          },
        )
      }
    } catch (error) {
      console.warn("Navigation SDK not available, using fallback animation", error)
    }
  }, [])

  // Update traffic lights based on vehicle positions
  const updateTrafficLights = useCallback(() => {
    if (vehicles.length === 0) return

    setTrafficLights((prevLights: TrafficLight[]) => {
      return prevLights.map((light: TrafficLight) => {
        // Check distance from each vehicle to this light
        let closestDistance = Number.POSITIVE_INFINITY
        let closestVehicle = null
        let conflictDetected = false

        // Find the closest vehicle to this light
        vehicles.forEach((vehicle: EmergencyVehicle) => {
          const distance = calculateDistance(vehicle.position, light.position)

          // Check if multiple vehicles are approaching the same light
          if (distance < 0.3 && closestDistance < 0.3) {
            conflictDetected = true
          }

          if (distance < closestDistance) {
            closestDistance = distance
            closestVehicle = vehicle
          }
        })

        // If conflict detected, add an alert
        if (conflictDetected) {
          setAlerts((prev: string[]) => [
            "Traffic conflict detected at intersection - prioritizing emergency vehicles",
            ...prev.slice(0, 4),
          ])
        }

        // Determine light status based on closest vehicle and simulate real traffic light behavior
        let newStatus: "red" | "yellow" | "green" = light.status

        // Simulate normal traffic light cycle if no emergency vehicle is nearby
        if (closestDistance > 0.8) {
          // Use the light's ID to create a deterministic but seemingly random cycle
          const lightIdNum = Number.parseInt(light.id.replace("light-", ""), 10)
          const cycleTime = 90 // 90 second cycle
          const currentTime = Math.floor(Date.now() / 1000)
          const cyclePosition = (currentTime + lightIdNum * 30) % cycleTime

          if (cyclePosition < 45) {
            newStatus = "green"
          } else if (cyclePosition < 50) {
            newStatus = "yellow"
          } else {
            newStatus = "red"
          }
        } else {
          // Emergency vehicle is approaching - override normal cycle

          // If vehicle is approaching (within 300 meters), turn light green
          if (closestDistance < 0.3) {
            newStatus = "green"

            // If this is a status change, add an alert
            if (light.status !== "green") {
              setAlerts((prev: string[]) => [
                `Traffic light ${light.id} changed to GREEN for emergency vehicle`,
                ...prev.slice(0, 4),
              ])
            }
          }
          // If vehicle is within 600 meters, turn light yellow to prepare
          else if (closestDistance < 0.6) {
            // Only change to yellow if it's currently red
            if (light.status === "red") {
              newStatus = "yellow"

              setAlerts((prev: string[]) => [
                `Traffic light ${light.id} preparing for emergency vehicle approach`,
                ...prev.slice(0, 4),
              ])
            }
          }
        }

        return { ...light, status: newStatus }
      })
    })
  }, [vehicles])

  // Update route information based on current vehicle position and animation progress
  const updateRouteInfo = useCallback(() => {
    if (vehicles.length === 0 || !vehicles[0].route || vehicles[0].route.length === 0) return;

    const mainVehicle = vehicles[0];
    const { route, currentStep } = mainVehicle;
    const totalRoutePoints = route.length;
    
    // Calculate progress as a percentage (0-1)
    const progressPercentage = Math.min(currentStep / (totalRoutePoints - 1), 1);
    
    // Calculate remaining time based on fixed 45-second duration
    const totalDuration = 45; // seconds
    const elapsedTime = progressPercentage * totalDuration;
    const remainingDuration = Math.max(0, totalDuration - elapsedTime);
    
    // Calculate remaining distance based on progress
    let remainingDistance = 0;
    for (let i = currentStep; i < route.length - 1; i++) {
      remainingDistance += calculateDistance(route[i], route[i + 1]);
    }

    // Calculate time saved due to traffic light control
    // Count the number of green lights along the route
    const greenLights = trafficLights.filter((light: TrafficLight) => light.status === "green").length;
    const savedTime = greenLights * 2; // Each green light saves about 2 seconds in our simulation

    setRouteInfo((prev: RouteInfo) => ({
      ...prev,
      remainingDistance,
      remainingDuration,
      savedTime: prev.savedTime + (greenLights > 0 ? 0.5 : 0), // Increment saved time if there are green lights
    }));

    // Show progress updates at 25%, 50%, and 75% completion
    if (
      (progressPercentage >= 0.25 && progressPercentage < 0.26) ||
      (progressPercentage >= 0.5 && progressPercentage < 0.51) ||
      (progressPercentage >= 0.75 && progressPercentage < 0.76)
    ) {
      const progressPercent = Math.round(progressPercentage * 100);
      setAlerts((prev: string[]) => [
        `${progressPercent}% complete! Estimated arrival in ${formatTime(remainingDuration)}. ${
          routeInfo.savedTime > 0 ? `Saved ${routeInfo.savedTime.toFixed(1)} seconds with smart traffic control.` : ""
        }`,
        ...prev.slice(0, 4),
      ]);
    }
  }, [vehicles, trafficLights, formatTime]);

  // Start the animation loop for the simulation
  const startSimulationAnimation = useCallback(() => {
    console.log("Starting simulation animation", { 
      vehiclesCount: vehicles.length,
      isSimulationActive,
      waypoints: routeWaypoints.length
    });
    
    // Make sure we have a vehicle to animate - create a fallback if needed
    if (vehicles.length === 0) {
      console.log("No vehicles found, creating a test vehicle");
      
      // Create a minimal route if no route exists - just a direct line between start and destination
      if (window.startLocation) {
        console.log("Using window.startLocation as start point");
        
        // Find an end point - either from waypoints or create a dummy destination
        let endPoint;
        if (routeWaypoints.length > 0) {
          endPoint = routeWaypoints[routeWaypoints.length - 1];
          console.log("Using last waypoint as end point");
        } else {
          // Create a dummy end point if no waypoints exist
          // This moves the vehicle ~1km east and north of start
          endPoint = {
            lat: window.startLocation.lat + 0.01, 
            lng: window.startLocation.lng + 0.01
          };
          console.log("Created dummy end point:", endPoint);
          
          // Add this point to routeWaypoints
          setRouteWaypoints([window.startLocation, endPoint]);
        }
        
        // Create minimum viable route
        const testRoute = [window.startLocation, endPoint];
        
        const testVehicle: EmergencyVehicle = {
          id: "test-ambulance",
          position: window.startLocation,
          route: testRoute,
          currentStep: 0,
          color: VEHICLE_COLORS[0],
        };
        
        // Create a dummy traffic light
        const dummyLight: TrafficLight = {
          id: "light-1",
          position: {
            lat: (window.startLocation.lat + endPoint.lat) / 2,
            lng: (window.startLocation.lng + endPoint.lng) / 2
          },
          status: "red"
        };
        
        setTrafficLights([dummyLight]);
        setVehicles([testVehicle]);
        console.log("Created test vehicle and traffic light");
        
        // Set a basic route info
        setRouteInfo({
          distance: calculateDistance(window.startLocation, endPoint),
          duration: 45, // Our fixed duration
          remainingDistance: calculateDistance(window.startLocation, endPoint),
          remainingDuration: 45,
          savedTime: 0
        });
      } else {
        console.error("Cannot create test vehicle without start point");
        return;
      }
    }
    
    // Clear any existing interval
    if (simulationInterval) {
      clearInterval(simulationInterval)
    }

    // Set fixed animation parameters to complete in exactly 45 seconds
    const totalDurationMs = 45 * 1000; // 45 seconds in milliseconds
    const updateIntervalMs = 100; // Update every 100ms for smoother animation
    const totalUpdateSteps = totalDurationMs / updateIntervalMs;
    
    let currentAnimationStep = 0;

    // Add initial alert
    setAlerts((prev) => [
      "IMPORTANT: Emergency simulation started - vehicle is now moving",
      ...prev.slice(0, 4),
    ]);

    // Start the simulation with a clear console message
    console.log(`Animation will run for ${totalDurationMs/1000} seconds with ${totalUpdateSteps} steps`);
    
    const interval = setInterval(() => {
      currentAnimationStep++;
      
      // Calculate animation progress (0 to 1)
      const progress = currentAnimationStep / totalUpdateSteps;
      
      // Log progress every 10% for debugging
      if (currentAnimationStep % Math.ceil(totalUpdateSteps/10) === 0) {
        console.log(`Animation progress: ${(progress * 100).toFixed(1)}%`);
      }
      
      // If we've reached the end, make sure vehicles are at final position
      if (progress >= 1) {
        console.log("Animation complete - vehicle reached destination");
        setVehicles((prevVehicles) => {
          return prevVehicles.map((vehicle) => ({
            ...vehicle,
            position: vehicle.route[vehicle.route.length - 1],
            currentStep: vehicle.route.length - 1,
          }));
        });
        
        // Add completion notification
        setAlerts((prev) => [
          "IMPORTANT: Emergency vehicle has reached destination!",
          ...prev.slice(0, 4),
        ]);
        
        // Update traffic lights and route info one last time
        updateTrafficLights();
        updateRouteInfo();
        
        // Clear the interval
        clearInterval(interval);
        setSimulationInterval(null);
        return;
      }

      setVehicles((prevVehicles: EmergencyVehicle[]) => {
        // Update each vehicle
        const updatedVehicles = prevVehicles.map((vehicle: EmergencyVehicle) => {
          const { route } = vehicle;

          // Calculate exact position along the route based on progress
          const exactStep = progress * (route.length - 1);
          const currentStep = Math.floor(exactStep);
          const nextStep = Math.min(currentStep + 1, route.length - 1);
          
          // Interpolate between current and next point for smoother movement
          const stepProgress = exactStep - currentStep;
          const newPosition = {
            lat: route[currentStep].lat + (route[nextStep].lat - route[currentStep].lat) * stepProgress,
            lng: route[currentStep].lng + (route[nextStep].lng - route[currentStep].lng) * stepProgress,
          };

          // Check if approaching a traffic light
          const upcomingLights = trafficLights.filter((light: TrafficLight) => {
            const distanceToLight = calculateDistance(newPosition, light.position);
            return distanceToLight < 0.3; // 300 meters
          });

          // Add alerts for upcoming traffic lights
          if (upcomingLights.length > 0 && currentAnimationStep % 20 === 0) {
            setAlerts((prev: string[]) => [
              `Traffic light ahead in ${(calculateDistance(newPosition, upcomingLights[0].position) * 1000).toFixed(0)}m - preparing to change signal`,
              ...prev.slice(0, 4), // Keep only the 5 most recent alerts
            ]);
          }

          // If we're at a step with directions, add an alert
          if (currentAnimationStep % 40 === 0 && directions.length > 0) {
            const directionIndex = Math.floor(progress * directions.length);
            if (directionIndex < directions.length) {
              setAlerts((prev: string[]) => [`Next direction: ${directions[directionIndex]}`, ...prev.slice(0, 4)]);
            }
          }

          // If we're at a highlighted waypoint, add a special alert
          if (routeWaypoints.length > 0) {
            const isAtWaypoint = routeWaypoints.some(
              (waypoint: google.maps.LatLngLiteral) =>
                Math.abs(waypoint.lat - newPosition.lat) < 0.0001 && Math.abs(waypoint.lng - newPosition.lng) < 0.0001,
            );

            if (isAtWaypoint && directions.length > 0) {
              const directionIndex = Math.floor(progress * directions.length);
              if (directionIndex < directions.length) {
                setAlerts((prev: string[]) => [`IMPORTANT: ${directions[directionIndex]}`, ...prev.slice(0, 4)]);
              }
            }
          }

          return {
            ...vehicle,
            position: newPosition,
            currentStep: Math.floor(exactStep),
          };
        });

        return updatedVehicles;
      });

      // Update traffic lights based on vehicle positions
      updateTrafficLights();

      // Update route information with progress-based calculations
      updateRouteInfo();
      
    }, updateIntervalMs);

    setSimulationInterval(interval);
  }, [directions, trafficLights, routeWaypoints, updateTrafficLights, updateRouteInfo, simulationInterval]);

  // Request a route from Google Maps Directions Service
  const requestRoute = useCallback(
    (
      origin: google.maps.LatLngLiteral,
      destination: google.maps.LatLngLiteral,
      callback: (route: google.maps.LatLngLiteral[]) => void,
      forceAlternative = false,
    ) => {
      if (!window.google || !window.googleMap) {
        console.error("Google Maps not loaded")
        return
      }

      const directionsService = new window.google.maps.DirectionsService()

      const request: google.maps.DirectionsRequest = {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
        optimizeWaypoints: true,
        avoidHighways: forceAlternative,
        avoidTolls: forceAlternative,
      }

      directionsService.route(request, (response: any, status: any) => {
        if (status === window.google.maps.DirectionsStatus.OK && response) {
          // Choose the main route or an alternative if requested
          const routeIndex = forceAlternative && response.routes.length > 1 ? 1 : 0
          const route = response.routes[routeIndex]

          // Extract the route path
          const path = route.overview_path.map((point: any) => ({
            lat: point.lat(),
            lng: point.lng(),
          }))

          // Extract turn-by-turn directions
          const steps = route.legs[0].steps
          const directionsText = steps.map((step: any) => step.instructions.replace(/<[^>]*>/g, ""))

          // Extract waypoints for route visualization
          const waypoints: google.maps.LatLngLiteral[] = []
          steps.forEach((step: any) => {
            waypoints.push({
              lat: step.start_location.lat(),
              lng: step.start_location.lng(),
            })

            // Add path points for more detailed route
            if (step.path && step.path.length > 0) {
              step.path.forEach((point: any, index: number) => {
                // Add every 5th point to avoid too many waypoints
                if (index % 5 === 0) {
                  waypoints.push({
                    lat: point.lat(),
                    lng: point.lng(),
                  })
                }
              })
            }
          })

          // Add destination as final waypoint
          waypoints.push({
            lat: route.legs[0].end_location.lat(),
            lng: route.legs[0].end_location.lng(),
          })

          if (!forceAlternative) {
            setDirections(directionsText)
            setRouteWaypoints(waypoints)

            // Calculate and set route information
            const distance = route.legs[0].distance.value / 1000 // Convert to km
            const duration = route.legs[0].duration.value // In seconds

            setRouteInfo({
              distance,
              duration,
              remainingDistance: distance,
              remainingDuration: duration,
              savedTime: 0,
            })
          }

          callback(path)
        } else {
          console.error(`Directions request failed: ${status}`)

          // Create a fallback route with straight line between points
          createFallbackRoute(origin, destination, callback)
        }
      })
    },
    [createFallbackRoute],
  )

  useEffect(() => {
    requestRouteRef.current = requestRoute
  }, [requestRoute])

  // Parse coordinates from string input
  const parseCoordinates = useCallback((coordsString: string): google.maps.LatLngLiteral | null => {
    try {
      // Check if input might be coordinates in format "lat,lng"
      if (coordsString.includes(",")) {
        const [lat, lng] = coordsString.split(",").map((coord) => Number.parseFloat(coord.trim()))
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      }
      return null
    } catch (error) {
      console.error("Failed to parse coordinates:", error)
      return null
    }
  }, [])

  // Geocode an address to coordinates
  const geocodeAddress = useCallback(async (address: string): Promise<google.maps.LatLngLiteral | null> => {
    if (!window.google) {
      console.error("Google Maps not loaded")
      return null
    }

    try {
      const geocoder = new window.google.maps.Geocoder()
      const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode({ address: `${address}, Chandigarh, India` }, (results: any, status: any) => {
          if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
            resolve(results)
          } else {
            reject(new Error(`Geocoding failed: ${status}`))
          }
        })
      })

      const location = result[0].geometry.location
      return { lat: location.lat(), lng: location.lng() }
    } catch (error) {
      console.error("Geocoding error:", error)
      return null
    }
  }, [])

  // Add a new ambulance to the simulation
  const addAmbulance = useCallback(() => {
    if (!isSimulationActive || vehicles.length === 0) return

    // Create a slightly different route for the new ambulance
    const mainRoute = vehicles[0].route
    if (mainRoute.length < 2) return

    // Get start and end points from the main route
    const startPoint = mainRoute[0]
    const endPoint = mainRoute[mainRoute.length - 1]

    // Request a new route with a different waypoint to create a conflict
    requestRouteRef.current(
      startPoint,
      endPoint,
      (newRoute: google.maps.LatLngLiteral[]) => {
        const newVehicleId = `ambulance-${vehicles.length + 1}`
        const vehicleColor = VEHICLE_COLORS[vehicles.length % VEHICLE_COLORS.length]

        setVehicles((prev: EmergencyVehicle[]) => [
          ...prev,
          {
            id: newVehicleId,
            position: newRoute[0],
            route: newRoute,
            currentStep: 0,
            color: vehicleColor,
          },
        ])

        // Add alert about new ambulance
        setAlerts((prev: string[]) => [`New emergency vehicle ${newVehicleId} added to the system`, ...prev])
      },
      true, // Force alternative route
    )
  }, [isSimulationActive, vehicles])

  // Reset the simulation
  const resetSimulation = useCallback(() => {
    if (simulationInterval) {
      clearInterval(simulationInterval)
    }

    setVehicles([])
    setTrafficLights([])
    setSimulationInterval(null)
    setIsSimulationActive(false)
    setDirections([])
    setAlerts([])
    setCurrentDestination("")
    setRouteWaypoints([])
    setRouteInfo({
      distance: 0,
      duration: 0,
      remainingDistance: 0,
      remainingDuration: 0,
      savedTime: 0,
    })
  }, [simulationInterval])

  // Start the simulation with a new route
  const startSimulation = useCallback(
    async (startPointInput?: string, destinationInput?: string) => {
      console.log("startSimulation called with:", { startPointInput, destinationInput });
      
      if (!destinationInput) {
        alert("Please enter a destination")
        return
      }
      
      if (!window.google || !window.googleMap) {
        console.error("Google Maps not loaded")
        return
      }

      try {
        // Reset any existing simulation
        resetSimulation()
        console.log("Simulation reset completed");

        // Get the start coordinates
        // Use the marker position from the map as the default start point if available
        let startCoords: google.maps.LatLngLiteral | null = null;
        
        if (startPointInput) {
          // Parse the start point if provided
          startCoords = parseCoordinates(startPointInput);
          console.log("Parsed start coordinates:", startCoords);
          
          if (!startCoords) {
            console.log("Trying geocoding for start point");
            startCoords = await geocodeAddress(startPointInput);
          }
        } else if (window.startLocation) {
          // Use the marker position as start coordinates
          startCoords = window.startLocation;
          console.log("Using window.startLocation:", startCoords);
        }

        // Parse or geocode the destination
        let destCoords = parseCoordinates(destinationInput)
        console.log("Parsed destination coordinates:", destCoords);
        
        if (!destCoords) {
          console.log("Trying geocoding for destination");
          destCoords = await geocodeAddress(destinationInput)
        }

        // If we couldn't get coordinates, show an error
        if (!startCoords || !destCoords) {
          alert("Could not determine coordinates for the start point or destination. Please try different locations.")
          console.error("Missing coordinates:", { startCoords, destCoords });
          return
        }

        console.log("Final coordinates:", { startCoords, destCoords });
        
        // Store the destination for display
        setCurrentDestination(destinationInput)

        // Request a route from Google Maps
        console.log("Requesting route...");
        requestRouteRef.current(startCoords, destCoords, (path: google.maps.LatLngLiteral[]) => {
          console.log("Route received with", path.length, "points");
          
          // Generate traffic lights along the route
          const lights = generateTrafficLights(path)
          console.log("Generated", lights.length, "traffic lights");
          setTrafficLights(lights)

          // Create the first ambulance
          const newVehicle: EmergencyVehicle = {
            id: "ambulance-1",
            position: path[0],
            route: path,
            currentStep: 0,
            color: VEHICLE_COLORS[0],
          }
          
          console.log("Creating emergency vehicle:", newVehicle);
          setVehicles([newVehicle])
          
          // This is critical - set simulation active before starting animation
          setIsSimulationActive(true)
          console.log("Set simulation active: true");

          // Start the simulation animation
          startSimulationAnimation()
          console.log("Simulation animation started");

          // Add initial alerts
          setAlerts([
            "Emergency route activated",
            "Traffic lights along route will be controlled",
            `Route distance: ${routeInfo.distance.toFixed(2)} km, estimated time: ${formatTime(routeInfo.duration)}`,
          ])

          // Try to use the Navigation SDK if available
          initializeNavigationSDK(path)
        })
      } catch (error) {
        console.error("Error starting simulation:", error)
        alert("Failed to start simulation. Please try different locations.")
      }
    },
    [
      generateTrafficLights,
      resetSimulation,
      geocodeAddress,
      parseCoordinates,
      startSimulationAnimation,
      formatTime,
      initializeNavigationSDK,
      routeInfo.distance,
      routeInfo.duration,
    ],
  )

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (simulationInterval) {
        clearInterval(simulationInterval)
      }
    }
  }, [simulationInterval])

  return {
    route,
    vehiclePosition,
    vehicles,
    trafficLights,
    isSimulationActive,
    directions,
    alerts,
    currentDestination,
    routeInfo,
    startSimulation,
    resetSimulation,
    addAmbulance,
  }
}

// Helper function to calculate distance between two points in kilometers
function calculateDistance(point1: google.maps.LatLngLiteral, point2: google.maps.LatLngLiteral): number {
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

