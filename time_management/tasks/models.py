from django.db import models
from django.contrib.auth.models import User
from datetime import timedelta


# Create your models here.


class Task(models.Model):
    SOURCE_CHOICES = [
        ('manual', 'Manual'),
        ('google_classroom', 'Google Classroom'),
        ('managebac', 'Managebac'),
    ]
    
    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('no_status', 'No Status'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateField(blank=True, null=True)

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    source_id = models.CharField(max_length=100, blank=True, null=True, help_text="External ID from the source system")

    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    archived = models.BooleanField(default=False)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='no_status')

    time_estimate = models.DurationField(help_text="Estimated time to complete the task (e.g., 2:30:00 for 2 hours 30 minutes)", default=timedelta())
    reasoning = models.TextField(blank=True)

    def __str__(self):
        return self.title


class SubTask(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='subtasks')

    title = models.CharField(max_length=200)
    time_estimate = models.DurationField(
        help_text="Estimated time to complete the subtask (e.g., 0:30:00 for 30 minutes)", 
        default=timedelta()
    )

    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    actual_time = models.DurationField(
        help_text="Actual time spent on the subtask (e.g., 0:45:00 for 45 minutes)", 
        default=timedelta(),
        blank=True,
        null=True
    )

    order = models.PositiveIntegerField(default=0)
    
    def __str__(self):
        return f"{self.task.title} - {self.title}"
    
