import { useEffect, useState } from "react";
import { db } from "../config/firebase";
import { collection, doc, updateDoc, addDoc } from "firebase/firestore";
import { io } from "socket.io-client";
import { X, Droplet, Scale, Clock, Camera, AlertCircle, CheckCircle, User } from 'lucide-react';

const RASPBERRY_PI_URL = "http://172.20.10.3:8000";

export default function MeasurementPopup({ patients, onClose }) {
  const [pendingMeasurement, setPendingMeasurement] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Initialize WebSocket connection
  useEffect(() => {
    console.log('🔌 Connecting to Raspberry Pi...');
    const newSocket = io(RASPBERRY_PI_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to Raspberry Pi');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from Raspberry Pi');
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔴 Connection error:', error);
      setConnectionStatus('error');
    });

    // Listen for new measurements
    newSocket.on('new_measurement', (data) => {
      console.log('📊 New measurement received:', data);
      
      // Convert timestamp to Firestore format
      const measurement = {
        ...data,
        timestamp: new Date(data.timestamp * 1000),
        assigned: false
      };
      
      setPendingMeasurement(measurement);
    });

    setSocket(newSocket);

    return () => {
      console.log('👋 Disconnecting from Raspberry Pi');
      newSocket.close();
    };
  }, []);

  const assignToPatient = async (patientId) => {
    if (!pendingMeasurement || assigning) return;
    
    setAssigning(true);
    
    try {
      console.log(`📝 Assigning measurement to patient ${patientId}`);
      
      // Add measurement to patient's subcollection
      const measurementData = {
        est_ml: pendingMeasurement.est_ml,
        weight_g: pendingMeasurement.weight_g,
        timestamp: pendingMeasurement.timestamp,
        imageUrl: pendingMeasurement.imageUrl || null,
        raw: pendingMeasurement.raw
      };
      
      await addDoc(
        collection(db, "patients", patientId, "measurements"),
        measurementData
      );
      
      console.log('✅ Measurement assigned successfully');
      
      // Close popup
      setPendingMeasurement(null);
      if (onClose) onClose();
      
    } catch (error) {
      console.error("❌ Error assigning measurement:", error);
      alert("Failed to assign measurement. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  const dismissMeasurement = () => {
    setPendingMeasurement(null);
    if (onClose) onClose();
  };

  // Connection status indicator (always visible in corner)
  const StatusIndicator = () => (
    <div className="fixed bottom-4 left-4 z-40 bg-white rounded-lg shadow-lg px-3 py-2 flex items-center space-x-2 border-2" 
         style={{
           borderColor: connectionStatus === 'connected' ? '#10b981' : 
                       connectionStatus === 'error' ? '#ef4444' : '#6b7280'
         }}>
      <div className={`w-2 h-2 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
        connectionStatus === 'error' ? 'bg-red-500' : 
        'bg-gray-400'
      }`} />
      <span className="text-xs font-medium text-gray-700">
        {connectionStatus === 'connected' ? 'Scale Connected' : 
         connectionStatus === 'error' ? 'Scale Error' : 
         'Connecting...'}
      </span>
    </div>
  );

  // Don't show popup if no pending measurement
  if (!pendingMeasurement) {
    return <StatusIndicator />;
  }

  return (
    <>
      <StatusIndicator />
      
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-white bg-opacity-20 p-3 rounded-lg mr-4">
                  <Droplet className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">New Measurement Detected</h2>
                  <p className="text-blue-100 mt-1 flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {new Date(pendingMeasurement.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={dismissMeasurement}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Measurement Details */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                <div className="flex items-center mb-2">
                  <Droplet className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-sm font-medium text-gray-600">Blood Loss</span>
                </div>
                <p className="text-3xl font-bold text-red-600">{pendingMeasurement.est_ml} mL</p>
              </div>
              
              <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                <div className="flex items-center mb-2">
                  <Scale className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-gray-600">Weight</span>
                </div>
                <p className="text-3xl font-bold text-blue-600">{pendingMeasurement.weight_g} g</p>
              </div>
              
              <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-500">
                <div className="flex items-center mb-2">
                  <Camera className="h-5 w-5 text-purple-600 mr-2" />
                  <span className="text-sm font-medium text-gray-600">Image</span>
                </div>
                <p className="text-lg font-semibold text-purple-600">
                  {pendingMeasurement.imageUrl ? '✓ Captured' : '✗ No Image'}
                </p>
              </div>
            </div>

            {/* Image Preview */}
            {pendingMeasurement.imageUrl && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Captured Image:</p>
                <div className="bg-white p-2 rounded-xl shadow-sm">
                  <img 
                    src={pendingMeasurement.imageUrl} 
                    alt="Pad measurement" 
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Patient Selection */}
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <User className="h-6 w-6 mr-2 text-blue-600" />
              Assign to Patient
            </h3>
            
            {patients.length === 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                <p className="text-yellow-800 font-medium">No active patients available</p>
                <p className="text-sm text-yellow-600 mt-2">Please add a patient first before assigning measurements</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                {patients.map((patient) => {
                  const patientData = patient.data;
                  const totalLoss = patientData.totalLoss || 0;
                  const isHighRisk = totalLoss > 500;
                  
                  return (
                    <button
                      key={patient.id}
                      onClick={() => assignToPatient(patient.id)}
                      disabled={assigning}
                      className="bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-400 rounded-xl p-4 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {patientData.name}
                          </h4>
                          <p className="text-sm text-gray-500">MRN: {patientData.mrn}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          isHighRisk 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {isHighRisk ? 'High Risk' : 'Stable'}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          DOB: {patientData.dob}
                        </div>
                        <div className={`font-bold ${
                          isHighRisk ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {totalLoss} mL
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center justify-center text-blue-600 text-sm font-medium group-hover:text-blue-700">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {assigning ? 'Assigning...' : 'Assign to this patient'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Select a patient to assign this measurement
            </p>
            <button
              onClick={dismissMeasurement}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </>
  );
}