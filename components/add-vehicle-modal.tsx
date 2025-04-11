import React, { useState, useEffect } from 'react'

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVehicle: (startPoint: string, destination: string, vehicleType: 'ambulance' | 'fire') => void;
}

export const AddVehicleModal: React.FC<AddVehicleModalProps> = ({
  isOpen,
  onClose,
  onAddVehicle
}) => {
  const [startPoint, setStartPoint] = useState("");
  const [destination, setDestination] = useState("");
  const [vehicleType, setVehicleType] = useState<'ambulance' | 'fire'>('ambulance');
  const [predefinedLocations, setPredefinedLocations] = useState<{
    name: string;
    coords: string;
  }[]>([
    { name: "Sector 17", coords: "30.7433,76.7839" },
    { name: "PGI Hospital", coords: "30.7649,76.7764" },
    { name: "Elante Mall", coords: "30.7056,76.8013" },
    { name: "Sukhna Lake", coords: "30.7426,76.8089" },
    { name: "Rock Garden", coords: "30.7512,76.8044" },
    { name: "ISBT Sector 43", coords: "30.7076,76.7913" },
    { name: "Chandigarh Railway Station", coords: "30.6798,76.8078" },
    { name: "Government Medical College", coords: "30.7372,76.7698" },
    { name: "Panjab University", coords: "30.7603,76.7664" },
    { name: "Chandigarh Airport", coords: "30.6735,76.7885" },
  ]);
  
  // Predefined conflict scenarios for demonstration
  const conflictScenarios = [
    {
      name: "Intersection Conflict",
      description: "Two ambulances crossing at a major intersection",
      start: "30.7433,76.7839", // Sector 17
      destination: "30.7372,76.7698" // Government Medical College
    },
    {
      name: "Alternate Route Demo",
      description: "Shows rerouting through alternate path",
      start: "30.7056,76.8013", // Elante Mall
      destination: "30.7512,76.8044" // Rock Garden
    },
    {
      name: "Wait Priority Demo",
      description: "One vehicle must wait at intersection",
      start: "30.6798,76.8078", // Railway Station
      destination: "30.7603,76.7664" // Panjab University
    }
  ];

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStartPoint("");
      setDestination("");
      setVehicleType('ambulance');
    }
  }, [isOpen]);

  // Handle predefined location selection
  const handleSelectPredefined = (coords: string, isStart: boolean) => {
    if (isStart) {
      setStartPoint(coords);
    } else {
      setDestination(coords);
    }
  };

  // Handle conflict scenario selection
  const handleSelectConflictScenario = (scenario: typeof conflictScenarios[0]) => {
    setStartPoint(scenario.start);
    setDestination(scenario.destination);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startPoint && destination) {
      onAddVehicle(startPoint, destination, vehicleType);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Add Emergency Vehicle</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Vehicle Type</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="vehicleType"
                  value="ambulance"
                  checked={vehicleType === 'ambulance'}
                  onChange={() => setVehicleType('ambulance')}
                  className="mr-2"
                />
                <span className="dark:text-gray-300">Ambulance</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="vehicleType"
                  value="fire"
                  checked={vehicleType === 'fire'}
                  onChange={() => setVehicleType('fire')}
                  className="mr-2"
                />
                <span className="dark:text-gray-300">Fire Truck</span>
              </label>
            </div>
          </div>

          {/* Conflict scenarios section */}
          <div className="mb-4 p-3 border rounded-md border-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-800">
            <label className="block text-sm font-medium mb-2 text-blue-700 dark:text-blue-300">
              Demonstration Scenarios
            </label>
            <p className="text-xs mb-2 text-blue-600 dark:text-blue-400">
              Select a preset scenario to demonstrate conflict resolution:
            </p>
            <div className="space-y-2">
              {conflictScenarios.map((scenario) => (
                <button
                  key={scenario.name}
                  type="button"
                  onClick={() => handleSelectConflictScenario(scenario)}
                  className="w-full text-left p-2 text-sm rounded bg-white hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white border border-blue-200 dark:border-blue-800"
                >
                  <div className="font-medium">{scenario.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {scenario.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Start Location (lat,lng)</label>
            <input
              type="text"
              value={startPoint}
              onChange={(e) => setStartPoint(e.target.value)}
              placeholder="e.g. 30.7433,76.7839"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Predefined locations:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {predefinedLocations.map(location => (
                  <button
                    key={`start-${location.name}`}
                    type="button"
                    onClick={() => handleSelectPredefined(location.coords, true)}
                    className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-100 rounded"
                  >
                    {location.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Destination (lat,lng)</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. 30.7649,76.7764"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Predefined locations:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {predefinedLocations.map(location => (
                  <button
                    key={`dest-${location.name}`}
                    type="button"
                    onClick={() => handleSelectPredefined(location.coords, false)}
                    className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-100 rounded"
                  >
                    {location.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Add Vehicle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 