import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import MeasurementPopup from "../components/MeasurementPopup";
import { 
  Users, 
  UserPlus, 
  AlertTriangle, 
  TrendingUp,
  Activity,
  Clock,
  Heart,
  PlusCircle
} from 'lucide-react';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to all patients
    const unsubPatients = onSnapshot(collection(db, "patients"), (snap) => {
      const patientsData = snap.docs.map((d) => ({ 
        id: d.id, 
        data: d.data() 
      })); 
      setPatients(patientsData);
      setLoading(false);
    });

    return () => {
      unsubPatients();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading patients...</p>
        </div>
      </div>
    );
  }
    
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Users className="h-8 w-8 mr-3 text-blue-600" />
              My Patients
            </h1>
            <p className="text-gray-600 mt-1">Nurse Dashboard - Manage your assigned patients</p>
          </div>
          <Link
            to="/add-patient"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Add Patient from EHR
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Stable Patients</p>
                <p className="text-2xl font-bold text-gray-900">
                  {patients.filter(p => (p.data.totalLoss || 0) <= 500).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center">
              <div className="bg-red-100 p-3 rounded-lg mr-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">High Blood Loss</p>
                <p className="text-2xl font-bold text-gray-900">
                  {patients.filter(p => (p.data.totalLoss || 0) > 500).length}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Measurement Popup - Always rendered for WebSocket connection */}
        <MeasurementPopup patients={patients} />
        
        {/* Patients Grid */}
        {patients.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg border-2 border-dashed border-gray-300">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Patients Assigned</h3>
            <p className="text-gray-500 mb-6">You don't have any patients assigned to you yet.</p>
            <Link
              to="/add-patient"
              className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Add Your First Patient
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {patients.map((p) => {
              const totalLoss = p.data.totalLoss || 0;
              const isHighRisk = totalLoss > 500;
              
              return (
                <Link
                  to={`/patients/${p.id}`}
                  key={p.id}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-transparent hover:border-blue-500 group"
                >
                  <div className="p-6">
                    {/* Patient Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {p.data.name}
                        </h2>
                        <p className="text-sm text-gray-500">MRN: {p.data.mrn}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isHighRisk 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {isHighRisk ? 'High Risk' : 'Stable'}
                      </div>
                    </div>
                    
                    {/* Patient Info */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        DOB: {p.data.dob}
                      </div>
                      {p.data.bloodType && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Heart className="h-4 w-4 mr-2" />
                          Blood Type: {p.data.bloodType}
                        </div>
                      )}
                    </div>
                    
                    {/* Blood Loss Display */}
                    <div className={`rounded-lg p-4 text-center ${
                      isHighRisk 
                        ? 'bg-red-50 border-2 border-red-200' 
                        : 'bg-green-50 border-2 border-green-200'
                    }`}>
                      <p className={`text-sm font-semibold mb-1 ${
                        isHighRisk ? 'text-red-600' : 'text-green-600'
                      }`}>
                        Total Blood Loss
                      </p>
                      <p className={`text-3xl font-extrabold ${
                        isHighRisk ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {totalLoss} mL
                      </p>
                      {isHighRisk && (
                        <p className="text-xs text-red-600 mt-1 flex items-center justify-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Requires attention
                        </p>
                      )}
                    </div>

                    {/* View Details Button */}
                    <div className="mt-4 flex items-center justify-center text-blue-600 text-sm font-medium group-hover:text-blue-700">
                      <Activity className="h-4 w-4 mr-1" />
                      View Details
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}