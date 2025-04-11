import { nanoid } from "nanoid";

export interface Vehicle {
  id: string;
  type: 'ambulance' | 'fire';
  startPoint: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  currentPosition: google.maps.LatLngLiteral;
  route: google.maps.LatLngLiteral[];
  routePoints: google.maps.LatLngLiteral[];
  progress: number;
  status: 'active' | 'waiting' | 'completed';
  waitingFor?: string; // ID of vehicle it's waiting for
  alternateRoute?: google.maps.LatLngLiteral[];
  onOriginalRoute: boolean;
  steps: Array<{
    instruction: string;
    distance: string;
    maneuver?: string;
    completed: boolean;
  }>;
  currentStepIndex: number;
  conflictDetected: boolean;
  routeModified: boolean;
}

export interface Intersection {
  position: google.maps.LatLngLiteral;
  vehicles: string[]; // IDs of vehicles approaching this intersection
  timeToIntersection: { [vehicleId: string]: number }; // Estimated seconds to reach intersection
}

export class VehicleManager {
  private vehicles: Map<string, Vehicle> = new Map();
  private intersections: Intersection[] = [];
  private cachedAlternateRoutes: Map<string, google.maps.LatLngLiteral[]> = new Map();

  constructor() {}

  public addVehicle(
    type: 'ambulance' | 'fire',
    startPoint: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral,
    route: google.maps.LatLngLiteral[],
    steps: Array<{
      instruction: string;
      distance: string;
      maneuver?: string;
      completed: boolean;
    }> = []
  ): string {
    const id = nanoid();
    
    this.vehicles.set(id, {
      id,
      type,
      startPoint,
      destination,
      currentPosition: { ...startPoint },
      route,
      routePoints: [...route],
      progress: 0,
      status: 'active',
      onOriginalRoute: true,
      steps,
      currentStepIndex: 0,
      conflictDetected: false,
      routeModified: false
    });
    
    return id;
  }

  public getVehicle(id: string): Vehicle | undefined {
    return this.vehicles.get(id);
  }

  public getAllVehicles(): Vehicle[] {
    return Array.from(this.vehicles.values());
  }
  
  public getActiveVehicles(): Vehicle[] {
    return this.getAllVehicles().filter(v => v.status !== 'completed');
  }

  public updateVehiclePosition(
    id: string, 
    position: google.maps.LatLngLiteral,
    progress: number,
    currentStepIndex?: number
  ): Vehicle | undefined {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return undefined;

    vehicle.currentPosition = position;
    vehicle.progress = progress;
    
    if (currentStepIndex !== undefined) {
      vehicle.currentStepIndex = currentStepIndex;
      
      // Update completed steps
      vehicle.steps = vehicle.steps.map((step, idx) => ({
        ...step,
        completed: idx < currentStepIndex
      }));
    }

    // Check for conflicts when vehicle is moving (not waiting)
    if (vehicle.status === 'active') {
      this.detectAndResolveConflicts(id);
    }

    // Check if vehicle has reached destination
    if (progress >= 100) {
      vehicle.status = 'completed';
    }

    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  private detectAndResolveConflicts(vehicleId: string): void {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle || vehicle.status !== 'active') return;

    // Get all other active vehicles
    const otherVehicles = this.getActiveVehicles().filter(v => v.id !== vehicleId);
    if (otherVehicles.length === 0) return;

    // Check for potential conflicts with each vehicle
    for (const otherVehicle of otherVehicles) {
      // Skip if the other vehicle is waiting already
      if (otherVehicle.status === 'waiting') continue;

      // Calculate distance between vehicles
      const distance = this.calculateDistance(
        vehicle.currentPosition,
        otherVehicle.currentPosition
      );

      // Only consider vehicles within 0.6 km (600 meters) of each other
      if (distance > 0.6) continue;

      console.log(`Vehicles within 0.6km: ${vehicle.id} and ${otherVehicle.id} (${distance.toFixed(3)}km)`);

      // Check if vehicles will approach the same intersection
      const intersection = this.findCommonIntersection(vehicle, otherVehicle);
      if (!intersection) continue;

      console.log(`Potential conflict detected at intersection: ${JSON.stringify(intersection.position)}`);
      
      // Set conflict flag for both vehicles
      vehicle.conflictDetected = true;
      otherVehicle.conflictDetected = true;
      this.vehicles.set(otherVehicle.id, otherVehicle);

      // Try to resolve the conflict
      this.resolveConflict(vehicle, otherVehicle, intersection);
    }
  }

