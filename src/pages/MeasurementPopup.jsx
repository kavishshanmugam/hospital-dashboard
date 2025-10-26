import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";

export default function MeasurementPopup({ patients }) {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    // Listen for new hospital measurements not yet assigned
    const unsub = onSnapshot(collection(db, "hospital_measurements"), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (!data.assigned) {
            setPending({ id: change.doc.id, ...data });
          }
        }
      });
    });
    return unsub;
  }, []);

  const assignPatient = async (patientId) => {
    if (!pending) return;
    const measRef = doc(db, "hospital_measurements", pending.id);

    // mark as assigned
    await updateDoc(measRef, { assigned: true, patientId });

    // also add to patient’s history
    await addDoc(collection(db, "patients", patientId, "measurements"), {
      est_ml: pending.est_ml,
      weight_g: pending.weight_g,
      timestamp: pending.timestamp,
    });

    setPending(null);
  };

  if (!pending) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-lg font-bold mb-2">New Measurement Detected</h2>
        <p>{pending.est_ml} mL recorded</p>
        <p className="text-sm text-gray-600 mb-4">Assign to patient:</p>
        <div className="space-y-2">
          {patients.map((p) => (
            <button
              key={p.id}
              onClick={() => assignPatient(p.id)}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
