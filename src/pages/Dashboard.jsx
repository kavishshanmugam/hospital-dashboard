import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebase";
import { Link } from "react-router-dom";
import { 
  Users, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  Heart,
  Eye,
  ArrowRight,
  Calendar
} from 'lucide-react';

export default function Dashboard() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    highRiskPatients: 0,
    totalMeasurements: 0,
    avgBloodLoss: 0
  });

  useEffect(() => {
    // For demo: Show all patients like Patients page
    // In production, you might filter by role
    const unsub = onSnapshot(collection(db, "patients"), (snap) => {
      const patientsData = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPatients(patientsData);
      
      // Calculate stats
      const totalPatients = patientsData.length;
      const highRiskPatients = patientsData.filter(p => (p.totalLoss || 0) > 500).length;
      const totalMeasurements = patientsData.reduce((sum, p) => sum + (p.measurementCount || 0), 0);
      const avgBloodLoss = totalPatients > 0 
        ? patientsData.reduce((sum, p) => sum + (p.totalLoss || 0), 0) / totalPatients 
        : 0;

      setStats({
        totalPatients,
        highRiskPatients,
        totalMeasurements,
        avgBloodLoss: avgBloodLoss.toFixed(1)
      });
      
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading clinical overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center">
            <Activity className="h-8 w-8 mr-3 text-blue-600" />
            Clinical Overview
          </h1>
          <p className="text-gray-600">Real-time monitoring dashboard for postpartum care</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalPatients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
            <div className="flex items-center">
              <div className="bg-red-100 p-3 rounded-lg mr-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">High Risk</p>
                <p className="text-3xl font-bold text-gray-900">{stats.highRiskPatients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Measurements</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalMeasurements}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="bg-purple-100 p-3 rounded-lg mr-4">
                <Heart className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Blood Loss</p>
                <p className="text-3xl font-bold text-gray-900">{stats.avgBloodLoss} mL</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recent Measurements */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-blue-500" />
                Recent Activity
              </h2>
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            
            <div className="space-y-3">
              {patients.slice(0, 5).map((patient) => (
                <div key={patient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center">
                    <div className="bg-blue-100 p-2 rounded-full mr-3">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{patient.name}</p>
                      <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      (patient.totalLoss || 0) > 500 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {(patient.totalLoss || 0)} mL
                    </p>
                    <p className="text-xs text-gray-500">Total loss</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Eye className="h-5 w-5 mr-2 text-purple-500" />
              Quick Actions
            </h2>
            
            <div className="space-y-3">
              <Link
                to="/patients"
                className="flex items-center justify-between p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group"
              >
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="font-medium text-gray-900">View All Patients</span>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </Link>

              <Link
                to="/add-patient"
                className="flex items-center justify-between p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors group"
              >
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-green-600 mr-3" />
                  <span className="font-medium text-gray-900">Add New Patient</span>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-600 transition-colors" />
              </Link>

              <Link
                to="/archive"
                className="flex items-center justify-between p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group"
              >
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-purple-600 mr-3" />
                  <span className="font-medium text-gray-900">View Archive</span>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
        
        {/* Patients Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Active Patients</h2>
            <Link
              to="/patients"
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center"
            >
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          
          {patients.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Active Patients</h3>
              <p className="text-gray-500 mb-6">There are currently no patients in the system.</p>
              <Link
                to="/add-patient"
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                Add First Patient
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {patients.map((p) => {
                const totalLoss = p.totalLoss || 0;
                const isHighRisk = totalLoss > 500;
                
                return (
                  <Link
                    to={`/patients/${p.id}`}
                    key={p.id}
                    className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-transparent hover:border-blue-500 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {p.name}
                        </h3>
                        <p className="text-sm text-gray-500">MRN: {p.mrn}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isHighRisk 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {isHighRisk ? 'High Risk' : 'Stable'}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        DOB: {p.dob}
                      </div>
                      
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
                        <p className={`text-2xl font-extrabold ${
                          isHighRisk ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {totalLoss} mL
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}