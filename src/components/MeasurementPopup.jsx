import { Camera, Clock, Scale, Droplet, X, AlertCircle } from "lucide-react";

export default function MeasurementPopup({ measurement, patients, onAssign, onClose, loading }) {
  if (!measurement) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-white/20 p-3 rounded-lg mr-4">
                <Camera className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">New Measurement Detected</h2>
                <p className="text-blue-100 text-sm mt-1">Received from Raspberry Pi</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Measurement Info Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-center mb-2">
                <Droplet className="h-5 w-5 text-blue-600 mr-2" />
                <p className="text-sm font-semibold text-blue-800">Estimated Blood Loss</p>
              </div>
              <p className="text-3xl font-bold text-blue-900">{measurement.est_ml || 0} mL</p>
            </div>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <div className="flex items-center mb-2">
                <Scale className="h-5 w-5 text-purple-600 mr-2" />
                <p className="text-sm font-semibold text-purple-800">Weight</p>
              </div>
              <p className="text-3xl font-bold text-purple-900">{measurement.weight_g || 0} g</p>
            </div>
          </div>

          {/* Image Preview */}
          {measurement.imageData && (
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <Camera className="h-5 w-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">Pad Image</h3>
              </div>
              <div className="bg-gray-100 rounded-xl p-4 border-2 border-gray-200">
                <img
                  src={measurement.imageData}
                  alt="Pad measurement"
                  className="w-full h-auto rounded-lg shadow-md"
                  style={{ maxHeight: '300px', objectFit: 'contain' }}
                />
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="mb-6 flex items-center text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <Clock className="h-4 w-4 mr-2" />
            <span>
              Received: {new Date(measurement.timestamp?.seconds ? measurement.timestamp.seconds * 1000 : Date.now()).toLocaleString()}
            </span>
          </div>

          {/* AI Processing Notice */}
          {loading && (
            <div className="mb-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 mr-3"></div>
                <div>
                  <p className="font-semibold text-yellow-800">AI Analysis in Progress</p>
                  <p className="text-sm text-yellow-700">Processing image for clot detection...</p>
                </div>
              </div>
            </div>
          )}

          {/* Patient Assignment */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-blue-600" />
              Assign to Patient
            </h3>
            
            {patients.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <p className="text-gray-600 font-medium">No active patients available</p>
                <p className="text-sm text-gray-500 mt-2">Add a patient first to assign measurements</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onAssign(p.id)}
                    disabled={loading}
                    className="w-full bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl p-4 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 group-hover:text-blue-900">
                          {p.data?.name || p.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          MRN: {p.data?.mrn || p.mrn}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Current Total Loss: {p.data?.totalLoss || 0} mL
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        (p.data?.totalLoss || 0) > 500
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {(p.data?.totalLoss || 0) > 500 ? 'High Risk' : 'Stable'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}