import os
import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings.dev")
print("USE_SQLITE:", os.getenv("USE_SQLITE"))
print("DJANGO_SETTINGS_MODULE:", os.getenv("DJANGO_SETTINGS_MODULE"))

# Do not call django.setup() to avoid touching DB; just import settings
print("ENGINE:", settings.DATABASES['default']['ENGINE'])
print("NAME:", settings.DATABASES['default']['NAME'])
print("HOST:", settings.DATABASES['default'].get('HOST'))
print("PORT:", settings.DATABASES['default'].get('PORT'))
