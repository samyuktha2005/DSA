import json
import sys
from collections import defaultdict, deque
import heapq
import random
from copy import deepcopy

class TimetableScheduler:
    def __init__(self, teachers, classes, subjects, rooms, time_slots, subject_credits, 
                 teacher_qualifications, subject_room_requirements, subject_prerequisites, 
                 class_sizes, teacher_max_daily_load=5, consecutive_preferred=True,
                 max_attempts=100):
        # Validate inputs
        self.validate_inputs(teachers, classes, subjects, rooms, time_slots, 
                           subject_credits, teacher_qualifications, class_sizes)
        
        self.teachers = list(teachers)
        self.classes = list(classes)
        self.subjects = subjects
        self.rooms = rooms
        self.time_slots = time_slots
        self.subject_credits = subject_credits
        self.teacher_qualifications = teacher_qualifications
        self.subject_room_requirements = subject_room_requirements
        self.subject_prerequisites = subject_prerequisites
        self.class_sizes = class_sizes
        self.teacher_max_daily_load = teacher_max_daily_load
        self.consecutive_preferred = consecutive_preferred
        self.max_attempts = max_attempts
        
        # Check if we have enough teachers
        self.check_teacher_coverage()
        
        # Convert credits to required sessions
        self.setup_subject_assignments()
        
        # Check feasibility after setting up subject assignments
        self.validate_feasibility()
        
        # Initialize tracking structures
        self.initialize_tracking_structures()
        
        # Precompute topological order of subjects
        self.setup_subject_order()
        
        # Track room availability by type
        self.setup_room_types()
        
        # Track teacher availability
        self.setup_teacher_availability()
        
        # Lab room booking tracker
        self.lab_room_bookings = defaultdict(set)
        
        # Create time slot index for quick comparison
        self.time_slot_index = {slot: idx for idx, slot in enumerate(self.time_slots)}

    def validate_inputs(self, teachers, classes, subjects, rooms, time_slots, 
                       subject_credits, teacher_qualifications, class_sizes):
        """Validate all input parameters"""
        if not teachers:
            raise ValueError("At least one teacher is required")
        if not classes:
            raise ValueError("At least one class is required")
        if not subjects:
            raise ValueError("At least one subject is required")
        if not rooms:
            raise ValueError("At least one room is required")
        if not time_slots:
            raise ValueError("At least one time slot is required")
            
        for cls in classes:
            if cls not in class_sizes:
                raise ValueError(f"Class size not specified for {cls}")
            if class_sizes[cls] <= 0:
                raise ValueError(f"Invalid class size for {cls}")

    def check_teacher_coverage(self):
        """Check if we have enough qualified teachers for all subjects"""
        subject_coverage = defaultdict(int)
        lab_subjects = set()
        
        # Count required teachers for each subject
        for subject in self.subjects:
            if self.subject_credits.get(subject, 0) >= 3:
                lab_subjects.add(f"{subject} Lab")
                
        all_subjects = set(self.subjects) | lab_subjects
        
        for subject in all_subjects:
            for teacher in self.teachers:
                if subject in self.teacher_qualifications.get(teacher, []):
                    subject_coverage[subject] += 1
        
        # Check if any subject has no teachers
        for subject in all_subjects:
            if subject_coverage.get(subject, 0) == 0:
                raise ValueError(f"No qualified teachers available for {subject}")

    def setup_subject_assignments(self):
        """Convert credits to required sessions (3 credits = 3 theory + 1 lab)"""
        self.subject_assignments = {}
        for cls in self.classes:
            self.subject_assignments[cls] = {}
            for subject, credits in self.subject_credits.items():
                if credits > 0:
                    self.subject_assignments[cls][subject] = credits
                    if credits >= 3:
                        lab_subject = f"{subject} Lab"
                        self.subject_assignments[cls][lab_subject] = 1

    def validate_feasibility(self):
        """Check if scheduling is theoretically possible"""
        total_required = 0
        for cls in self.classes:
            for subject, sessions in self.subject_assignments[cls].items():
                total_required += sessions
        
        total_teacher_capacity = len(self.teachers) * len(self.time_slots)
        
        if total_required > total_teacher_capacity:
            raise ValueError(f"Insufficient teacher capacity! Required: {total_required} sessions, Available: {total_teacher_capacity}")

    def initialize_tracking_structures(self):
        """Initialize all tracking data structures"""
        self.schedule = defaultdict(lambda: defaultdict(dict))
        self.teacher_bookings = defaultdict(set)
        self.class_bookings = defaultdict(set)
        self.room_bookings = defaultdict(set)
        self.teacher_daily_load = defaultdict(lambda: defaultdict(int))
        self.class_subject_time = defaultdict(lambda: defaultdict(list))
        self.teacher_schedule = defaultdict(dict)
        self.scheduled_counts = defaultdict(lambda: defaultdict(int))
        self.available_slots = set(self.time_slots)
        self.class_priority = {cls: 0 for cls in self.classes}

    def setup_subject_order(self):
        """Precompute topological order of subjects for each class"""
        self.subject_order = {}
        for cls in self.classes:
            self.subject_order[cls] = self.topological_sort_subjects(cls)

    def topological_sort_subjects(self, cls):
        """Sort subjects based on prerequisites using Kahn's algorithm"""
        if cls not in self.subject_assignments:
            return []
        
        subjects = list(self.subject_assignments[cls].keys())
        graph = {subject: [] for subject in subjects}
        in_degree = {subject: 0 for subject in subjects}
        
        # Build prerequisite graph
        for subject in subjects:
            base_subject = subject.replace(" Lab", "")
            for prereq in self.subject_prerequisites.get(base_subject, []):
                if prereq in subjects:
                    graph[prereq].append(subject)
                    in_degree[subject] += 1
                # Handle lab prerequisites
                if subject.endswith(" Lab"):
                    if base_subject in subjects:
                        graph[base_subject].append(subject)
                        in_degree[subject] += 1
        
        # Kahn's algorithm
        queue = deque([s for s in in_degree if in_degree[s] == 0])
        result = []
        
        while queue:
            subject = queue.popleft()
            result.append(subject)
            for neighbor in graph[subject]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        return result if len(result) == len(subjects) else subjects

    def setup_room_types(self):
        """Track room availability by type"""
        self.room_types = defaultdict(list)
        for room, info in self.rooms.items():
            self.room_types[info['type']].append(room)

    def setup_teacher_availability(self):
        """Track teacher availability"""
        self.teacher_availability = {teacher: set(self.time_slots) for teacher in self.teachers}

    def is_valid_assignment(self, cls, subject, teacher, room, time_slot):
        """Check if assignment meets all constraints"""
        # Basic availability constraints
        if (time_slot in self.teacher_bookings[teacher] or
            time_slot in self.class_bookings[cls] or
            time_slot in self.room_bookings[room]):
            return False
        
        # Teacher qualifications
        if subject not in self.teacher_qualifications.get(teacher, []):
            return False
        
        # Room capacity and type constraints
        room_capacity = self.rooms[room]['capacity']
        room_type = self.rooms[room]['type']
        required_type = self.subject_room_requirements.get(subject, 'theory')
        
        if self.class_sizes[cls] > room_capacity:
            return False
        
        # Room type matching (flex rooms can be used for any subject)
        if room_type != 'flex' and required_type != room_type:
            return False
        
        # Lab room special handling
        if subject.endswith(" Lab") and required_type == 'lab':
            if room_type != 'lab':
                return False
        
        # Teacher daily load constraint
        day = time_slot.split('-')[0]
        if self.teacher_daily_load[teacher][day] >= self.teacher_max_daily_load:
            return False
        
        # Lab prerequisites - lab can only be scheduled after theory
        if subject.endswith(" Lab"):
            base_subject = subject.replace(" Lab", "")
            if base_subject in self.class_subject_time[cls]:
                theory_times = self.class_subject_time[cls][base_subject]
                if not theory_times:
                    return False
                # Check if at least one theory session is before this lab
                prereq_satisfied = any(
                    self.time_slot_index[slot] < self.time_slot_index[time_slot]
                    for slot in theory_times
                )
                if not prereq_satisfied:
                    return False
            else:
                return False
        
        return True

    def schedule_subject(self, cls, subject, teacher, room, time_slot):
        """Make an assignment and update tracking structures"""
        if not self.is_valid_assignment(cls, subject, teacher, room, time_slot):
            return False
            
        self.schedule[cls][time_slot] = {
            'subject': subject,
            'teacher': teacher,
            'room': room
        }
        
        # Update tracking structures
        self.teacher_bookings[teacher].add(time_slot)
        self.class_bookings[cls].add(time_slot)
        self.room_bookings[room].add(time_slot)
        self.scheduled_counts[cls][subject] += 1
        
        # Update daily load
        day = time_slot.split('-')[0]
        self.teacher_daily_load[teacher][day] += 1
        
        # Record subject time
        self.class_subject_time[cls][subject].append(time_slot)
        self.teacher_schedule[teacher][time_slot] = (cls, subject)
        
        # Update class priority
        self.class_priority[cls] = sum(
            self.scheduled_counts[cls].get(subj, 0) / req 
            for subj, req in self.subject_assignments[cls].items()
        )
        
        # Track lab room usage
        if subject.endswith(" Lab") and self.rooms[room]['type'] == 'lab':
            if time_slot not in self.lab_room_bookings:
                self.lab_room_bookings[time_slot] = set()
            self.lab_room_bookings[time_slot].add(room)
            
        return True

    def unschedule_subject(self, cls, time_slot):
        """Remove an assignment and update tracking structures"""
        if time_slot not in self.schedule[cls] or not self.schedule[cls][time_slot]:
            return False
            
        entry = self.schedule[cls][time_slot]
        subject = entry['subject']
        teacher = entry['teacher']
        room = entry['room']
        
        # Remove from tracking structures
        self.teacher_bookings[teacher].discard(time_slot)
        self.class_bookings[cls].discard(time_slot)
        self.room_bookings[room].discard(time_slot)
        self.scheduled_counts[cls][subject] -= 1
        
        # Update daily load
        day = time_slot.split('-')[0]
        self.teacher_daily_load[teacher][day] -= 1
        
        # Remove from subject time tracking
        if subject in self.class_subject_time[cls]:
            if time_slot in self.class_subject_time[cls][subject]:
                self.class_subject_time[cls][subject].remove(time_slot)
        
        # Remove from teacher schedule
        if teacher in self.teacher_schedule and time_slot in self.teacher_schedule[teacher]:
            del self.teacher_schedule[teacher][time_slot]
        
        # Update class priority
        self.class_priority[cls] = sum(
            self.scheduled_counts[cls].get(subj, 0) / req 
            for subj, req in self.subject_assignments[cls].items()
        )
        
        # Remove lab room booking
        if subject.endswith(" Lab") and self.rooms[room]['type'] == 'lab' and time_slot in self.lab_room_bookings:
            if room in self.lab_room_bookings[time_slot]:
                self.lab_room_bookings[time_slot].remove(room)
                if not self.lab_room_bookings[time_slot]:
                    del self.lab_room_bookings[time_slot]
        
        # Remove from schedule
        del self.schedule[cls][time_slot]
        return True
    
    def calculate_slot_score(self, cls, subject, teacher, room, time_slot, prefer_consecutive):
        """Calculate score for a given time slot"""
        score = 0
        
        # Prefer consecutive sessions for the same subject
        if prefer_consecutive and subject in self.class_subject_time[cls]:
            existing_times = self.class_subject_time[cls][subject]
            if existing_times:
                current_idx = self.time_slot_index[time_slot]
                min_distance = min(abs(current_idx - self.time_slot_index[t]) for t in existing_times)
                if min_distance == 1:
                    score += 10
                elif min_distance <= 3:
                    score += 5
        
        # Prefer less loaded teachers
        teacher_load = sum(self.teacher_daily_load[teacher].values())
        score += (10 - teacher_load) * 0.5
        day = time_slot.split('-')[0]
        daily_load = self.teacher_daily_load[teacher][day]
        score += (self.teacher_max_daily_load - daily_load) * 0.2
        
        # Prioritize scheduling subjects with unmet requirements
        if self.scheduled_counts[cls][subject] < self.subject_assignments[cls][subject]:
            score += 20  # Boost score for unmet requirements
            
        # Prioritize lab room for lab subjects
        if subject.endswith(" Lab") and self.rooms[room]['type'] == 'lab':
            score += 50
            
        # Prioritize classes that are behind schedule
        class_progress = self.class_priority[cls]
        score += (1 - class_progress) * 30
            
        return score

    def get_qualified_teachers(self, subject):
        """Get qualified teachers sorted by current load and availability"""
        qualified = [t for t in self.teachers 
                    if subject in self.teacher_qualifications.get(t, [])]
        
        # Sort by current load (least busy first), then by number of remaining available slots
        return sorted(qualified,
                     key=lambda t: (
                         sum(self.teacher_daily_load[t].values()),
                         -len(self.teacher_availability[t])
                     ))

    def find_available_slot(self, cls, subject, teacher, prefer_consecutive=True):
        """Find available slot with soft constraint optimization"""
        best_slot = None
        best_score = -1
        
        is_lab = subject.endswith(" Lab")
        required_type = 'lab' if is_lab else self.subject_room_requirements.get(subject, 'theory')
        
        # Get appropriate rooms - prioritize smaller rooms first
        suitable_rooms = sorted(
            [room for room, info in self.rooms.items() 
             if info['capacity'] >= self.class_sizes[cls] and 
             (info['type'] == 'flex' or info['type'] == required_type)],
            key=lambda r: self.rooms[r]['capacity']
        )
        
        if not suitable_rooms:
            print(f"        No suitable rooms found for {subject} (need {required_type}, class size {self.class_sizes[cls]})")
            return None
        
        # Try each time slot in random order to distribute load
        for time_slot in random.sample(self.time_slots, len(self.time_slots)):
            for room in suitable_rooms:
                # Skip lab room if already booked for this time slot
                if self.rooms[room]['type'] == 'lab' and time_slot in self.lab_room_bookings:
                    if len(self.lab_room_bookings[time_slot]) >= 1:  # Only one lab can use a lab room at a time
                        continue
                    
                if self.is_valid_assignment(cls, subject, teacher, room, time_slot):
                    score = self.calculate_slot_score(cls, subject, teacher, room, time_slot, prefer_consecutive)
                    
                    if score > best_score:
                        best_slot = (time_slot, room)
                        best_score = score
        
        if not best_slot:
            print(f"        No valid time slots found for {subject} with {teacher}")
            return None
        return best_slot

    def schedule_any_teacher(self, cls, subject, remaining):
        """Attempt to schedule with any qualified teacher when normal scheduling fails"""
        for teacher in self.teachers:
            if subject in self.teacher_qualifications.get(teacher, []):
                for time_slot in self.time_slots:
                    for room, info in self.rooms.items():
                        if (info['capacity'] >= self.class_sizes[cls] and 
                            (info['type'] == 'flex' or 
                             info['type'] == self.subject_room_requirements.get(subject, 'theory'))):
                            # Skip lab room if already booked
                            if info['type'] == 'lab' and time_slot in self.lab_room_bookings:
                                if len(self.lab_room_bookings[time_slot]) >= 1:
                                    continue
                                
                            if self.schedule_subject(cls, subject, teacher, room, time_slot):
                                remaining -= 1
                                if remaining == 0:
                                    return True
        return False

    def schedule_subject_sessions(self, cls, subject, required_sessions):
        """Schedule all required sessions for a subject"""
        scheduled = 0
        qualified_teachers = self.get_qualified_teachers(subject)
        
        if not qualified_teachers:
            print(f"ERROR: No qualified teachers for {subject}")
            return 0
        
        print(f"Scheduling {required_sessions} sessions of {subject} for {cls}")
        
        attempts = 0
        while scheduled < required_sessions and attempts < self.max_attempts:
            attempts += 1
            success = False
            
            for teacher in qualified_teachers:
                slot_info = self.find_available_slot(cls, subject, teacher)
                if slot_info:
                    time_slot, room = slot_info
                    print(f"  Attempting to schedule {subject} with {teacher} in {room} at {time_slot}")
                    if self.schedule_subject(cls, subject, teacher, room, time_slot):
                        scheduled += 1
                        success = True
                        print(f"  ✓ Successfully scheduled session {scheduled}")
                        break
                    else:
                        print(f"  ✗ Failed to schedule (constraint violation)")
                else:
                    print(f"  ✗ No available slot found for {teacher}")
            
            if not success:
                print(f"  ⚠️ Could not schedule session {scheduled + 1} of {subject} for {cls}")
                if self.resolve_conflicts_aggressive(cls, subject):
                    scheduled += 1
                else:
                    break
        
        # If still not scheduled, try with any teacher
        if scheduled < required_sessions:
            remaining = required_sessions - scheduled
            print(f"  Trying emergency scheduling for {remaining} sessions of {subject}")
            if self.schedule_any_teacher(cls, subject, remaining):
                scheduled += remaining
        
        return scheduled

    def resolve_conflicts_aggressive(self, cls, subject):
        """More aggressive conflict resolution by trying to move multiple subjects"""
        print(f"    Attempting aggressive conflict resolution for {subject} in {cls}")
        
        # Create a backup of current state
        backup_state = self.create_backup_state()
        
        # Get all currently scheduled subjects for this class
        scheduled_slots = list(self.schedule[cls].keys())
        random.shuffle(scheduled_slots)  # Randomize to avoid bias
        
        moved_subjects = []
        
        # Try to move up to 3 subjects to make room
        for attempt in range(min(3, len(scheduled_slots))):
            if attempt >= len(scheduled_slots):
                break
                
            time_slot = scheduled_slots[attempt]
            if time_slot not in self.schedule[cls]:
                continue
                
            entry = self.schedule[cls][time_slot]
            other_subject = entry['subject']
            other_teacher = entry['teacher']
            
            print(f"    Trying to move {other_subject} from {time_slot}")
            
            # Don't move lab sessions unless absolutely necessary
            if other_subject.endswith(" Lab") and not subject.endswith(" Lab"):
                continue
            
            # Unschedule the existing subject
            self.unschedule_subject(cls, time_slot)
            moved_subjects.append((other_subject, other_teacher, time_slot))
            
            # Try to schedule our target subject
            qualified_teachers = self.get_qualified_teachers(subject)
            target_scheduled = False
            
            for teacher in qualified_teachers:
                slot_info = self.find_available_slot(cls, subject, teacher)
                if slot_info:
                    target_time, target_room = slot_info
                    if self.schedule_subject(cls, subject, teacher, target_room, target_time):
                        target_scheduled = True
                        print(f"    ✓ Successfully scheduled {subject} after moving {other_subject}")
                        break
            
            if target_scheduled:
                # Try to reschedule all moved subjects
                all_rescheduled = True
                for moved_subject, moved_teacher, original_slot in moved_subjects:
                    rescheduled = False
                    
                    # Try to find a new slot for the moved subject
                    for attempt_teacher in self.get_qualified_teachers(moved_subject):
                        slot_info = self.find_available_slot(cls, moved_subject, attempt_teacher)
                        if slot_info:
                            new_time, new_room = slot_info
                            if self.schedule_subject(cls, moved_subject, attempt_teacher, new_room, new_time):
                                rescheduled = True
                                print(f"    ✓ Rescheduled {moved_subject} to {new_time}")
                                break
                    
                    if not rescheduled:
                        print(f"    ✗ Could not reschedule {moved_subject}")
                        all_rescheduled = False
                        break
                
                if all_rescheduled:
                    print(f"    ✓ All conflicts resolved successfully")
                    return True
                else:
                    print(f"    ✗ Could not reschedule all moved subjects, reverting...")
                    self.restore_backup_state(backup_state)
                    return False
            else:
                # Could not schedule target subject, try next
                continue
        
        # If we get here, we couldn't resolve conflicts
        print(f"    ✗ Could not resolve conflicts for {subject}")
        self.restore_backup_state(backup_state)
        return False

    def create_backup_state(self):
        """Create a backup of current scheduling state"""
        return {
            'schedule': deepcopy(self.schedule),
            'teacher_bookings': deepcopy(self.teacher_bookings),
            'class_bookings': deepcopy(self.class_bookings),
            'room_bookings': deepcopy(self.room_bookings),
            'scheduled_counts': deepcopy(self.scheduled_counts),
            'teacher_daily_load': deepcopy(self.teacher_daily_load),
            'class_subject_time': deepcopy(self.class_subject_time),
            'teacher_schedule': deepcopy(self.teacher_schedule),
            'lab_room_bookings': deepcopy(self.lab_room_bookings),
            'class_priority': deepcopy(self.class_priority)
        }
    
    def restore_backup_state(self, backup_state):
        """Restore scheduling state from backup"""
        self.schedule = backup_state['schedule']
        self.teacher_bookings = backup_state['teacher_bookings']
        self.class_bookings = backup_state['class_bookings']
        self.room_bookings = backup_state['room_bookings']
        self.scheduled_counts = backup_state['scheduled_counts']
        self.teacher_daily_load = backup_state['teacher_daily_load']
        self.class_subject_time = backup_state['class_subject_time']
        self.teacher_schedule = backup_state['teacher_schedule']
        self.lab_room_bookings = backup_state['lab_room_bookings']
        self.class_priority = backup_state['class_priority']

    def generate_timetable(self):
        """Enhanced scheduling algorithm with round-robin approach"""
        print("Starting timetable generation...")
        
        # Create time slot index for quick comparison
        self.time_slot_index = {slot: idx for idx, slot in enumerate(self.time_slots)}
        
        # Initialize class priority based on number of required sessions
        for cls in self.classes:
            total_required = sum(self.subject_assignments[cls].values())
            self.class_priority[cls] = 0
        
        # Round-robin scheduling
        unscheduled_classes = set(self.classes)
        progress = True
        iteration = 0
        
        while unscheduled_classes and progress and iteration < 1000:
            iteration += 1
            progress = False
            
            # Get classes sorted by progress (least scheduled first)
            classes_by_priority = sorted(
                unscheduled_classes, 
                key=lambda cls: self.class_priority[cls]
            )
            
            for cls in classes_by_priority:
                # Get ordered subjects (prerequisites first)
                ordered_subjects = self.subject_order[cls]
                
                # Find next unscheduled subject
                for subject in ordered_subjects:
                    if subject not in self.subject_assignments[cls]:
                        continue
                        
                    required = self.subject_assignments[cls][subject]
                    scheduled = self.scheduled_counts[cls].get(subject, 0)
                    
                    if scheduled < required:
                        # Try to schedule one session
                        qualified_teachers = self.get_qualified_teachers(subject)
                        if not qualified_teachers:
                            continue
                            
                        for teacher in qualified_teachers:
                            slot_info = self.find_available_slot(cls, subject, teacher)
                            if slot_info:
                                time_slot, room = slot_info
                                if self.schedule_subject(cls, subject, teacher, room, time_slot):
                                    print(f"Scheduled {subject} for {cls} with {teacher} at {time_slot}")
                                    progress = True
                                    break
                        if progress:
                            break
                else:
                    # All subjects scheduled for this class
                    unscheduled_classes.discard(cls)
        
        print("\nTimetable generation completed!")

    def generate_timetable_response(self):
        """Convert the internal schedule to the API response format"""
        response = {
            "schedule": defaultdict(dict),
            "statistics": {},
            "constraints": self.verify_constraints()
        }
        
        # Convert schedule to the response format
        for cls in self.classes:
            for time_slot in self.time_slots:
                if time_slot in self.schedule[cls]:
                    entry = self.schedule[cls][time_slot]
                    response["schedule"][cls][time_slot] = {
                        "subject": entry['subject'],
                        "teacher": entry['teacher'],
                        "room": entry['room']
                    }
                else:
                    response["schedule"][cls][time_slot] = None
        
        # Calculate statistics
        total_required = 0
        total_scheduled = 0
        
        for cls in self.classes:
            for subject, required in self.subject_assignments[cls].items():
                scheduled = self.scheduled_counts[cls].get(subject, 0)
                total_required += required
                total_scheduled += scheduled
        
        response["statistics"] = {
            "total_required": total_required,
            "total_scheduled": total_scheduled,
            "success_rate": (total_scheduled / total_required) * 100 if total_required > 0 else 0,
            "teacher_utilization": [
                {
                    "name": teacher,
                    "total_sessions": sum(self.teacher_daily_load[teacher].values())
                }
                for teacher in self.teachers
            ]
        }
        
        return response

    def verify_constraints(self):
        """Verify all constraints are satisfied in the final schedule"""
        errors = []
        
        # Check all subjects are scheduled required number of times
        for cls in self.classes:
            for subject, required in self.subject_assignments[cls].items():
                scheduled = self.scheduled_counts[cls].get(subject, 0)
                if scheduled != required:
                    errors.append(f"Class {cls} subject {subject}: scheduled {scheduled}, required {required}")
        
        # Check teacher qualifications
        for cls in self.classes:
            for time_slot, entry in self.schedule[cls].items():
                if entry:
                    teacher = entry['teacher']
                    subject = entry['subject']
                    if subject not in self.teacher_qualifications.get(teacher, []):
                        errors.append(f"Teacher {teacher} not qualified for {subject}")
        
        # Check room capacity
        for cls in self.classes:
            for time_slot, entry in self.schedule[cls].items():
                if entry:
                    room = entry['room']
                    if self.class_sizes[cls] > self.rooms[room]['capacity']:
                        errors.append(f"Room {room} capacity exceeded for {cls}")
        
        # Check teacher conflicts
        teacher_schedule = defaultdict(list)
        for cls in self.classes:
            for time_slot, entry in self.schedule[cls].items():
                if entry:
                    teacher = entry['teacher']
                    teacher_schedule[teacher].append(time_slot)
        
        for teacher, slots in teacher_schedule.items():
            if len(slots) != len(set(slots)):
                errors.append(f"Teacher {teacher} has conflicting assignments")
        
        # Check lab prerequisites
        for cls in self.classes:
            for time_slot, entry in self.schedule[cls].items():
                if entry and entry['subject'].endswith(" Lab"):
                    lab_subject = entry['subject']
                    theory_subject = lab_subject.replace(" Lab", "")
                    
                    if theory_subject in self.class_subject_time[cls]:
                        theory_times = self.class_subject_time[cls][theory_subject]
                        lab_time_idx = self.time_slot_index[time_slot]
                        
                        prereq_satisfied = any(
                            self.time_slot_index[t] < lab_time_idx
                            for t in theory_times
                        )
                        
                        if not prereq_satisfied:
                            errors.append(f"Lab {lab_subject} scheduled before theory in {cls}")
        
        return errors if errors else ["All constraints satisfied!"]

