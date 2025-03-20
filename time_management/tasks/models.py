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
    importance = models.PositiveIntegerField(default=1)  # You can later refine how you calculate this
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='no_status')

    time_estimate = models.DurationField(help_text="Estimated time to complete the task (e.g., 2:30:00 for 2 hours 30 minutes)", default=timedelta())

    managebac = models.JSONField(blank=True, null=True)

    def __str__(self):
        return self.title
    