  private findCommonIntersection(vehicle1: Vehicle, vehicle2: Vehicle): Intersection | null {
    // Simplified: Look ahead on both routes to find if they cross at any point
    // In a real system, you'd use map data to identify actual intersections
    
    // Look ahead by about 10 points on each route
    const lookAheadPoints1 = this.getLookAheadPoints(vehicle1, 10);
    const lookAheadPoints2 = this.getLookAheadPoints(vehicle2, 10);
    
    // Check if any points are very close to each other (indicating an intersection)
    for (const point1 of lookAheadPoints1) {
      for (const point2 of lookAheadPoints2) {
        const distance = this.calculateDistance(point1, point2);
        // If points are within 30 meters, consider it a potential intersection
        if (distance < 0.03) {
          // Create or update intersection
          const intersection: Intersection = {
            position: point1, // Use point1 as the intersection point
            vehicles: [vehicle1.id, vehicle2.id],
            timeToIntersection: {}
          };
          
          // Estimate time to intersection for each vehicle
          intersection.timeToIntersection[vehicle1.id] = this.estimateTimeToPoint(vehicle1, point1);
          intersection.timeToIntersection[vehicle2.id] = this.estimateTimeToPoint(vehicle2, point2);
          
          return intersection;
        }
      }
    }
    
    return null;
  }

  private getLookAheadPoints(vehicle: Vehicle, count: number): google.maps.LatLngLiteral[] {
    const route = vehicle.onOriginalRoute ? vehicle.route : (vehicle.alternateRoute || vehicle.route);
    const currentIndex = this.findClosestPointIndex(route, vehicle.currentPosition);
    
    // Get the next 'count' points or as many as are available
    return route.slice(currentIndex, currentIndex + count);
  }

