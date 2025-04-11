// Type definitions for Google Maps API

declare namespace google {
  namespace maps {
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    class Map {
      constructor(mapDiv: Element, opts?: MapOptions);
    }

    interface MapOptions {
      center: LatLng | LatLngLiteral;
      zoom: number;
      [key: string]: any;
    }

    class DirectionsService {
      route(
        request: DirectionsRequest,
        callback: (result: DirectionsResult, status: DirectionsStatus) => void
      ): void;
    }

    interface DirectionsRequest {
      origin: string | LatLng | LatLngLiteral | Place;
      destination: string | LatLng | LatLngLiteral | Place;
      travelMode: TravelMode;
      [key: string]: any;
    }

    interface DirectionsResult {
      routes: DirectionsRoute[];
    }

    interface DirectionsRoute {
      legs: DirectionsLeg[];
      overview_path: LatLng[];
      [key: string]: any;
    }

    interface DirectionsLeg {
      steps: DirectionsStep[];
      distance: Distance;
      duration: Duration;
      start_location: LatLng;
      end_location: LatLng;
    }

    interface DirectionsStep {
      distance: Distance;
      duration: Duration;
      instructions: string;
      path: LatLng[];
      start_location: LatLng;
      end_location: LatLng;
      [key: string]: any;
    }

    interface Distance {
      text: string;
      value: number;
    }

    interface Duration {
      text: string;
      value: number;
    }

    enum TravelMode {
      DRIVING = 'DRIVING',
      WALKING = 'WALKING',
      BICYCLING = 'BICYCLING',
      TRANSIT = 'TRANSIT'
    }

    enum DirectionsStatus {
      OK = 'OK',
      NOT_FOUND = 'NOT_FOUND',
      ZERO_RESULTS = 'ZERO_RESULTS',
      MAX_WAYPOINTS_EXCEEDED = 'MAX_WAYPOINTS_EXCEEDED',
      INVALID_REQUEST = 'INVALID_REQUEST',
      OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
      REQUEST_DENIED = 'REQUEST_DENIED',
      UNKNOWN_ERROR = 'UNKNOWN_ERROR'
    }

    class Geocoder {
      geocode(
        request: GeocoderRequest,
        callback: (results: GeocoderResult[], status: GeocoderStatus) => void
      ): void;
    }

    interface GeocoderRequest {
      address?: string;
      [key: string]: any;
    }

    interface GeocoderResult {
      geometry: {
        location: LatLng;
      };
      [key: string]: any;
    }

    enum GeocoderStatus {
      OK = 'OK',
      ZERO_RESULTS = 'ZERO_RESULTS',
      OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
      REQUEST_DENIED = 'REQUEST_DENIED',
      INVALID_REQUEST = 'INVALID_REQUEST',
      UNKNOWN_ERROR = 'UNKNOWN_ERROR'
    }

    namespace navigation {
      class Navigation {
        constructor(options: { map: Map });
        route(
          request: DirectionsRequest,
          callback: (result: any) => void
        ): void;
      }
    }

    interface Place {
      location: LatLng | LatLngLiteral;
      [key: string]: any;
    }
    
    interface MapMouseEvent {
      latLng?: LatLng;
      placeId?: string;
      [key: string]: any;
    }
  }
}

// Extend Window interface to include google maps
interface Window {
  google: typeof google;
  googleMap: google.maps.Map;
  startLocation: google.maps.LatLngLiteral;
} 