from django.urls import path

from . import views


urlpatterns = [
    path("", views.index, name="index"),
    path("tasks/", views.tasks, name="tasks"),
    path("profile/", views.profile, name="profile"),
    path('login/', views.login, name='login'),
    path('logout/', views.logout_path, name='logout'),
    
    path("new-task/", views.new_task, name="new_task"),
    path('fetch-assignments/', views.fetch_assignments, name='fetch_assignments'),
    path('update-task-status/<int:task_id>/', views.update_task_status, name="update_task_status"),
    path('edit-assignment/<int:task_id>/', views.edit_assignment, name='edit_assignment'),
    path('delete-task/<int:task_id>/', views.delete_task, name='delete_task'),

    path('managebac/tasks/', views.managebac_tasks, name='managebac_tasks'),
    path('managebac/login/', views.login_managebac, name='managebac_login'),
    path('managebac/add/', views.managebac_tasks_save, name="managebac_add"),

    path('google/tasks/', views.google_tasks, name='google_tasks'),
    path('google/add/', views.google_tasks_save, name='google_classroom_add'),

    path('estimate-time/', views.estimate_task_time, name='estimate_task_time'),
    path('schedule-tasks/', views.schedule_tasks, name='schedule_tasks'),
    path('create-subtasks/', views.create_subtasks, name='create_subtasks'),
]