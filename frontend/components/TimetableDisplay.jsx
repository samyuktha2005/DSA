// Add this component to your React frontend
function TimetableDisplay({ timetable }) {
  // Sample data structure - replace with your actual data
  const sampleData = {
    "10:00-11:00": { "Mon": "Science", "Tue": "Art", "Wed": "History", "Thu": "Russian", "Fri": "Music", "Sat": "Literature" },
    "11:00-12:00": { "Mon": "Art", "Tue": "Science", "Wed": "Art", "Thu": "Literature", "Fri": "History", "Sat": "Art" },
    "12:00-13:00": { "Mon": "History", "Tue": "Literature", "Wed": "Science", "Thu": "Art", "Fri": "Art", "Sat": "Math" },
    "13:00-14:00": { "Mon": "Russian", "Tue": "Music", "Wed": "Music", "Thu": "Science", "Fri": "Math", "Sat": "History" },
    "14:00-15:00": { "Mon": "Literature", "Tue": "Russian", "Wed": "Literature", "Thu": "Math", "Fri": "Science", "Sat": "Russian" },
    "15:00-16:00": { "Mon": "Music", "Tue": "Music", "Wed": "Math", "Thu": "History", "Fri": "Literature", "Sat": "Science" },
    "16:00-17:00": { "Mon": "English", "Tue": "Math", "Wed": "English", "Thu": "Music", "Fri": "Russian", "Sat": "Music" },
    "17:00-18:00": { "Mon": "Math", "Tue": "History", "Wed": "Russian", "Thu": "English", "Fri": "English", "Sat": "English" }
  };

  // Days of the week in order
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  // Time slots in order
  const timeSlots = [
    "10:00-11:00", 
    "11:00-12:00", 
    "12:00-13:00", 
    "13:00-14:00", 
    "14:00-15:00", 
    "15:00-16:00", 
    "16:00-17:00", 
    "17:00-18:00"
  ];

  return (
    <div className="timetable-container">
      <h2>School Timetable</h2>
      <table className="timetable">
        <thead>
          <tr>
            <th>Time</th>
            {days.map(day => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(time => (
            <tr key={time}>
              <td className="time-slot">{time}</td>
              {days.map(day => (
                <td 
                  key={`${time}-${day}`} 
                  className={sampleData[time][day] ? "subject" : "free"}
                >
                  {sampleData[time][day] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}