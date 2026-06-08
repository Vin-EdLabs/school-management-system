
import React from 'react';
import SubjectManager from './SubjectManager';
import { BookOpen } from 'lucide-react';

const SubjectsModule = () => {
    return (
        <div className="min-h-full p-4 pb-8 sm:p-6 md:p-8">
            <div className="mb-5 sm:mb-8">
                <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Subjects Management
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">Define and manage subjects for your school</p>
            </div>

            <SubjectManager />
        </div>
    );
};

export default SubjectsModule;
