"""
WSGI config for time_management project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/wsgi/
"""

import os
# pylint: disable=import-error
from whitenoise import WhiteNoise
from django.core.wsgi import get_wsgi_application
from pathlib import Path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "time_management.settings")

application = get_wsgi_application()
application = WhiteNoise(application, root=Path(__file__).resolve().parent.parent / 'staticfiles')
