import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.dev')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
qs = list(User.objects.filter(is_superuser=True).values('id','username','email','is_staff','is_superuser','role'))
print(qs)
