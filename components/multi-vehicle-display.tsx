import React from 'react';
import { Vehicle } from '@/services/vehicle-manager';
import { VehicleMarker } from './vehicle-marker';

interface MultiVehicleDisplayProps {
  vehicles: Vehicle[];
  isDarkMode: boolean;
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
}

export const MultiVehicleDisplay: React.FC<MultiVehicleDisplayProps> = ({ 
  vehicles,
  isDarkMode,
  selectedVehicleId,
  onSelectVehicle
}) => {
  // Only render if there are vehicles
  if (!vehicles || vehicles.length === 0) return null;

  return (
    <>
      {vehicles.map((vehicle) => (
        <VehicleMarker
          key={vehicle.id}
          vehicle={vehicle}
          isSelected={selectedVehicleId === vehicle.id}
          onSelect={onSelectVehicle}
        />
      ))}
    </>
  );
};

export const VehicleStatusIndicator: React.FC<{
  vehicle: Vehicle;
  isDarkMode: boolean;
}> = ({ vehicle, isDarkMode }) => {
  const statusColor = 
    vehicle.status === 'waiting' ? 'bg-yellow-500' :
    vehicle.status === 'completed' ? 'bg-green-500' :
    vehicle.conflictDetected ? 'bg-red-500' :
    'bg-blue-500';

  return (
    <div 
      className={`fixed bottom-4 left-4 z-20 p-3 rounded-lg shadow-lg ${
        isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
      }`}
    >
      <div className="text-sm font-semibold mb-1">
        Vehicle {vehicle.id.substring(0, 4)} Status
      </div>
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
        <span className="text-xs capitalize">
          {vehicle.status}
          {vehicle.conflictDetected && ' (Conflict Detected)'}
          {vehicle.routeModified && ' (Route Modified)'}
        </span>
      </div>
      <div className="text-xs mt-1">
        Progress: {vehicle.progress.toFixed(0)}%
      </div>
      {vehicle.waitingFor && (
        <div className="text-xs mt-1">
          Waiting for: Vehicle {vehicle.waitingFor.substring(0, 4)}
        </div>
      )}
    </div>
  );
}; 