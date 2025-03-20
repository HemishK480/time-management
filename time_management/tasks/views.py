import asyncio
import json
import os
import time

from bs4 import BeautifulSoup
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import redirect, render
from django.contrib.auth import authenticate, login, logout
from allauth.socialaccount.models import SocialAccount, SocialToken
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt

from .models import Task

import requests
from datetime import datetime

from tasks import managebac_api
import pprint


# Create your views here.

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'



def login_managebac(domain, username, password):
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
    
    print("Retrieved cookie:", cookie)
    end = time.perf_counter()
    print(f"Cookie retrived in {end - start:.4f} seconds")
    return cookie


def managebac(request):
    if request.method == "PUT":
        data = json.loads(request.body)
        username = data.get("username")
        password = data.get("password")
        
        cookie = login_managebac("gwa", username, password)
        
        start = time.perf_counter()
        result = asyncio.run(managebac_api.mbapi2("gwa", cookie))
        end = time.perf_counter()
        
        for i, task in enumerate(result["tasks"]):
            print(f"{i}: {task["title"]}\n===========================================================")
        print(f"Total time: {end - start:.4f} seconds")

        return JsonResponse({"message": "ManageBac login successful."}, status=200)


@csrf_exempt
def index(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        new_task = Task.objects.create(
            user = request.user,
            title = data.get("title"),
            description = data.get("description"),
            due_date = data.get("due_date"),
            status = data.get("status")
        )
        
        return JsonResponse({"status": "success", "task_id": new_task.id})
        
    return render(request, "tasks/index.html")

def profile(request):
    return render(request, "tasks/profile.html")

def login(request):
    return render(request, "tasks/login.html")

def logout_path(request):
    logout(request)
    return HttpResponseRedirect(reverse("login"))

def get_google_token(user):
    try:
        social_account = SocialAccount.objects.get(user=user, provider='google')
        social_token = SocialToken.objects.get(account=social_account)
                
        return social_token.token
    except (SocialAccount.DoesNotExist, SocialToken.DoesNotExist):
        return None
        
def save_assignments(request):
    access_token = get_google_token(request.user)
    
    print("function called")

    if not access_token:
        return JsonResponse({"error": "Failed to fetch Google token."}, status=400)

    try:
        url = "https://classroom.googleapis.com/v1/courses"
        headers = {"Authorization": f"Bearer {access_token}"}

        response = requests.get(url, headers=headers)
        courses = response.json()
        pprint.pprint(courses)

        if response.status_code != 200:
            return JsonResponse({"error": f"Failed to fetch courses: {courses.get('error', {}).get('message', 'Unknown error')}"}, status=400)


        for course in courses.get("courses", []):
            course_id = course["id"]
            course_name = course["name"]

            coursework_url = f"https://classroom.googleapis.com/v1/courses/{course_id}/courseWork"
            coursework_response = requests.get(coursework_url, headers=headers)
            coursework = coursework_response.json()
            pprint.pprint(coursework)

            if coursework_response.status_code == 200:
                for assignment in coursework.get("courseWork", []):

                    # Extract due date properly
                    due_date_dict = assignment.get("dueDate", {})
                    if due_date_dict:
                        # Construct the date string with year, month, and day
                        due_date_str = f"{due_date_dict.get('year', '0000')}-{due_date_dict.get('month', '00')}-{due_date_dict.get('day', '00')}"

                        # Check if time data is present and add it to the string if so
                        if 'hour' in due_date_dict and 'minute' in due_date_dict and 'second' in due_date_dict:
                            due_date_str += f" {due_date_dict.get('hour', 0)}:{due_date_dict.get('minute', 0)}:{due_date_dict.get('second', 0)}"

                        # Convert to datetime if the date string is valid
                        due_date = datetime.strptime(due_date_str, "%Y-%m-%d %H:%M:%S" if 'hour' in due_date_dict else "%Y-%m-%d")
                    else:
                        due_date = None  # No due date provided

                    # Check if the task already exists
                    if not Task.objects.filter(user=request.user, title=assignment["title"]).exists():
                        new_assignment = Task.objects.create(
                            user=request.user,
                            title=assignment["title"],
                            description=assignment["description"],
                            source="google_classroom",
                            due_date=due_date,
                        )
                        print(f"Task '{assignment['title']}' saved!")
            else:
                return JsonResponse({"error": f"Failed to fetch assignments: {coursework.get('error', {}).get('message', 'Unknown error')}"}, status=400)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
    
def fetch_assignments(request):
    assignments = Task.objects.filter(user=request.user).order_by("due_date")
    assignments_list = list(assignments.values("title", "description", "due_date", "importance", "source", "completed", "status", "id"))

    return JsonResponse({"assignments": assignments_list})

def edit_assignment(request, task_id):
    if request.method == "PUT":
        data = json.loads(request.body)
        assignment = Task.objects.get(id=task_id)
        assignment.title = data.get("title")
        assignment.description = data.get("description")
        assignment.due_date = data.get("due_date")
        assignment.status = data.get("status")
        assignment.save()
        print("assignment_saved")
        
    assignment = Task.objects.get(id=task_id)
    
    return JsonResponse({
        'id': assignment.id,
        'title': assignment.title,
        'description': assignment.description,
        'due_date': assignment.due_date,
        'status': assignment.status
    })
    
@csrf_exempt
def update_task_status(request, task_id):
    if request.method == "PUT":
        data = json.loads(request.body)
        status = data.get("status")

        task = Task.objects.get(id=task_id)
        task.status = status
        task.save()

        return JsonResponse({"message": "Task updated successfully."}, status=200)


