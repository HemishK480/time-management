from allauth.account.signals import user_logged_in
from django.dispatch import receiver
from django.http import JsonResponse
from .views import save_assignments  

@receiver(user_logged_in)
def user_logged_in_handler(sender, request, user, **kwargs):
    print(f"User {user.username} logged in.")  # For debugging
    save_assignments(request)