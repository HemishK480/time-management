from django.urls import path

from . import views


urlpatterns = [
    path("", views.index, name="index"),
    path("profile/", views.profile, name="profile"),
    path('login/', views.login, name='login'),
    path('logout/', views.logout_path, name='logout'),
    
    
    path('fetch-assignments/', views.fetch_assignments, name='fetch_assignments'),
    path('update-task-status/<int:task_id>/', views.update_task_status, name="update_task_status"),
    path('edit_assignment/<int:task_id>/', views.edit_assignment, name='edit_assignment'),
    path('managebac/', views.managebac, name='managebac')
]