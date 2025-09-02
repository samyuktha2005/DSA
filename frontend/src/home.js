import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Download, RefreshCw, AlertCircle, CheckCircle, Settings } from 'lucide-react';

const DynamicTimetableSystem = () => {
  // Core data structures
  const [sections, setSections] = useState([
    { id: 1, name: 'CSE-A', strength: 60, year: 2, semester: 3 }
  ]);
  
  const [faculty, setFaculty] = useState([
    { id: 1, name: 'Dr. Smith', subjects: ['Mathematics', 'Physics'], maxHours: 20, unavailable: [] }
  ]);
  
  const [classrooms, setClassrooms] = useState([
    { id: 1, name: 'Room-101', capacity: 70, type: 'Lecture', equipment: ['Projector', 'Whiteboard'] }
  ]);
  
  const [subjects, setSubjects] = useState([
    { id: 1, name: 'Mathematics', type: 'Theory', hoursPerWeek: 4, duration: 60 },
    { id: 2, name: 'Physics Lab', type: 'Lab', hoursPerWeek: 3, duration: 120 }
  ]);
  
  const [timeSlots, setTimeSlots] = useState([
    { id: 1, start: '09:00', end: '10:00', day: 'Monday' },
    { id: 2, start: '10:00', end: '11:00', day: 'Monday' },
    { id: 3, start: '11:15', end: '12:15', day: 'Monday' },
    { id: 4, start: '12:15', end: '13:15', day: 'Monday' },
    { id: 5, start: '14:15', end: '15:15', day: 'Monday' }
  ]);
  
  const [timetable, setTimetable] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [activeTab, setActiveTab] = useState('setup');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const roomTypes = ['Lecture', 'Lab', 'Seminar', 'Auditorium'];
  const subjectTypes = ['Theory', 'Lab', 'Practical', 'Tutorial'];
  
  // Helper functions
  const generateTimeSlots = () => {
    const slots = [];
    let id = 1;
    
    days.forEach(day => {
      const daySlots = [
        { start: '09:00', end: '10:00' },
        { start: '10:00', end: '11:00' },
        { start: '11:15', end: '12:15' },
        { start: '12:15', end: '13:15' },
        { start: '14:15', end: '15:15' },
        { start: '15:15', end: '16:15' },
        { start: '16:30', end: '17:30' }
      ];
      
      daySlots.forEach(slot => {
        slots.push({
          id: id++,
          ...slot,
          day
        });
      });
    });
    
    setTimeSlots(slots);
  };
  
  const validateScheduling = (sectionId, subjectId, facultyId, roomId, timeSlotId) => {
    const conflicts = [];
    const timeSlot = timeSlots.find(ts => ts.id === timeSlotId);
    const section = sections.find(s => s.id === sectionId);
    const subject = subjects.find(s => s.id === subjectId);
    const facultyMember = faculty.find(f => f.id === facultyId);
    const room = classrooms.find(r => r.id === roomId);
    
    // Check room capacity
    if (section.strength > room.capacity) {
      conflicts.push(`Room ${room.name} capacity (${room.capacity}) is less than section strength (${section.strength})`);
    }
    
    // Check room type compatibility
    if (subject.type === 'Lab' && room.type !== 'Lab') {
      conflicts.push(`Subject ${subject.name} requires a Lab room, but ${room.name} is a ${room.type}`);
    }
    
    // Check faculty qualification
    if (!facultyMember.subjects.includes(subject.name)) {
      conflicts.push(`${facultyMember.name} is not qualified to teach ${subject.name}`);
    }
    
    // Check time slot conflicts
    Object.values(timetable).forEach(entry => {
      if (entry.timeSlotId === timeSlotId) {
        if (entry.facultyId === facultyId) {
          conflicts.push(`${facultyMember.name} is already scheduled at ${timeSlot.start}-${timeSlot.end} on ${timeSlot.day}`);
        }
        if (entry.roomId === roomId) {
          conflicts.push(`${room.name} is already booked at ${timeSlot.start}-${timeSlot.end} on ${timeSlot.day}`);
        }
        if (entry.sectionId === sectionId) {
          conflicts.push(`${section.name} already has a class at ${timeSlot.start}-${timeSlot.end} on ${timeSlot.day}`);
        }
      }
    });
    
    return conflicts;
  };
  
  const generateTimetable = () => {
    setIsGenerating(true);
    setConflicts([]);
    
    setTimeout(() => {
      const newTimetable = {};
      const allConflicts = [];
      let scheduleId = 1;
      
      // Simple scheduling algorithm - can be enhanced with more sophisticated approaches
      sections.forEach(section => {
        subjects.forEach(subject => {
          const requiredSlots = Math.ceil(subject.hoursPerWeek / (subject.duration / 60));
          let scheduledSlots = 0;
          
          for (let attempt = 0; attempt < 50 && scheduledSlots < requiredSlots; attempt++) {
            const randomTimeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
            const availableFaculty = faculty.filter(f => f.subjects.includes(subject.name));
            const availableRooms = classrooms.filter(r => 
              section.strength <= r.capacity && 
              (subject.type !== 'Lab' || r.type === 'Lab')
            );
            
            if (availableFaculty.length > 0 && availableRooms.length > 0) {
              const selectedFaculty = availableFaculty[Math.floor(Math.random() * availableFaculty.length)];
              const selectedRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
              
              const validationErrors = validateScheduling(
                section.id, subject.id, selectedFaculty.id, selectedRoom.id, randomTimeSlot.id
              );
              
              if (validationErrors.length === 0) {
                const key = `${section.id}-${subject.id}-${scheduleId}`;
                newTimetable[key] = {
                  id: scheduleId++,
                  sectionId: section.id,
                  subjectId: subject.id,
                  facultyId: selectedFaculty.id,
                  roomId: selectedRoom.id,
                  timeSlotId: randomTimeSlot.id
                };
                scheduledSlots++;
              } else {
                allConflicts.push(...validationErrors);
              }
            }
          }
        });
      });
      
      setTimetable(newTimetable);
      setConflicts([...new Set(allConflicts)]);
      setIsGenerating(false);
    }, 2000);
  };
  
  const addSection = () => {
    const newSection = {
      id: Date.now(),
      name: `Section-${sections.length + 1}`,
      strength: 50,
      year: 1,
      semester: 1
    };
    setSections([...sections, newSection]);
  };
  
  const addFaculty = () => {
    const newFaculty = {
      id: Date.now(),
      name: `Faculty-${faculty.length + 1}`,
      subjects: [],
      maxHours: 20,
      unavailable: []
    };
    setFaculty([...faculty, newFaculty]);
  };
  
  const addClassroom = () => {
    const newRoom = {
      id: Date.now(),
      name: `Room-${classrooms.length + 1}`,
      capacity: 50,
      type: 'Lecture',
      equipment: []
    };
    setClassrooms([...classrooms, newRoom]);
  };
  
  const addSubject = () => {
    const newSubject = {
      id: Date.now(),
      name: `Subject-${subjects.length + 1}`,
      type: 'Theory',
      hoursPerWeek: 3,
      duration: 60
    };
    setSubjects([...subjects, newSubject]);
  };
  
  const updateSection = (id, field, value) => {
    setSections(sections.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  
  const updateFaculty = (id, field, value) => {
    setFaculty(faculty.map(f => f.id === id ? { ...f, [field]: value } : f));
  };
  
  const updateClassroom = (id, field, value) => {
    setClassrooms(classrooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  
  const updateSubject = (id, field, value) => {
    setSubjects(subjects.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  
  const removeItem = (id, type) => {
    switch(type) {
      case 'section':
        setSections(sections.filter(s => s.id !== id));
        break;
      case 'faculty':
        setFaculty(faculty.filter(f => f.id !== id));
        break;
      case 'classroom':
        setClassrooms(classrooms.filter(r => r.id !== id));
        break;
      case 'subject':
        setSubjects(subjects.filter(s => s.id !== id));
        break;
    }
  };
  
  const renderTimetableGrid = () => {
    const grid = {};
    
    // Initialize grid
    sections.forEach(section => {
      grid[section.id] = {};
      days.forEach(day => {
        grid[section.id][day] = {};
        timeSlots.filter(ts => ts.day === day).forEach(timeSlot => {
          grid[section.id][day][timeSlot.id] = null;
        });
      });
    });
    
    // Fill grid with scheduled classes
    Object.values(timetable).forEach(entry => {
      const timeSlot = timeSlots.find(ts => ts.id === entry.timeSlotId);
      if (timeSlot) {
        grid[entry.sectionId][timeSlot.day][entry.timeSlotId] = entry;
      }
    });
    
    return grid;
  };
  
  const exportTimetable = () => {
    const grid = renderTimetableGrid();
    const exportData = {
      sections,
      faculty,
      classrooms,
      subjects,
      timeSlots,
      timetable: grid,
      conflicts,
      generatedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  useEffect(() => {
    generateTimeSlots();
  }, []);
  
  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200">
          <div className="flex justify-between items-center p-6">
            <h1 className="text-3xl font-bold text-gray-900">Dynamic Timetable System</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('setup')}
                className={`px-4 py-2 rounded-md ${activeTab === 'setup' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Setup
              </button>
              <button
                onClick={() => setActiveTab('timetable')}
                className={`px-4 py-2 rounded-md ${activeTab === 'timetable' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Timetable
              </button>
            </div>
          </div>
        </div>
        
        {activeTab === 'setup' && (
          <div className="p-6 space-y-8">
            {/* Sections */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Sections</h2>
                <button
                  onClick={addSection}
                  className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map(section => (
                  <div key={section.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-gray-800">Section {section.id}</h3>
                      <button
                        onClick={() => removeItem(section.id, 'section')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={section.name}
                        onChange={(e) => updateSection(section.id, 'name', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Section Name"
                      />
                      <input
                        type="number"
                        value={section.strength}
                        onChange={(e) => updateSection(section.id, 'strength', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Strength"
                      />
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={section.year}
                          onChange={(e) => updateSection(section.id, 'year', parseInt(e.target.value))}
                          className="w-1/2 p-2 border border-gray-300 rounded-md"
                          placeholder="Year"
                        />
                        <input
                          type="number"
                          value={section.semester}
                          onChange={(e) => updateSection(section.id, 'semester', parseInt(e.target.value))}
                          className="w-1/2 p-2 border border-gray-300 rounded-md"
                          placeholder="Semester"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Faculty */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Faculty</h2>
                <button
                  onClick={addFaculty}
                  className="flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Faculty
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {faculty.map(fac => (
                  <div key={fac.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-gray-800">Faculty {fac.id}</h3>
                      <button
                        onClick={() => removeItem(fac.id, 'faculty')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={fac.name}
                        onChange={(e) => updateFaculty(fac.id, 'name', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Faculty Name"
                      />
                      <input
                        type="text"
                        value={fac.subjects.join(', ')}
                        onChange={(e) => updateFaculty(fac.id, 'subjects', e.target.value.split(', ').filter(s => s.trim()))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Subjects (comma separated)"
                      />
                      <input
                        type="number"
                        value={fac.maxHours}
                        onChange={(e) => updateFaculty(fac.id, 'maxHours', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Max Hours/Week"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Classrooms */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Classrooms</h2>
                <button
                  onClick={addClassroom}
                  className="flex items-center px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Classroom
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classrooms.map(room => (
                  <div key={room.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-gray-800">Room {room.id}</h3>
                      <button
                        onClick={() => removeItem(room.id, 'classroom')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => updateClassroom(room.id, 'name', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Room Name"
                      />
                      <input
                        type="number"
                        value={room.capacity}
                        onChange={(e) => updateClassroom(room.id, 'capacity', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Capacity"
                      />
                      <select
                        value={room.type}
                        onChange={(e) => updateClassroom(room.id, 'type', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        {roomTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Subjects */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Subjects</h2>
                <button
                  onClick={addSubject}
                  className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subject
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map(subject => (
                  <div key={subject.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-gray-800">Subject {subject.id}</h3>
                      <button
                        onClick={() => removeItem(subject.id, 'subject')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={subject.name}
                        onChange={(e) => updateSubject(subject.id, 'name', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Subject Name"
                      />
                      <select
                        value={subject.type}
                        onChange={(e) => updateSubject(subject.id, 'type', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        {subjectTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={subject.hoursPerWeek}
                          onChange={(e) => updateSubject(subject.id, 'hoursPerWeek', parseInt(e.target.value))}
                          className="w-1/2 p-2 border border-gray-300 rounded-md"
                          placeholder="Hours/Week"
                        />
                        <input
                          type="number"
                          value={subject.duration}
                          onChange={(e) => updateSubject(subject.id, 'duration', parseInt(e.target.value))}
                          className="w-1/2 p-2 border border-gray-300 rounded-md"
                          placeholder="Duration (min)"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'timetable' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Generated Timetable</h2>
              <div className="flex space-x-2">
                <button
                  onClick={generateTimetable}
                  disabled={isGenerating}
                  className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  {isGenerating ? 'Generating...' : 'Generate Timetable'}
                </button>
                <button
                  onClick={exportTimetable}
                  className="flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
              </div>
            </div>
            
            {conflicts.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <h3 className="font-medium text-red-800">Scheduling Conflicts</h3>
                </div>
                <ul className="text-sm text-red-700 space-y-1">
                  {conflicts.slice(0, 5).map((conflict, index) => (
                    <li key={index}>• {conflict}</li>
                  ))}
                  {conflicts.length > 5 && (
                    <li>• ... and {conflicts.length - 5} more conflicts</li>
                  )}
                </ul>
              </div>
            )}
            
            {Object.keys(timetable).length > 0 && (
              <div className="space-y-8">
                {sections.map(section => {
                  const sectionGrid = renderTimetableGrid()[section.id] || {};
                  const mondaySlots = timeSlots.filter(ts => ts.day === 'Monday');
                  
                  return (
                    <div key={section.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-800">
                          {section.name} - Year {section.year}, Semester {section.semester}
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Time
                              </th>
                              {days.map(day => (
                                <th key={day} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  {day}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {mondaySlots.map(timeSlot => (
                              <tr key={timeSlot.id}>
                                <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                                  {timeSlot.start} - {timeSlot.end}
                                </td>
                                {days.map(day => {
                                  const daySlot = timeSlots.find(ts => ts.day === day && ts.start === timeSlot.start);
                                  const entry = daySlot ? sectionGrid[day]?.[daySlot.id] : null;
                                  
                                  return (
                                    <td key={day} className="px-4 py-2 text-sm text-gray-900">
                                      {entry ? (
                                        <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                                          <div className="font-medium text-blue-900">
                                            {subjects.find(s => s.id === entry.subjectId)?.name}
                                          </div>
                                          <div className="text-xs text-blue-700">
                                            {faculty.find(f => f.id === entry.facultyId)?.name}
                                          </div>
                                          <div className="text-xs text-blue-600">
                                            {classrooms.find(r => r.id === entry.roomId)?.name}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-gray-400 text-center">-</div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {Object.keys(timetable).length === 0 && !isGenerating && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg">
                  No timetable generated yet. Click "Generate Timetable" to create one.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicTimetableSystem;