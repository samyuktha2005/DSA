from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import json
from datetime import datetime
import uuid
import subprocess
import sys
import os
from typing import Any  # <-- Add this import
from pydantic import BaseModel, ConfigDict


app = FastAPI(
    title="University Timetable Scheduler API",
    description="API for generating university timetables based on various constraints",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response validation
class RoomInput(BaseModel):
    name: str
    capacity: int
    type: str

class TimetableRequest(BaseModel):
    teachers: List[str]
    classes: List[str]
    subjects: List[str]
    rooms: Dict[str, Dict[str, str]]  # {room_name: {capacity: int, type: str}}
    time_slots: List[str]
    subject_credits: Dict[str, int]
    teacher_qualifications: Dict[str, List[str]]
    subject_room_requirements: Dict[str, str]
    subject_prerequisites: Dict[str, List[str]]
    class_sizes: Dict[str, int]
    teacher_max_daily_load: int = 5
    consecutive_preferred: bool = True
    max_attempts: int = 200

class TimetableEntry(BaseModel):
    subject: str
    teacher: str
    room: str

class TimetableResponse(BaseModel):
    schedule: Dict[str, Dict[str, Optional[TimetableEntry]]]  # {class: {time_slot: entry}}
    statistics: Dict[str, any]
    constraints: List[str]
    
    model_config = ConfigDict(arbitrary_types_allowed=True)

# Temporary storage for generated timetables
TIMETABLE_CACHE = {}

@app.post("/generate-timetable", response_model=TimetableResponse)
async def generate_timetable(request: TimetableRequest):
    """
    Generate a timetable based on the provided constraints and requirements
    """
    try:
        # Generate a unique ID for this request
        request_id = str(uuid.uuid4())
        
        # Prepare the input data for the Python script
        input_data = {
            "teachers": request.teachers,
            "classes": request.classes,
            "subjects": request.subjects,
            "rooms": request.rooms,
            "time_slots": request.time_slots,
            "subject_credits": request.subject_credits,
            "teacher_qualifications": request.teacher_qualifications,
            "subject_room_requirements": request.subject_room_requirements,
            "subject_prerequisites": request.subject_prerequisites,
            "class_sizes": request.class_sizes,
            "teacher_max_daily_load": request.teacher_max_daily_load,
            "consecutive_preferred": request.consecutive_preferred,
            "max_attempts": request.max_attempts
        }
        
        # Save the input data to a temporary file
        input_filename = f"timetable_input_{request_id}.json"
        with open(input_filename, 'w') as f:
            json.dump(input_data, f)
        
        # Execute the timetable generator script
        script_path = os.path.join(os.path.dirname(__file__), 'timetable_generator.py')
        result = subprocess.run(
            [sys.executable, script_path, input_filename],
            capture_output=True,
            text=True
        )
        
        # Check for errors
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Timetable generation failed: {result.stderr}"
            )
        
        # Parse the output
        output_filename = f"timetable_output_{request_id}.json"
        with open(output_filename, 'r') as f:
            output_data = json.load(f)
        
        # Clean up temporary files
        os.remove(input_filename)
        os.remove(output_filename)
        
        # Store in cache (for demo purposes)
        TIMETABLE_CACHE[request_id] = output_data
        
        return output_data
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating timetable: {str(e)}"
        )

@app.get("/timetable/{request_id}", response_model=TimetableResponse)
async def get_timetable(request_id: str):
    """
    Retrieve a previously generated timetable by its ID
    """
    if request_id not in TIMETABLE_CACHE:
        raise HTTPException(
            status_code=404,
            detail="Timetable not found"
        )
    return TIMETABLE_CACHE[request_id]

@app.get("/")
async def root():
    return {
        "message": "University Timetable Scheduler API",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }