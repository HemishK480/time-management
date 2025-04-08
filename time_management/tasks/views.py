import asyncio
import json
import os
import time
import threading
import requests

from bs4 import BeautifulSoup
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import redirect, render
from django.contrib.auth import authenticate, login, logout
from allauth.socialaccount.models import SocialAccount, SocialToken, SocialApp
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
import hashlib
from django.conf import settings
from django.utils import timezone

from .models import Task, SubTask

import pprint

from datetime import datetime, date, timedelta

from tasks import managebac_api

from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
# Create your views here.

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'


def login_managebac(request):
    domain = "gwa"

    if request.method == "POST":
        data = json.loads(request.body)
        username = data.get("username")
        password = data.get("password")

        start = time.perf_counter()
        s = requests.Session()
        login_page_url = f"https://{domain}.managebac.com/login"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
            "Referer": login_page_url,
        }
        
        r = s.get(login_page_url, headers=headers)
        soup = BeautifulSoup(r.text, "html.parser")
        token_elem = soup.find("input", {"name": "authenticity_token"})
        authenticity_token = token_elem["value"] if token_elem else None
        
        if not authenticity_token:
            raise Exception("Failed to retrieve token from the login page.")
        
        payload = {
            "authenticity_token": authenticity_token,
            "login": username,
            "password": password,
            "commit": "Sign in"
        }
        
        sessions_url = f"https://{domain}.managebac.com/sessions"
        r = s.post(sessions_url, data=payload, headers=headers, allow_redirects=True)
        
        cookie = s.cookies.get("_managebac_session")
        if not cookie:
            raise Exception("Login might have failed.")
        
        end = time.perf_counter()
        # print(f"Cookie retrived in {end - start:.4f} seconds")
        return JsonResponse({"cookie": cookie})

def managebac_tasks(request):
    if request.method == "POST":
        data = json.loads(request.body)
        cookie = data.get("cookie")
        page_num = data.get("page_num")
        type = data.get("type")
                
        result, formatted_timing = asyncio.run(managebac_api.mbapi2(page_num, type, "gwa", cookie))
        
        # print(f"Performance breakdown:")
        # print(f"  Session creation:       {formatted_timing['session_creation']}")
        # print(f"  URL gathering:          {formatted_timing['url_gathering']}")
        # print(f"  Task details gathering: {formatted_timing['task_details_gathering']} ({formatted_timing['task_count']} tasks, avg {formatted_timing['average_per_task']} each)")
        # print(f"  Total time:             {formatted_timing['total']}")

        # Cache the ManageBac tasks with their full data
        cache_key = f"managebac_tasks_{cookie[:10]}"
        cached_tasks = cache.get(cache_key) or {}
        
        for task in result.get('tasks', []):
            if 'id' in task:
                cached_tasks[task['id']] = task
                
        cache.set(cache_key, cached_tasks, 1800)  # 30 minutes

        return JsonResponse({"managebacTasks": result})

