import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebase";
import { 
  Archive as ArchiveIcon, 
  Clock, 
  Users, 
  TrendingDown,
  Calendar,
  CheckCircle,
  AlertTriangle,
  FileText
} from 'lucide-react';

export default function Archive() {
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "archived_patients"), (snap) => {
      setArchived(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredArchived = archived.filter(patient =>
    patient.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPatients = filteredArchived.length;
  const avgBloodLoss = totalPatients > 0 
    ? filteredArchived.reduce((sum, p) => sum + (p.totalLoss || 0), 0) / totalPatients 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading archive...</p>
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
            <ArchiveIcon className="h-8 w-8 mr-3 text-purple-600" />
            Archived Patients
          </h1>
          <p className="text-gray-600">Discharged patients and their complete treatment records</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="bg-purple-100 p-3 rounded-lg mr-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Archived</p>
                <p className="text-3xl font-bold text-gray-900">{totalPatients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <TrendingDown className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Final Loss</p>
                <p className="text-3xl font-bold text-gray-900">{avgBloodLoss.toFixed(1)} mL</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Care</p>
                <p className="text-3xl font-bold text-gray-900">{totalPatients}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by patient name or MRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>
        </div>
        
        {/* Archived Patients Grid */}
        {filteredArchived.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300">
            <ArchiveIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {searchTerm ? 'No Patients Found' : 'Archive is Empty'}
            </h3>
            <p className="text-gray-500">
              {searchTerm 
                ? 'No archived patients match your search criteria.' 
                : 'No patients have been discharged yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArchived.map((patient) => {
              const totalLoss = patient.totalLoss || 0;
              const isHighLoss = totalLoss > 500;
              
              return (
                <div key={patient.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-gray-400 group">
                  <div className="p-6">
                    {/* Patient Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {patient.name}
                        </h3>
                        <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                      </div>
                      <div className="bg-gray-100 p-2 rounded-full">
                        <ArchiveIcon className="h-5 w-5 text-gray-600" />
                      </div>
                    </div>

                    {/* Patient Info */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        DOB: {patient.dob}
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        Discharged: {patient.dischargedAt?.toDate 
                          ? patient.dischargedAt.toDate().toLocaleDateString() 
                          : 'N/A'
                        }
                      </div>
                    </div>
                    
                    {/* Final Blood Loss */}
                    <div className={`rounded-lg p-4 text-center ${
                      isHighLoss 
                        ? 'bg-red-50 border-2 border-red-200' 
                        : 'bg-green-50 border-2 border-green-200'
                    }`}>
                      <p className={`text-sm font-semibold mb-1 ${
                        isHighLoss ? 'text-red-600' : 'text-green-600'
                      }`}>
                        Final Blood Loss
                      </p>
                      <p className={`text-3xl font-extrabold ${
                        isHighLoss ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {totalLoss} mL
                      </p>
                      
                      {isHighLoss && (
                        <p className="text-xs text-red-600 mt-1 flex items-center justify-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          High loss recorded
                        </p>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="mt-4 flex items-center justify-center">
                      <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Care Completed
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}