const fs = require('fs');
const path = require('path');

const filesToClean = [
  'backend/seed-500-patients.js',
  'backend/seed-complete-demo.js',
  'backend/seed-demo-bulk.js',
  'backend/seed-final-correct.js',
  'backend/seed-multiple-appointments.js',
  'backend/seed-with-real-names.js',
  'mobile-frontend/src/components/BookAppointmentSheet.jsx',
  'mobile-frontend/src/components/MobileAppointments.jsx',
  'mobile-frontend/src/components/MobilePatientForm.jsx',
  'frontend/src/components/common/RegisterPatientForm.jsx',
  'frontend/src/components/appointments/AppointmentsModule.jsx',
  'mobile-frontend/src/components/appointments/AppointmentsModule.jsx',
  'backend/src/controllers/appointmentController.js'
];

for (const file of filesToClean) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    // Regex to remove durationMinutes logic
    content = content.replace(/durationMinutes\s*:\s*[^,]+,\s*/g, '');
    fs.writeFileSync(fullPath, content);
    console.log('Cleaned', file);
  }
}