def managebac_tasks_save(request):
    if request.method == "POST":
        data = json.loads(request.body)
        selected_task_ids = data.get("selectedTasks", [])
        cookie = data.get("cookie", "")
        
        cache_key = f"managebac_tasks_{cookie[:10]}"
        cached_tasks = cache.get(cache_key) or {}

        saved_tasks = []
        saved_count = 0
        skipped_count = 0
        
        for task_id in selected_task_ids:
            # Get full task data from cache
            task_data = cached_tasks.get(task_id)
            saved_tasks.append(task_data)
            
            if Task.objects.filter(user=request.user, source_id=task_data['id'], source="managebac").exists():
                skipped_count += 1
                break
            
            estimated_time, reasoning = estimate_task_time(f"Title: {task_data['title']}\n Description: {task_data['description']}")
            try:
                # Parse the date string (format: "day/month")
                day, month = task_data['due-date'].split('/')
                # Set current year, assuming tasks are for this academic year
                current_year = datetime.now().year
                task_year = current_year
                
                # Get current month for comparison
                current_month = datetime.now().month
                
                # Convert month to integer for comparison
                month_int = int(month)
                
                # Academic year logic:
                # If we're in Jan-Jul (1-7) and the task is in Aug-Dec (8-12), it's from previous year
                if current_month >= 1 and current_month <= 7 and month_int >= 8 and month_int <= 12:
                    task_year -= 1  # Previous calendar year
                # If we're in Aug-Dec (8-12) and the task is in Jan-Jul (1-7), it's next year
                elif current_month >= 8 and current_month <= 12 and month_int >= 1 and month_int <= 7:
                    task_year += 1  # Next calendar year
                
                # Format the date in ISO format (YYYY-MM-DD)
                formatted_date = f"{task_year}-{month}-{day}"
                due_date = datetime.strptime(formatted_date, "%Y-%m-%d").date()
                
                Task.objects.create(
                    user=request.user,
                    title=task_data['title'],
                    description=task_data['description'],
                    source="managebac",
                    source_id=task_data['id'],
                    due_date=due_date,
                    time_estimate=timedelta(minutes=int(estimated_time)),
                    reasoning=reasoning
                )
                saved_count += 1
            except Exception as e:
                print(f"Error creating task: {str(e)}")
            
            if not task_data:
                print(f"Task data not found for ID: {task_id}")
                continue
        
        return JsonResponse({"managebacTasks": data})

@csrf_exempt
def index(request): 
    return render(request, "tasks/index.html")

def profile(request):    
    # Get Google client ID from settings
    google_client_id = getattr(settings, 'SOCIALACCOUNT_GOOGLE_CLIENT_ID', '')
    
    context = {
        'google_client_id': google_client_id
    }
    
    return render(request, "tasks/profile.html", context)

def login(request):
    return render(request, "tasks/login.html")

def logout_path(request):
    logout(request)
    return HttpResponseRedirect(reverse("login"))

def get_google_token(user):
    try:
        social_account = SocialAccount.objects.get(user=user, provider='google')
        social_token = SocialToken.objects.get(account=social_account)
        
        # Check if token needs refresh
        if social_token.expires_at:
            # Compare offset-aware datetimes
            if social_token.expires_at <= timezone.now():
                try:
                    app = SocialApp.objects.get(provider='google')
                    token_url = "https://oauth2.googleapis.com/token"
                    data = {
                        "client_id": app.client_id,
                        "client_secret": app.secret,
                        "refresh_token": social_token.token_secret,  # stored refresh token
                        "grant_type": "refresh_token",
                    }
                    response = requests.post(token_url, data=data)
                    new_token = response.json()
                    
                    if 'access_token' in new_token:
                        social_token.token = new_token['access_token']
                        # Update refresh token only if provided by Google
                        if 'refresh_token' in new_token:
                            social_token.token_secret = new_token['refresh_token']
                        # Set expires_at to a timezone-aware datetime
                        expires_in = int(new_token.get('expires_in', 0))
                        social_token.expires_at = timezone.now() + timedelta(seconds=expires_in)
                        social_token.save()
                        return social_token.token
                    else:
                        error_message = new_token.get('error_description', 'Unknown error')
                        print(f"Failed to refresh token: {new_token}")
                        # If the refresh token is invalid, we should delete it
                        if new_token.get('error') == 'invalid_grant':
                            social_token.delete()
                            print("Deleted invalid refresh token")
                        return None
                except Exception as e:
                    print(f"Failed to refresh token: {str(e)}")
                    return None
        
        return social_token.token
    except (SocialAccount.DoesNotExist, SocialToken.DoesNotExist) as e:
        print(f"Failed to get Google token: {str(e)}")
        return None
    except Exception as e:
        print(f"Unexpected error getting Google token: {str(e)}")
        return None

