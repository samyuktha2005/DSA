import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    numSections: 1,
    sections: [],
    subjects: [],
    numTeachers: 2,
    teachers: [],
    numRooms: 3,
    rooms: [],
    timeSlots: [],
    subjectCredits: {},
    teacherQualifications: {},
    classSizes: {},
    subjectRoomRequirements: {},
    subjectPrerequisites: {}
  });
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSectionSizeChange = (section, size) => {
    setFormData(prev => ({
      ...prev,
      classSizes: {
        ...prev.classSizes,
        [section]: parseInt(size)
      }
    }));
  };

  const handleSubjectCreditChange = (subject, credit) => {
    setFormData(prev => ({
      ...prev,
      subjectCredits: {
        ...prev.subjectCredits,
        [subject]: parseInt(credit)
      }
    }));
  };

  const handleTeacherQualificationChange = (teacher, subject, qualified) => {
    setFormData(prev => {
      const currentQuals = prev.teacherQualifications[teacher] || [];
      let newQuals;
      
      if (qualified) {
        newQuals = [...currentQuals, subject];
        // Add lab qualification if credits >= 3
        if (formData.subjectCredits[subject] >= 3 && !currentQuals.includes(`${subject} Lab`)) {
          newQuals.push(`${subject} Lab`);
        }
      } else {
        newQuals = currentQuals.filter(s => s !== subject && !s.startsWith(`${subject} `));
      }
      
      return {
        ...prev,
        teacherQualifications: {
          ...prev.teacherQualifications,
          [teacher]: newQuals
        }
      };
    });
  };

  const handleRoomChange = (index, field, value) => {
    setFormData(prev => {
      const newRooms = [...prev.rooms];
      newRooms[index] = {
        ...newRooms[index],
        [field]: field === 'capacity' ? parseInt(value) : value
      };
      return {
        ...prev,
        rooms: newRooms
      };
    });
  };

  const addSection = () => {
    const newSection = `Section${formData.sections.length + 1}`;
    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
      classSizes: {
        ...prev.classSizes,
        [newSection]: 20
      }
    }));
  };

  const removeSection = () => {
    if (formData.sections.length <= 1) return;
    const newSections = formData.sections.slice(0, -1);
    const removedSection = formData.sections[formData.sections.length - 1];
    const newClassSizes = { ...formData.classSizes };
    delete newClassSizes[removedSection];
    
    setFormData(prev => ({
      ...prev,
      sections: newSections,
      classSizes: newClassSizes
    }));
  };

  const addSubject = () => {
    const subjectName = prompt("Enter subject name:");
    if (subjectName && !formData.subjects.includes(subjectName)) {
      setFormData(prev => ({
        ...prev,
        subjects: [...prev.subjects, subjectName],
        subjectCredits: {
          ...prev.subjectCredits,
          [subjectName]: 3
        }
      }));
    }
  };

  const removeSubject = (subject) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s !== subject),
      subjectCredits: Object.fromEntries(
        Object.entries(prev.subjectCredits).filter(([s]) => s !== subject)
      ),
      teacherQualifications: Object.fromEntries(
        Object.entries(prev.teacherQualifications).map(([teacher, quals]) => [
          teacher,
          quals.filter(s => !s.startsWith(subject) && s !== subject)
        ])
      )
    }));
  };

  const addTeacher = () => {
    const newTeacher = `T${formData.teachers.length + 1}`;
    setFormData(prev => ({
      ...prev,
      teachers: [...prev.teachers, newTeacher],
      teacherQualifications: {
        ...prev.teacherQualifications,
        [newTeacher]: []
      }
    }));
  };

  const removeTeacher = () => {
    if (formData.teachers.length <= 2) return;
    const newTeachers = formData.teachers.slice(0, -1);
    const removedTeacher = formData.teachers[formData.teachers.length - 1];
    const newTeacherQualifications = { ...formData.teacherQualifications };
    delete newTeacherQualifications[removedTeacher];
    
    setFormData(prev => ({
      ...prev,
      teachers: newTeachers,
      teacherQualifications: newTeacherQualifications
    }));
  };

  const addRoom = () => {
    const newRoom = {
      name: `Room${formData.rooms.length + 1}`,
      capacity: 30,
      type: 'theory'
    };
    setFormData(prev => ({
      ...prev,
      rooms: [...prev.rooms, newRoom]
    }));
  };

  const removeRoom = () => {
    if (formData.rooms.length <= 3) return;
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.slice(0, -1)
    }));
  };

  const generateTimeSlots = () => {
    const baseSlots = [
      'Mon-9AM', 'Mon-10AM', 'Mon-11AM', 'Mon-1PM', 'Mon-2PM',
      'Tue-9AM', 'Tue-10AM', 'Tue-11AM', 'Tue-1PM', 'Tue-2PM',
      'Wed-9AM', 'Wed-10AM', 'Wed-11AM', 'Wed-1PM', 'Wed-2PM',
      'Thu-9AM', 'Thu-10AM', 'Thu-11AM', 'Thu-1PM', 'Thu-2PM',
      'Fri-9AM', 'Fri-10AM', 'Fri-11AM', 'Fri-1PM', 'Fri-2PM'
    ];
    
    const additionalSlots = formData.sections.length > 3 ? [
      'Mon-3PM', 'Mon-4PM',
      'Tue-3PM', 'Tue-4PM',
      'Wed-3PM', 'Wed-4PM',
      'Thu-3PM', 'Thu-4PM',
      'Fri-3PM', 'Fri-4PM'
    ] : [];
    
    return [...baseSlots, ...additionalSlots];
  };

  const generateRoomRequirements = () => {
    const requirements = {};
    formData.subjects.forEach(subject => {
      if (formData.subjectCredits[subject] >= 3) {
        requirements[`${subject} Lab`] = 'lab';
      }
      requirements[subject] = 'theory';
    });
    return requirements;
  };

  const generatePrerequisites = () => {
    const prerequisites = {};
    formData.subjects.forEach(subject => {
      if (formData.subjectCredits[subject] >= 3) {
        prerequisites[`${subject} Lab`] = [subject];
      }
    });
    return prerequisites;
  };

  const submitForm = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const timeSlots = generateTimeSlots();
      const subjectRoomRequirements = generateRoomRequirements();
      const subjectPrerequisites = generatePrerequisites();
      
      const payload = {
        teachers: formData.teachers,
        classes: formData.sections,
        subjects: formData.subjects,
        rooms: formData.rooms.reduce((acc, room) => {
          acc[room.name] = { capacity: room.capacity, type: room.type };
          return acc;
        }, {}),
        time_slots: timeSlots,
        subject_credits: formData.subjectCredits,
        teacher_qualifications: formData.teacherQualifications,
        subject_room_requirements: subjectRoomRequirements,
        subject_prerequisites: subjectPrerequisites,
        class_sizes: formData.classSizes,
        teacher_max_daily_load: 5,
        consecutive_preferred: true,
        max_attempts: 200
      };
      
      // In a real app, you would send this to your backend
      // const response = await axios.post('/api/generate-timetable', payload);
      // setTimetable(response.data);
      
      // For demo purposes, we'll simulate a response
      setTimeout(() => {
        setTimetable({
          schedule: generateMockTimetable(formData.sections, timeSlots),
          statistics: generateMockStatistics(formData.sections, formData.subjects),
          constraints: ["All constraints satisfied!"]
        });
        setStep(4);
        setLoading(false);
      }, 2000);
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const generateMockTimetable = (sections, timeSlots) => {
    const timetable = {};
    sections.forEach(section => {
      timetable[section] = {};
      timeSlots.forEach(slot => {
        if (Math.random() > 0.7) {
          timetable[section][slot] = {
            subject: `Subject${Math.floor(Math.random() * 3) + 1}`,
            teacher: `T${Math.floor(Math.random() * formData.teachers.length) + 1}`,
            room: `Room${Math.floor(Math.random() * formData.rooms.length) + 1}`
          };
        }
      });
    });
    return timetable;
  };

  const generateMockStatistics = (sections, subjects) => {
    return {
      totalRequired: sections.length * subjects.length * 3,
      totalScheduled: sections.length * subjects.length * 2,
      teacherUtilization: formData.teachers.map(teacher => ({
        name: teacher,
        totalSessions: Math.floor(Math.random() * 10) + 10
      }))
    };
  };

  const renderStep1 = () => (
    <div className="step">
      <h2>Step 1: Class Information</h2>
      <div className="form-group">
        <label>Number of Sections:</label>
        <div className="input-group">
          <button onClick={removeSection}>-</button>
          <span>{formData.sections.length}</span>
          <button onClick={addSection}>+</button>
        </div>
      </div>
      
      <div className="section-sizes">
        <h3>Class Sizes:</h3>
        {formData.sections.map(section => (
          <div key={section} className="form-group">
            <label>{section}:</label>
            <input
              type="number"
              min="10"
              max="50"
              value={formData.classSizes[section] || 20}
              onChange={(e) => handleSectionSizeChange(section, e.target.value)}
            />
          </div>
        ))}
      </div>
      
      <div className="form-group">
        <h3>Subjects:</h3>
        <button onClick={addSubject} className="add-button">Add Subject</button>
        <div className="subject-list">
          {formData.subjects.map(subject => (
            <div key={subject} className="subject-item">
              <span>{subject}</span>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.subjectCredits[subject] || 3}
                onChange={(e) => handleSubjectCreditChange(subject, e.target.value)}
                className="credit-input"
              />
              <button onClick={() => removeSubject(subject)} className="remove-button">×</button>
            </div>
          ))}
        </div>
      </div>
      
      <button onClick={() => setStep(2)} className="next-button">Next</button>
    </div>
  );

  const renderStep2 = () => (
    <div className="step">
      <h2>Step 2: Teacher Information</h2>
      <div className="form-group">
        <label>Number of Teachers:</label>
        <div className="input-group">
          <button onClick={removeTeacher}>-</button>
          <span>{formData.teachers.length}</span>
          <button onClick={addTeacher}>+</button>
        </div>
      </div>
      
      <div className="teacher-qualifications">
        <h3>Teacher Qualifications:</h3>
        <table>
          <thead>
            <tr>
              <th>Teacher</th>
              {formData.subjects.map(subject => (
                <th key={subject}>{subject}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {formData.teachers.map(teacher => (
              <tr key={teacher}>
                <td>{teacher}</td>
                {formData.subjects.map(subject => (
                  <td key={`${teacher}-${subject}`}>
                    <input
                      type="checkbox"
                      checked={formData.teacherQualifications[teacher]?.includes(subject) || false}
                      onChange={(e) => handleTeacherQualificationChange(teacher, subject, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="button-group">
        <button onClick={() => setStep(1)} className="back-button">Back</button>
        <button onClick={() => setStep(3)} className="next-button">Next</button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="step">
      <h2>Step 3: Room Information</h2>
      <div className="form-group">
        <label>Number of Rooms:</label>
        <div className="input-group">
          <button onClick={removeRoom}>-</button>
          <span>{formData.rooms.length}</span>
          <button onClick={addRoom}>+</button>
        </div>
      </div>
      
      <div className="room-list">
        <h3>Room Details:</h3>
        {formData.rooms.map((room, index) => (
          <div key={index} className="room-item">
            <div className="form-group">
              <label>Name:</label>
              <input
                type="text"
                value={room.name}
                onChange={(e) => handleRoomChange(index, 'name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Capacity:</label>
              <input
                type="number"
                min="10"
                value={room.capacity}
                onChange={(e) => handleRoomChange(index, 'capacity', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Type:</label>
              <select
                value={room.type}
                onChange={(e) => handleRoomChange(index, 'type', e.target.value)}
              >
                <option value="theory">Theory</option>
                <option value="lab">Lab</option>
                <option value="flex">Flex</option>
              </select>
            </div>
          </div>
        ))}
      </div>
      
      <div className="lab-warning">
        {formData.subjects.filter(subject => formData.subjectCredits[subject] >= 3).length > 
         formData.rooms.filter(room => room.type === 'lab').length && (
          <div className="warning">
            ⚠️ Warning: You have more lab subjects than lab rooms. This may cause scheduling issues.
          </div>
        )}
      </div>
      
      <div className="button-group">
        <button onClick={() => setStep(2)} className="back-button">Back</button>
        <button onClick={submitForm} className="submit-button" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Timetable'}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="step">
      <h2>Timetable Generated Successfully!</h2>
      
      <div className="timetable-container">
        <h3>Statistics</h3>
        <div className="statistics">
          <p>Total Required Sessions: {timetable.statistics.totalRequired}</p>
          <p>Total Scheduled Sessions: {timetable.statistics.totalScheduled}</p>
          <p>Success Rate: {Math.round((timetable.statistics.totalScheduled / timetable.statistics.totalRequired) * 100)}%</p>
          
          <h4>Teacher Utilization:</h4>
          <ul>
            {timetable.statistics.teacherUtilization.map(teacher => (
              <li key={teacher.name}>
                {teacher.name}: {teacher.totalSessions} sessions
              </li>
            ))}
          </ul>
        </div>
        
        <h3>Constraint Verification</h3>
        <div className="constraints">
          {timetable.constraints.map((constraint, index) => (
            <p key={index}>{constraint}</p>
          ))}
        </div>
        
        <h3>Timetables by Section</h3>
        {formData.sections.map(section => (
          <div key={section} className="section-timetable">
            <h4>{section} Timetable</h4>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {generateTimeSlots().map(slot => (
                  <tr key={slot}>
                    <td>{slot}</td>
                    <td>{timetable.schedule[section][slot]?.subject || 'FREE'}</td>
                    <td>{timetable.schedule[section][slot]?.teacher || ''}</td>
                    <td>{timetable.schedule[section][slot]?.room || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      
      <button onClick={() => setStep(1)} className="restart-button">Start Over</button>
    </div>
  );

  return (
    <div className="app">
      <header>
        <h1>University Timetable Scheduler</h1>
      </header>
      
      <main>
        {error && <div className="error-message">{error}</div>}
        
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </main>
      
      <footer>
        <p>Timetable Scheduling System © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;