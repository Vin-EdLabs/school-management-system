import React from 'react';
import TeacherAppointmentLettersPanel from './TeacherAppointmentLettersPanel';

const TeacherAppointmentLettersModule = () => (
  <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto w-full space-y-4">
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Appointment Letters</h1>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
        View and download every version of your appointment letter issued by the school.
      </p>
    </div>
    <TeacherAppointmentLettersPanel />
  </div>
);

export default TeacherAppointmentLettersModule;