def google_tasks(request):
    access_token = get_google_token(request.user)

    if not access_token:
        print("Failed to fetch Google token.")
        return JsonResponse({
            "error": "Your Google session has expired. Please log in again.",
            "code": "TOKEN_EXPIRED",
            "redirect": "/login/"
        }, status=401)

    try:
        # First, get all courses
        url = "https://classroom.googleapis.com/v1/courses"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json"
        }

        response = requests.get(url, headers=headers)
        courses_data = response.json()

        if response.status_code != 200:
            error_message = courses_data.get('error', {}).get('message', 'Unknown error')
            error_code = courses_data.get('error', {}).get('code', 'UNKNOWN_ERROR')
            
            if error_code == 401 or 'invalid_grant' in error_message:
                return JsonResponse({
                    "error": "Your Google session has expired. Please log in again.",
                    "code": "TOKEN_EXPIRED",
                    "redirect": "/login/"
                }, status=401)
            
            return JsonResponse({
                "error": f"Failed to fetch courses: {error_message}",
                "code": error_code
            }, status=response.status_code)

        upcoming_tasks = []
        completed_tasks = []
        now = datetime.now()
        
        # Process courses and get coursework for each
        for course in courses_data.get("courses", []):
            course_id = course["id"]
            course_name = course["name"]
            
            # Get all coursework including past assignments
            coursework_url = f"https://classroom.googleapis.com/v1/courses/{course_id}/courseWork"
            coursework_params = {
                "courseWorkStates": "PUBLISHED",
                "orderBy": "dueDate desc"
            }
            
            coursework_response = requests.get(coursework_url, headers=headers)
            
            if coursework_response.status_code == 200:
                coursework_data = coursework_response.json()
                assignments = coursework_data.get("courseWork", [])
                
                for task in assignments:
                    # Create a task object with all necessary information
                    task_obj = {
                        "id": task.get("id"),
                        "title": task.get("title"),
                        "description": task.get("description", "No description provided"),
                        "course_id": course_id,
                        "course_name": course_name,
                        "link": task.get("alternateLink"),
                        "state": task.get("state"),
                        "max_points": task.get("maxPoints"),
                        "work_type": task.get("workType")
                    }
                    
                    # Process due date
                    due_date = task.get("dueDate")
                    due_time = task.get("dueTime")
                    
                    if due_date:
                        # Format due date string
                        day = due_date.get("day", 1)
                        month = due_date.get("month", 1)
                        year = due_date.get("year", 2025)
                        
                        date_str = f"{day}/{month}"
                        if due_time:
                            hours = due_time.get("hours", 0)
                            minutes = due_time.get("minutes", 0)
                            date_str += f" {hours:02d}:{minutes:02d}"
                        
                        # Store formatted date
                        task_obj["due-date"] = date_str

                        # Determine if task is upcoming or completed
                        task_date = datetime(
                            year, 
                            month, 
                            day,
                            due_time.get("hours", 23) if due_time else 23,
                            due_time.get("minutes", 59) if due_time else 59
                        )
                        
                        if task_date >= now:
                            upcoming_tasks.append(task_obj)
                        else:
                            completed_tasks.append(task_obj)
                    else:
                        # No due date, consider it upcoming
                        task_obj["due_date"] = "No due date"
                        upcoming_tasks.append(task_obj)
            else:
                print(f"Failed to fetch assignments for course {course_name}: {coursework_response.status_code}")
        return JsonResponse({
            "upcoming": upcoming_tasks,
            "completed": completed_tasks
        })
    
    except Exception as e:
        print(f"Error in google_tasks: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)

def google_tasks_save(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            selected_task_ids = data.get("selectedTasks", [])
            
            if not selected_task_ids:
                return JsonResponse({"error": "No tasks selected"}, status=400)
            
            # Get token to fetch task details
            access_token = get_google_token(request.user)
            
            if not access_token:
                return JsonResponse({"error": "Failed to fetch Google token."}, status=400)
            
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Get all courses first to have course names
            courses_url = "https://classroom.googleapis.com/v1/courses"
            courses_response = requests.get(courses_url, headers=headers)
            courses_data = courses_response.json()
            
            # Map course IDs to names
            course_names = {}
            for course in courses_data.get("courses", []):
                course_names[course["id"]] = course["name"]
            
            saved_count = 0
            skipped_count = 0
            
            for task_id in selected_task_ids:
                # We need to find which course this task belongs to by trying each course
                found = False
                
                for course_id in course_names:
                    coursework_url = f"https://classroom.googleapis.com/v1/courses/{course_id}/courseWork/{task_id}"
                    
                    try:
                        task_response = requests.get(coursework_url, headers=headers)
                        
                        if task_response.status_code != 200:
                            continue  # Task not in this course, try next
                            
                        # We found the task
                        found = True
                        assignment = task_response.json()
                        
                        # Extract due date properly
                        due_date_dict = assignment.get("dueDate", {})                        
                        if due_date_dict:
                            try:
                                # Construct the date string with year, month, and day
                                year = int(due_date_dict.get('year', 2025))
                                month = int(due_date_dict.get('month', 1))
                                day = int(due_date_dict.get('day', 1))

                                due_date = date(year, month, day)
                                
                            except Exception as e:
                                print(f"Error processing due date: {e}")
                                due_date = None
                        else:
                            due_date = None  # No due date provided
                        
                        # Skip if task already exists
                        if Task.objects.filter(user=request.user, source_id=assignment["id"], source="google_classroom").exists():
                            skipped_count += 1
                            break  # Move to next task
                        
                        estimated_time, reasoning = estimate_task_time(f"Title: {assignment['title']}\n Description: {assignment.get('description', '')}")
                        # Create the task
                        try:
                            Task.objects.create(
                                user=request.user,
                                title=assignment["title"],
                                description=assignment.get("description", ""),
                                source="google_classroom",
                                source_id=assignment["id"],
                                due_date=due_date,
                                time_estimate=timedelta(minutes=int(estimated_time)),
                                reasoning=reasoning
                            )
                            saved_count += 1
                            print(f"Successfully created task: {assignment['title']}")
                        except Exception as e:
                            print(f"Error creating task: {str(e)}")
                            
                        break  # Found and processed, move to next task
                        
                    except Exception as e:
                        print(f"Error processing task {task_id} from course {course_id}: {str(e)}")
                
                if not found:
                    print(f"Could not find task with ID {task_id} in any course")
            
            return JsonResponse({
                "status": "success", 
                "message": f"Successfully imported {saved_count} tasks from Google Classroom. {skipped_count} already existed."
            })
            
        except Exception as e:
            print(f"Error in google_tasks_save: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Method not allowed"}, status=405)

def edit_assignment(request, task_id):
    if request.method == "PUT":
        data = json.loads(request.body)
        assignment = Task.objects.get(id=task_id)
        assignment.title = data.get("title")
        assignment.description = data.get("description")
        assignment.due_date = data.get("due_date")
        assignment.status = data.get("status")
        
        # Convert seconds to timedelta if an integer is provided
        time_estimate = data.get("time_estimate")
        if time_estimate is not None:
            if isinstance(time_estimate, int):
                assignment.time_estimate = timedelta(seconds=time_estimate)
            else:
                assignment.time_estimate = time_estimate
                
        assignment.save()
        print("assignment_saved")
        
    assignment = Task.objects.get(id=task_id)
    
    return JsonResponse({
        'id': assignment.id,
        'title': assignment.title,
        'description': assignment.description,
        'due_date': assignment.due_date,
        'status': assignment.status,
        'time_estimate': assignment.time_estimate
    })

def tasks(request):
    return render(request, "tasks/tasks.html")

def new_task(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        
        # Convert seconds to timedelta if an integer is provided
        time_estimate = data.get("time_estimate")
        if time_estimate is not None and isinstance(time_estimate, int):
            time_estimate = timedelta(seconds=time_estimate)
            
        new_task = Task.objects.create(
            user = request.user,
            title = data.get("title"),
            description = data.get("description"),
            due_date = data.get("due_date"),
            status = data.get("status"),
            time_estimate = time_estimate
        )
        
        return JsonResponse({"status": "success", "task_id": new_task.id})
    
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def delete_task(request, task_id):
    if request.method == "DELETE":
        try:
            task = Task.objects.get(id=task_id, user=request.user)
            task.delete()
            return JsonResponse({"message": "Task deleted successfully."}, status=200)
        except Task.DoesNotExist:
            return JsonResponse({"error": "Task not found."}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Method not allowed"}, status=405)
        
def fetch_assignments(request):
    assignments = Task.objects.filter(user=request.user).order_by("due_date")
    assignments_list = list(assignments.values("title", "description", "due_date", 
                    "source", "completed", "status", "id", "time_estimate"))
    return JsonResponse({"assignments": assignments_list})

@csrf_exempt
def update_task_status(request, task_id):
    if request.method == "PUT":
        data = json.loads(request.body)
        status = data.get("status")

        task = Task.objects.get(id=task_id)
        task.status = status
        task.save()

        return JsonResponse({"message": "Task updated successfully."}, status=200)

def estimate_task_time(task_description):
    print("estimate_task_time")
    
    try:
        # Ollama API endpoint
        url = "http://localhost:11434/api/generate"
        
        # Prepare the prompt
        prompt = f"""Given this task description, estimate the time needed in minutes. Check if this task is a complex academic assignment that will likely require significant time.
        
        {task_description}
        
        Consider:
        - Complexity of the task
        - Required research/reading
        - Writing/creation time
        - Review/editing time
        
        Return your response as valid JSON in the following format exactly:
        {{
            "estimated_time": estimated_time,
            "reasoning": "Your detailed explanation here"
        }}
        
        Make sure the estimated_time is just the integer number of minutes, and reasoning contains your detailed explanation. Return ONLY the JSON object, nothing else."""
        
        payload = {
            "model": "qwen2.5:7b",
            "prompt": prompt,       
            "stream": False,
            "options": {
                "num_ctx": 16000,
                "temperature": 0
            }
        }
                    
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        # Extract the full response
        full_response = response.json().get("response", "")
        
        # Try to parse JSON from the response
        try:
            # Find JSON in the response (in case there's other text)
            json_start = full_response.find('{')
            json_end = full_response.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = full_response[json_start:json_end]
                parsed_response = json.loads(json_str)
                
                estimated_time = parsed_response.get("estimated_time", 0)
                reasoning = parsed_response.get("reasoning", "")
                print(f"Estimated time: {estimated_time}")
                print(f"Reasoning: {reasoning}")

                return estimated_time, reasoning
            else:
                return("No JSON found in response")
        
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")

            return {
                "status": "failed",
                "estimated_time": 0,
                "reasoning": "Failed to parse JSON",
                "note": "Fallback parsing used"
            }
    except Exception as e:
        print("Unexpected error:", str(e))
        return {
            "status": "error",
            "message": f"Unexpected error: {str(e)}"
        }

def schedule_tasks(request):
    if request.method == "POST":
        data = json.loads(request.body)
        total_minutes = data.get("totalMinutes")
        print(f"The user has {total_minutes} minutes available")

        tasks = Task.objects.filter(user=request.user, status__in=["not_started", "in_progress"]).values()
        task_descriptions = [f"Task {task['id']}: {task['title']}. Description: {task['description']}. Due: {task['due_date']}" 
                         for i, task in enumerate(tasks)]

        today = datetime.today().strftime("%Y-%m-%d")

        try:
            url = "http://localhost:11434/api/generate"

            prompt = f"""Analyze these tasks and rate each on a scale of 1-10 for urgency and importance based on:
            1. Deadline proximity, today is {today}, the due date is in the format YYYY-MM-DD
                - If the days to due date is negative, the task is overdue, so the priority score should be high
            2. Task complexity
            3. Task impact
            4. Dependencies with other tasks
            
            Tasks:
            {task_descriptions}
            
            For each task, provide a priority score and brief reasoning. Return as JSON:
            [
            {{
                "task_id": task ID number,
                "task_title": task title,
                "due_date": task due date,
                "days_until_due": days until due,
                "priority_score": score (1-10),
                "reasoning": "Brief explanation"
            }}
            ]
            """
            
            payload = {
                "model": "qwen2.5:7b",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_ctx": 14000,
                    "temperature": 0
                }
            }

            response = requests.post(url, json=payload)
            response.raise_for_status()

            full_response = response.json().get("response", "")
            
            # Extract only the JSON part
            json_response = None
            try:
                # First try to find and extract text between triple backticks
                import re
                json_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', full_response)
                
                if json_block_match:
                    # If JSON was in a code block, extract just the content
                    json_str = json_block_match.group(1).strip()
                else:
                    # If no code block, look for JSON structure directly
                    json_start = full_response.find('[')
                    json_end = full_response.rfind(']') + 1
                    
                    if json_start >= 0 and json_end > json_start:
                        json_str = full_response[json_start:json_end].strip()
                    else:
                        # Try object notation as fallback
                        json_start = full_response.find('{')
                        json_end = full_response.rfind('}') + 1
                        
                        if json_start >= 0 and json_end > json_start:
                            json_str = full_response[json_start:json_end].strip()
                        else:
                            return JsonResponse({"error": "Could not extract JSON from LLM response"}, status=400)
                
                # Parse the extracted JSON
                json_response = json.loads(json_str)
                pprint.pprint(json_response)
                
                # Retrieve time estimates for each task and add them to the JSON
                for task_info in json_response:
                    task_id = task_info["task_id"]

                    try:
                        # Get the task from the database to access its time_estimate
                        task = Task.objects.get(id=task_id, user=request.user)
                        task_info["task_title"] = task.title
                        # Convert timedelta to minutes
                        if task.time_estimate:
                            # Convert timedelta to string first
                            time_str = str(task.time_estimate)
                            
                            # Split the time string by colons
                            parts = time_str.split(':')
    
                            # Extract hours, minutes, and seconds
                            hours = int(parts[0]) if parts[0].isdigit() else 0
                            minutes = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
                            seconds = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
                            
                            # Calculate total minutes, including the seconds portion
                            estimated_minutes = hours * 60 + minutes + round(seconds / 60)

                            task_info["estimated_minutes"] = estimated_minutes
                        else:
                            # Default to 30 minutes if no estimate is available
                            task_info["estimated_minutes"] = 30
                            
                    except Task.DoesNotExist:
                        # Default value if task not found
                        task_info["estimated_minutes"] = 30
                
                # Sort tasks by priority score (highest first)
                sorted_tasks = sorted(json_response, key=lambda x: x["priority_score"], reverse=True)
                
                # Pack tasks into the available time
                scheduled_tasks = []
                remaining_minutes = total_minutes
                
                for task in sorted_tasks:
                    task_duration = task["estimated_minutes"]
                    
                    # If this task fits in the remaining time
                    if task_duration <= remaining_minutes:
                        # Mark this task as selected for today
                        task["selected"] = True
                        scheduled_tasks.append(task)
                        remaining_minutes -= task_duration
                    else:
                        # Mark this task as not selected
                        task["selected"] = False
                
                result = {
                    "prioritized_tasks": sorted_tasks,
                    "scheduled_tasks": scheduled_tasks,
                    "total_available_minutes": total_minutes,
                    "remaining_minutes": remaining_minutes,
                    "scheduled_minutes": total_minutes - remaining_minutes
                }
                
                # Return the properly processed task scheduling
                return JsonResponse(result, status=200)
                
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON: {e}")
                return JsonResponse({"error": f"Invalid JSON: {str(e)}"}, status=400)
            except Exception as e:
                print("Unexpected error:", str(e))
                return JsonResponse({"error": str(e)}, status=500)

        except Exception as e:
            print("Unexpected error:", str(e))
            return JsonResponse({"error": str(e)}, status=500)
            
def format_timedelta(td):
    """Convert timedelta to readable format."""
    total_minutes = int(td.total_seconds() / 60)
    hours = total_minutes // 60
    minutes = total_minutes % 60
    
    if hours > 0 and minutes > 0:
        return f"{hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h"
    else:
        return f"{minutes}m"


