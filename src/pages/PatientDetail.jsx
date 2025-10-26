import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePadAnalysis } from '../hooks/usePadAnalysis';
import { 
  User, 
  Calendar, 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Clock,
  Heart,
  Eye,
  ArrowLeft,
  LogOut,
  Camera,
  Brain,
  CheckCircle,
  XCircle,
  FileText,
  Plus,
  Save,
  Trash2
} from 'lucide-react';

// Analysis Display Component
const AnalysisDisplay = ({ analysis }) => {
  if (!analysis) return (
    <div className="border-l-4 border-gray-300 bg-gray-50 p-4 rounded-r-lg">
      <p className="text-gray-500 italic text-sm flex items-center">
        <Brain className="w-5 h-5 mr-2 animate-pulse" />
        AI analysis running...
      </p>
    </div>
  );

  const level = analysis.riskLevel?.toLowerCase() || 'low';
  
  let borderColor = 'border-gray-400';
  let bgColor = 'bg-gray-50';
  let badgeClasses = 'text-gray-700 bg-gray-200';
  let iconColor = 'text-gray-500';

  if (level === 'low') {
    borderColor = 'border-green-500';
    bgColor = 'bg-green-50';
    badgeClasses = 'text-green-800 bg-green-100';
    iconColor = 'text-green-600';
  } else if (level === 'moderate') {
    borderColor = 'border-yellow-500';
    bgColor = 'bg-yellow-50';
    badgeClasses = 'text-yellow-800 bg-yellow-100';
    iconColor = 'text-yellow-600';
  } else if (level === 'high') {
    borderColor = 'border-red-500';
    bgColor = 'bg-red-50';
    badgeClasses = 'text-red-800 bg-red-100';
    iconColor = 'text-red-600';
  }

  return (
    <div className={`border-l-4 ${borderColor} ${bgColor} p-4 mt-3 rounded-r-lg shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <Brain className={`w-6 h-6 mr-2 ${iconColor}`} />
          <h4 className="font-bold text-lg text-gray-800">AI Analysis</h4>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${badgeClasses}`}>
          {analysis.riskLevel}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white p-2 rounded-lg">
          <p className="text-xs text-gray-500">Confidence</p>
          <p className="text-lg font-bold text-blue-600">{analysis.confidence}%</p>
        </div>
        <div className="bg-white p-2 rounded-lg">
          <p className="text-xs text-gray-500">Detection Status</p>
          <p className="text-sm font-semibold text-gray-700">
            {analysis.findings?.bloodDetected ? '✓ Blood' : '○ No Blood'}
            {analysis.findings?.clotPresence ? ' | ✓ Clots' : ''}
          </p>
        </div>
      </div>
      
      {analysis.findings?.colorAnalysis && (
        <div className="bg-white p-3 rounded-lg mb-3">
          <p className="font-semibold text-sm text-gray-700 mb-2">Color Analysis</p>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-600 font-medium">Red</span>
                <span className="font-bold">{analysis.findings.colorAnalysis.red}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{width: `${analysis.findings.colorAnalysis.red}%`}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-700 font-medium">Brown</span>
                <span className="font-bold">{analysis.findings.colorAnalysis.brown}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-amber-600 h-2 rounded-full" style={{width: `${analysis.findings.colorAnalysis.brown}%`}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-pink-600 font-medium">Pink</span>
                <span className="font-bold">{analysis.findings.colorAnalysis.pink}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-pink-500 h-2 rounded-full" style={{width: `${analysis.findings.colorAnalysis.pink}%`}}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white p-3 rounded-lg">
        <p className="font-semibold text-sm text-gray-700 mb-2">Findings</p>
        <ul className="space-y-1">
          {analysis.findings?.abnormalities?.map((item, index) => (
            <li key={index} className="text-xs text-gray-600 flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clinicalNotes, setClinicalNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const { analyze } = usePadAnalysis();

  useEffect(() => {
    const unsubPatient = onSnapshot(doc(db, "patients", id), (docSnap) => {
      if (docSnap.exists()) {
        const patientData = { id: docSnap.id, ...docSnap.data() };
        setPatient(patientData);
        setClinicalNotes(patientData.clinicalNotes || []);
      }
      setLoading(false);
    });

    const q = query(
      collection(db, "patients", id, "measurements"),
      orderBy("timestamp", "asc")
    );
    
    const unsubMeasurements = onSnapshot(q, async (snap) => {
      const newMeasurements = [];
      
      for (const docChange of snap.docChanges()) {
        if (docChange.type === "added") {
          const measurementData = { id: docChange.doc.id, ...docChange.doc.data() };
          
          // Run AI analysis if image exists and no analysis yet
          if (measurementData.imageUrl && !measurementData.analysis) {
            try {
              const analysisResult = await analyze(measurementData.imageUrl);
              
              // Update the measurement document with analysis
              await updateDoc(docChange.doc.ref, { analysis: analysisResult });
              
              measurementData.analysis = analysisResult;
            } catch (error) {
              console.error('AI Analysis failed:', error);
            }
          }
          
          newMeasurements.push(measurementData);
        }
      }
      
      // Get all measurements
      const allMeasurements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMeasurements(allMeasurements);
      
      // Update total loss
      if (newMeasurements.length > 0) {
        const totalNew = newMeasurements.reduce((sum, m) => sum + (m.est_ml || 0), 0);
        await updateDoc(doc(db, "patients", id), {
          totalLoss: increment(totalNew)
        });
      }
    });

    return () => {
      unsubPatient();
      unsubMeasurements();
    };
  }, [id, analyze]);

  const dischargePatient = async () => {
    if (!patient || !window.confirm(`Discharge ${patient.name}?`)) return;
    
    try {
      await setDoc(doc(db, "archived_patients", patient.id), {
        ...patient,
        dischargedAt: new Date(),
      });
      await deleteDoc(doc(db, "patients", patient.id));
      navigate("/archive");
    } catch (error) {
      console.error("Error discharging patient:", error);
      alert("Failed to discharge patient.");
    }
  };

  const addClinicalNote = async () => {
    if (!newNote.trim()) return;
    
    const note = {
      id: Date.now().toString(),
      text: newNote.trim(),
      timestamp: new Date(),
      author: 'Medical Staff',
      type: 'clinical'
    };
    
    try {
      await updateDoc(doc(db, "patients", id), {
        clinicalNotes: [...clinicalNotes, note]
      });
      setNewNote('');
    } catch (error) {
      console.error("Error adding clinical note:", error);
      alert("Failed to add clinical note.");
    }
  };

  const deleteClinicalNote = async (noteId) => {
    if (!window.confirm("Delete this clinical note?")) return;
    
    try {
      await updateDoc(doc(db, "patients", id), {
        clinicalNotes: clinicalNotes.filter(note => note.id !== noteId)
      });
    } catch (error) {
      console.error("Error deleting clinical note:", error);
      alert("Failed to delete clinical note.");
    }
  };

  // Prepare chart data
  const chartData = measurements.map((m, idx) => ({
    time: new Date(m.timestamp?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    bloodLoss: m.est_ml,
    cumulative: measurements.slice(0, idx + 1).reduce((sum, x) => sum + (x.est_ml || 0), 0)
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center bg-red-50 p-8 rounded-xl border-2 border-red-200">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl text-red-700 font-semibold">Patient not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Patients
        </button>

        {/* Patient Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-l-8 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center">
                <User className="h-10 w-10 mr-3 text-blue-600" />
                {patient.name}
              </h1>
              <div className="flex items-center space-x-6 text-gray-600">
                <span className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  MRN: {patient.mrn}
                </span>
                <span className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  DOB: {patient.dob}
                </span>
              </div>
            </div>
            
            <button
              onClick={dischargePatient}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Discharge Patient
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-200">
            <div className="text-center bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
              <p className="text-sm text-blue-600 font-semibold mb-1">Allergies</p>
              <p className="text-lg font-bold text-gray-800">{patient.allergies || "None"}</p>
            </div>
            <div className="text-center bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
              <p className="text-sm text-purple-600 font-semibold mb-1">Measurements</p>
              <p className="text-lg font-bold text-gray-800">{measurements.length}</p>
            </div>
            <div className={`text-center p-4 rounded-xl ${patient.totalLoss > 500 ? 'bg-gradient-to-br from-red-50 to-red-100' : 'bg-gradient-to-br from-green-50 to-green-100'}`}>
              <p className={`text-sm font-semibold mb-1 ${patient.totalLoss > 500 ? 'text-red-600' : 'text-green-600'}`}>
                Total Blood Loss
              </p>
              <p className={`text-3xl font-extrabold ${patient.totalLoss > 500 ? 'text-red-700' : 'text-green-700'}`}>
                {patient.totalLoss || 0} mL
              </p>
            </div>
          </div>
        </div>
        
        {/* Clinical Notes Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-t-4 border-blue-400">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <FileText className="h-7 w-7 mr-3 text-blue-500" />
            Clinical Notes
          </h2>
          
          {/* Add New Note */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex gap-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add clinical notes, medications, observations..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="3"
              />
              <button
                onClick={addClinicalNote}
                disabled={!newNote.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Add Note
              </button>
            </div>
          </div>
          
          {/* Notes List */}
          {clinicalNotes.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {[...clinicalNotes].reverse().map((note) => (
                <div key={note.id} className="bg-gradient-to-r from-white to-gray-50 p-4 rounded-xl shadow-sm border-l-4 border-blue-400 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{note.author}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(note.timestamp?.seconds ? note.timestamp.seconds * 1000 : note.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteClinicalNote(note.id)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{note.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-8 rounded-xl text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No clinical notes yet</p>
              <p className="text-sm text-gray-500 mt-2">Add notes above to document patient care</p>
            </div>
          )}
        </div>
        
        {/* Charts and Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Blood Loss Charts */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6 border-t-4 border-blue-400">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <Activity className="h-7 w-7 mr-3 text-blue-500" />
                Blood Loss Tracking
              </h2>
              {measurements.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#666"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#666"
                      style={{ fontSize: '12px' }}
                      label={{ value: 'Blood Loss (mL)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff',
                        border: '2px solid #3b82f6',
                        borderRadius: '8px',
                        padding: '10px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="bloodLoss" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      name="Blood Loss (mL)"
                      dot={{ fill: '#ef4444', r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      name="Cumulative (mL)"
                      dot={{ fill: '#3b82f6', r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="bg-gray-50 p-12 rounded-xl text-center">
                  <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-600 font-medium">No measurements yet</p>
                  <p className="text-sm text-gray-500 mt-2">Charts will appear as measurements are recorded</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Measurement Timeline */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <Clock className="h-7 w-7 mr-3 text-purple-500" />
                Timeline
              </h2>
              {measurements.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {[...measurements].reverse().map((m) => (
                    <div key={m.id} className="bg-gradient-to-r from-white to-gray-50 p-4 rounded-xl shadow-md border-l-4 border-blue-400 hover:shadow-lg transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <div className="bg-red-100 p-2 rounded-lg mr-3">
                            <Activity className="h-6 w-6 text-red-600" />
                          </div>
                          <div>
                            <p className="font-bold text-2xl text-red-600">{m.est_ml} mL</p>
                            <p className="text-xs text-gray-500">{m.weight_g} g</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {new Date(m.timestamp?.seconds * 1000).toLocaleTimeString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(m.timestamp?.seconds * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {m.imageUrl && (
                        <div className="mb-2">
                          <img 
                            src={m.imageUrl} 
                            alt="Measurement" 
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      
                      <AnalysisDisplay analysis={m.analysis} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-8 rounded-xl text-center">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No measurements</p>
                  <p className="text-sm text-gray-500 mt-2">Timeline will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
}