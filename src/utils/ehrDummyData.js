export const ehrPatients = [
  { 
    mrn: 'MRN001', 
    name: 'Amelia Clarke', 
    dob: '1992-04-10', 
    admission: '2025-09-25', 
    note: 'G3P2, full term',
    allergies: 'Penicillin',
    bloodType: 'O+'
  },
  { 
    mrn: 'MRN002', 
    name: 'Sophia Nguyen', 
    dob: '1990-02-03', 
    admission: '2025-09-26', 
    note: 'Induced labour',
    allergies: 'None',
    bloodType: 'A+'
  },
  { 
    mrn: 'MRN003', 
    name: 'Maya Patel', 
    dob: '1988-11-12', 
    admission: '2025-09-27', 
    note: 'Postpartum day 1',
    allergies: 'Sulfa drugs',
    bloodType: 'B+'
  },
  { 
    mrn: 'MRN004', 
    name: 'Olivia Brown', 
    dob: '1995-06-23', 
    admission: '2025-09-24', 
    note: 'C-section',
    allergies: 'Latex',
    bloodType: 'AB+'
  },
  { 
    mrn: 'MRN005', 
    name: 'Hannah Z.', 
    dob: '1996-08-30', 
    admission: '2025-09-23', 
    note: 'Vaginal birth',
    allergies: 'None',
    bloodType: 'O-'
  },
];

export const mockUsers = [
  {
    uid: 'nurse123',
    email: 'nurse@hospital.com',
    role: 'nurse',
    name: 'Sarah Johnson'
  },
  {
    uid: 'doctor123',
    email: 'doctor@hospital.com',
    role: 'doctor',
    name: 'Dr. Michael Chen'
  }
];

// API utility for handling smart pad box HTTP requests
export const padBoxAPI = {
  /**
   * Submit measurement data from smart pad box
   */
  async submitMeasurement(measurementData) {
    try {
      const { unitId, weight_g, est_ml } = measurementData;
      
      if (!unitId || weight_g === undefined || est_ml === undefined) {
        throw new Error('Missing required fields: unitId, weight_g, est_ml');
      }

      // For demo purposes, return mock success
      console.log('Measurement submitted:', measurementData);
      
      return {
        success: true,
        measurementId: `MEAS-${Date.now()}`,
        message: 'Measurement received successfully'
      };

    } catch (error) {
      console.error('Error submitting measurement:', error);
      throw new Error(`Failed to submit measurement: ${error.message}`);
    }
  }
};

/**
 * Create mock measurement data for testing
 */
export const createMockMeasurement = (overrides = {}) => {
  const mockData = {
    unitId: `PAD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    weight_g: 50 + Math.random() * 200,
    est_ml: 30 + Math.random() * 120,
    imageUrl: `https://picsum.photos/seed/pad-${Date.now()}/400/300.jpg`,
    timestamp: Date.now(),
    ...overrides
  };

  return mockData;
};