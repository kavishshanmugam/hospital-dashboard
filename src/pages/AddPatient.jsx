import React, { useState, useEffect } from "react";
import { ehrPatients, mockUsers } from "../utils/ehrDummyData";
import { db } from "../config/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { 
  UserPlus, 
  ArrowLeft, 
  Calendar,
  IdCard,
  Stethoscope,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AddPatient() {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingMrns, setExistingMrns] = useState(new Set());
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const navigate = useNavigate();

  // Check for existing MRNs when component mounts
  React.useEffect(() => {
    const checkExistingPatients = async () => {
      setCheckingDuplicates(true);
      try {
        const patientsSnapshot = await getDocs(collection(db, "patients"));
        const mrns = new Set();
        patientsSnapshot.forEach(doc => {
          if (doc.data().mrn) {
            mrns.add(doc.data().mrn);
          }
        });
        setExistingMrns(mrns);
      } catch (error) {
        console.error("Error checking existing patients:", error);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    checkExistingPatients();
  }, []);

  const handleAdd = async () => {
    if (!selected) return;
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Check if patient with same MRN already exists
      const patientsQuery = query(
        collection(db, "patients"),
        where("mrn", "==", selected.mrn)
      );
      
      const querySnapshot = await getDocs(patientsQuery);
      
      if (!querySnapshot.empty) {
        setError(`Patient with MRN ${selected.mrn} already exists in the system.`);
        setLoading(false);
        return;
      }

      // For demo: Use mock user instead of Firebase auth
      const user = mockUsers[0]; // nurse user
      
      const patientData = {
        ...selected,
        createdAt: new Date(),
        totalLoss: 0,
        assignedNurse: user.uid,
        assignedNurseName: user.name,
        status: 'active',
        lastUpdated: new Date()
      };

      await addDoc(collection(db, "patients"), patientData);
      
      setSuccess(`Successfully added ${selected.name} to your patient list`);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate("/patients");
      }, 2000);

    } catch (error) {
      console.error("Error adding patient:", error);
      setError("Failed to add patient. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/patients"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Patients
          </Link>
          
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg mr-4">
              <UserPlus className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add Patient from EHR</h1>
              <p className="text-gray-600 mt-1">Select a patient from Electronic Health Records to assign to your care</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* EHR Patients List */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center">
              <Stethoscope className="h-5 w-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Available Patients in EHR</h2>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {ehrPatients.map((patient, index) => {
                const isSelected = selected?.mrn === patient.mrn;
                const isExisting = existingMrns.has(patient.mrn);
                
                return (
                  <div
                    key={index}
                    onClick={() => !isExisting && setSelected(patient)}
                    className={`border-2 rounded-xl p-6 transition-all duration-200 ${
                      isSelected 
                        ? "border-blue-500 bg-blue-50 shadow-md" 
                        : isExisting
                          ? "border-orange-300 bg-orange-50 opacity-75 cursor-not-allowed"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <div className={`w-4 h-4 rounded-full mr-3 ${
                            isSelected ? 'bg-blue-600' : 'bg-gray-300'
                          }`}></div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {patient.name}
                          </h3>
                          {isExisting && (
                            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Already Added
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className={`flex items-center text-sm ${isExisting ? 'text-orange-600' : 'text-gray-600'}`}>
                            <IdCard className={`h-4 w-4 mr-2 ${isExisting ? 'text-orange-500' : 'text-gray-400'}`} />
                            <span className="font-medium">MRN:</span>
                            <span className="ml-1">{patient.mrn}</span>
                            {isExisting && (
                              <span className="ml-2 text-xs text-orange-600 font-medium">
                                (Duplicate)
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            <span className="font-medium">DOB:</span>
                            <span className="ml-1">{patient.dob}</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600">
                            <Stethoscope className="h-4 w-4 mr-2 text-gray-400" />
                            <span className="font-medium">Admission:</span>
                            <span className="ml-1">{patient.admission}</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600">
                            <AlertCircle className="h-4 w-4 mr-2 text-gray-400" />
                            <span className="font-medium">Allergies:</span>
                            <span className={`ml-1 ${
                              patient.allergies === 'None' 
                                ? 'text-green-600' 
                                : 'text-orange-600'
                            }`}>
                              {patient.allergies}
                            </span>
                          </div>

                          {patient.bloodType && (
                            <div className="flex items-center text-sm text-gray-600">
                              <div className="w-4 h-4 bg-red-100 rounded-full mr-2 flex items-center justify-center">
                                <span className="text-red-600 font-bold text-xs">A+</span>
                              </div>
                              <span className="font-medium">Blood Type:</span>
                              <span className="ml-1">{patient.bloodType}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Clinical Note:</span> {patient.note}
                          </p>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="ml-4">
                          <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
                            <CheckCircle className="h-6 w-6" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {selected && (
          <div className="mt-6 flex justify-center">
            {existingMrns.has(selected.mrn) ? (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 text-center max-w-md">
                <AlertCircle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-orange-800 font-medium">
                  This patient cannot be added
                </p>
                <p className="text-sm text-orange-600 mt-1">
                  Patient with MRN {selected.mrn} already exists in the system
                </p>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                disabled={loading || checkingDuplicates}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center text-lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Adding Patient...
                  </>
                ) : checkingDuplicates ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Checking for Duplicates...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-6 w-6 mr-3" />
                    Add {selected.name} to My Patients
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* No Selection Message */}
        {!selected && (
          <div className="mt-6 text-center">
            <div className="bg-gray-100 rounded-xl p-8 border-2 border-dashed border-gray-300">
              <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Select a patient from list above</p>
              <p className="text-sm text-gray-500 mt-1">Click on a patient card to make your selection</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}