def main(input_file):
    """Main function to execute the timetable generation"""
    # Load input data
    with open(input_file, 'r') as f:
        input_data = json.load(f)
    
    # Create scheduler instance
    scheduler = TimetableScheduler(
        teachers=input_data['teachers'],
        classes=input_data['classes'],
        subjects=input_data['subjects'],
        rooms=input_data['rooms'],
        time_slots=input_data['time_slots'],
        subject_credits=input_data['subject_credits'],
        teacher_qualifications=input_data['teacher_qualifications'],
        subject_room_requirements=input_data['subject_room_requirements'],
        subject_prerequisites=input_data['subject_prerequisites'],
        class_sizes=input_data['class_sizes'],
        teacher_max_daily_load=input_data.get('teacher_max_daily_load', 5),
        consecutive_preferred=input_data.get('consecutive_preferred', True),
        max_attempts=input_data.get('max_attempts', 200)
    )
    
    # Generate timetable
    scheduler.generate_timetable()
    
    # Prepare response
    response = scheduler.generate_timetable_response()
    
    # Save output
    output_file = input_file.replace('input', 'output')
    with open(output_file, 'w') as f:
        json.dump(response, f, indent=2)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python timetable_generator.py <input_file>")
        sys.exit(1)
    
    main(sys.argv[1])