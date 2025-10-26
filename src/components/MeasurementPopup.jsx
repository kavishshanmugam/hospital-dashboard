import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Activity, 
  Camera, 
  Scale, 
  Clock,
  User,
  Brain,
  X,
  CheckCircle
} from 'lucide-react';

export default function MeasurementPopup({ measurement, patients, onAssign, onClose, loading }) {
  const [selected, setSelected] = useState('');
  
  useEffect(() => { 
    if (patients && patients.length) {
      setSelected(patients[0]?.id || ''); 
    }
  }, [patients]);

  if (!measurement) return null;
  
  const getRiskColor = (volume) => {
    if (volume > 100) return 'text-red-600 bg-red-50 border-red-200';
    if (volume > 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const riskColor = getRiskColor(measurement.est_ml);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-white bg-opacity-20 p-3 rounded-full mr-4">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">New Measurement Detected</h2>
                <p className="text-blue-100 text-sm">Smart Pad Box Alert</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors"
              disabled={loading}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Measurement Details */}
        <div className="p-6 space-y-4">
          {/* Device Info */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-600">
                <Scale className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Device ID:</span>
              </div>
              <span className="font-mono text-sm text-gray-900">{measurement.unitId || 'Unknown'}</span>
            </div>
          </div>

          {/* Volume Display */}
          <div className={`border-2 rounded-xl p-6 ${riskColor}`}>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Activity className="h-8 w-8 mr-3" />
                <span className="text-4xl font-bold">{measurement.est_ml?.toFixed(1)}</span>
                <span className="text-xl ml-2">mL</span>
              </div>
              <p className="text-sm font-medium">Blood Volume Detected</p>
              {measurement.weight_g && (
                <p className="text-xs mt-1 opacity-75">Weight: {measurement.weight_g}g</p>
              )}
            </div>
          </div>

          {/* Image Status */}
          <div className="flex items-center space-x-3">
            {measurement.imageUrl ? (
              <div className="flex items-center text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                <Camera className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Image captured</span>
              </div>
            ) : (
              <div className="flex items-center text-gray-500 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                <Camera className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">No image available</span>
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex items-center text-gray-600 text-sm">
            <Clock className="h-4 w-4 mr-2" />
            <span>
              {measurement.timestamp?.toDate 
                ? measurement.timestamp.toDate().toLocaleString() 
                : 'Time unknown'
              }
            </span>
          </div>

          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <User className="h-4 w-4 inline mr-2" />
              Assign to Patient:
            </label>
            <select 
              value={selected} 
              onChange={e => setSelected(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
              disabled={loading}
            >
              <option value="">Select a patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.data.name} — MRN: {p.data.mrn}
                </option>
              ))}
            </select>
          </div>

          {/* AI Analysis Status */}
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center text-blue-700">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <div>
                  <p className="font-semibold flex items-center">
                    <Brain className="h-4 w-4 mr-2" />
                    Running AI Analysis...
                  </p>
                  <p className="text-xs mt-1">Analyzing pad image for blood detection and clots</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <button 
              onClick={onClose} 
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              onClick={() => onAssign(selected)} 
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={loading || !selected}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Assign & Analyze
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}