  private findClosestPointIndex(route: google.maps.LatLngLiteral[], position: google.maps.LatLngLiteral): number {
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    route.forEach((point, index) => {
      const distance = this.calculateDistance(point, position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    return closestIndex;
  }

  private estimateTimeToPoint(vehicle: Vehicle, point: google.maps.LatLngLiteral): number {
    // Simplified time estimation based on distance and assuming 40 km/h speed
    const distance = this.calculateDistance(vehicle.currentPosition, point);
    const averageSpeed = 40; // km/h
    return (distance / averageSpeed) * 3600; // Convert to seconds
  }

  private resolveConflict(vehicle1: Vehicle, vehicle2: Vehicle, intersection: Intersection): void {
    console.log(`Resolving conflict between ${vehicle1.id} and ${vehicle2.id}`);
    
    // First try to find alternate routes for both vehicles
    const alternateRoute1 = this.findAlternateRoute(vehicle1, intersection.position);
    const alternateRoute2 = this.findAlternateRoute(vehicle2, intersection.position);
    
    // If both have alternates, choose the one with shorter detour
    if (alternateRoute1 && alternateRoute2) {
      const detourDistance1 = this.calculateRouteDistance(alternateRoute1) - 
                              this.calculateRouteDistance(vehicle1.route);
      const detourDistance2 = this.calculateRouteDistance(alternateRoute2) - 
                              this.calculateRouteDistance(vehicle2.route);
      
      if (detourDistance1 <= detourDistance2) {
        this.applyAlternateRoute(vehicle1.id, alternateRoute1);
      } else {
        this.applyAlternateRoute(vehicle2.id, alternateRoute2);
      }
    }
    // If only one has an alternate, use that
    else if (alternateRoute1) {
      this.applyAlternateRoute(vehicle1.id, alternateRoute1);
    }
    else if (alternateRoute2) {
      this.applyAlternateRoute(vehicle2.id, alternateRoute2);
    }
    // If neither has an alternate, make one wait based on priority or time to intersection
    else {
      this.applyWaitingStrategy(vehicle1, vehicle2, intersection);
    }
  }

  private findAlternateRoute(vehicle: Vehicle, intersectionPoint: google.maps.LatLngLiteral): google.maps.LatLngLiteral[] | null {
    // In a real application, you would use the Google Maps Directions API to find an alternative route
    // For this simulation, we'll generate a simple detour around the intersection
    
    // Check if we have a cached alternate route
    const cacheKey = `${vehicle.id}-${intersectionPoint.lat.toFixed(4)},${intersectionPoint.lng.toFixed(4)}`;
    if (this.cachedAlternateRoutes.has(cacheKey)) {
      return this.cachedAlternateRoutes.get(cacheKey)!;
    }
    
    // Find index of point closest to intersection
    const intersectionIndex = this.findClosestPointIndex(vehicle.route, intersectionPoint);
    
    // Don't try to create alternate if too close to start or end
    if (intersectionIndex < 3 || intersectionIndex > vehicle.route.length - 3) {
      return null;
    }
    
    // Create a detour by adding a small offset to the route points around the intersection
    const alternateRoute = [...vehicle.route];
    
    // Apply an offset to 3 points before and after the intersection
    for (let i = Math.max(0, intersectionIndex - 3); i <= Math.min(vehicle.route.length - 1, intersectionIndex + 3); i++) {
      // Add a perpendicular offset
      const point = vehicle.route[i];
      
      // Random offset direction (perpendicular to route)
      const offsetDirection = Math.random() > 0.5 ? 1 : -1;
      const offsetDistance = 0.0002 + Math.random() * 0.0003; // Between 0.0002 and 0.0005 degrees
      
      // Simple perpendicular offset
      alternateRoute[i] = {
        lat: point.lat + offsetDistance * offsetDirection,
        lng: point.lng + offsetDistance * offsetDirection
      };
    }
    
    // Cache this alternate route
    this.cachedAlternateRoutes.set(cacheKey, alternateRoute);
    
    return alternateRoute;
  }
  
  private applyAlternateRoute(vehicleId: string, alternateRoute: google.maps.LatLngLiteral[]): void {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return;
    
    console.log(`Applying alternate route to vehicle ${vehicleId}`);
    
    vehicle.alternateRoute = alternateRoute;
    vehicle.onOriginalRoute = false;
    vehicle.routeModified = true;
    
    this.vehicles.set(vehicleId, vehicle);
  }

  private applyWaitingStrategy(vehicle1: Vehicle, vehicle2: Vehicle, intersection: Intersection): void {
    // Determine which vehicle should wait based on time to intersection
    const time1 = intersection.timeToIntersection[vehicle1.id] || Infinity;
    const time2 = intersection.timeToIntersection[vehicle2.id] || Infinity;
    
    if (time1 <= time2) {
      // Vehicle 1 is closer to intersection, make vehicle 2 wait
      this.makeVehicleWait(vehicle2.id, vehicle1.id);
    } else {
      // Vehicle 2 is closer to intersection, make vehicle 1 wait
      this.makeVehicleWait(vehicle1.id, vehicle2.id);
    }
  }

  private makeVehicleWait(waitingVehicleId: string, forVehicleId: string): void {
    const waitingVehicle = this.vehicles.get(waitingVehicleId);
    if (!waitingVehicle) return;
    
    console.log(`Making vehicle ${waitingVehicleId} wait for vehicle ${forVehicleId}`);
    
    waitingVehicle.status = 'waiting';
    waitingVehicle.waitingFor = forVehicleId;
    
    this.vehicles.set(waitingVehicleId, waitingVehicle);
  }

  public checkAndResumeWaitingVehicles(): void {
    const waitingVehicles = this.getAllVehicles().filter(v => v.status === 'waiting');
    
    for (const vehicle of waitingVehicles) {
      if (!vehicle.waitingFor) continue;
      
      const waitingFor = this.vehicles.get(vehicle.waitingFor);
      
      // If the vehicle it's waiting for doesn't exist or is far away or completed, resume
      if (!waitingFor || 
          waitingFor.status === 'completed' || 
          this.calculateDistance(vehicle.currentPosition, waitingFor.currentPosition) > 0.6) {
        
        console.log(`Resuming vehicle ${vehicle.id} from waiting state`);
        
        vehicle.status = 'active';
        vehicle.waitingFor = undefined;
        this.vehicles.set(vehicle.id, vehicle);
      }
    }
  }

  public returnToOriginalRoute(vehicleId: string): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle || !vehicle.alternateRoute || vehicle.onOriginalRoute) return false;
    
    // Check if the vehicle is now far enough from the conflict area
    // This is a simplified check
    if (vehicle.progress > vehicle.progress + 15) {
      console.log(`Vehicle ${vehicleId} returning to original route`);
      
      vehicle.onOriginalRoute = true;
      vehicle.alternateRoute = undefined;
      
      this.vehicles.set(vehicleId, vehicle);
      return true;
    }
    
    return false;
  }

  public removeVehicle(id: string): boolean {
    return this.vehicles.delete(id);
  }

  public clearAll(): void {
    this.vehicles.clear();
    this.intersections = [];
    this.cachedAlternateRoutes.clear();
  }

  private calculateDistance(point1: google.maps.LatLngLiteral, point2: google.maps.LatLngLiteral): number {
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
  }

  private calculateRouteDistance(route: google.maps.LatLngLiteral[]): number {
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += this.calculateDistance(route[i], route[i + 1]);
    }
    return totalDistance;
  }
} 