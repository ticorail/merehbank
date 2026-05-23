import os
from django.contrib.auth import get_user_model

User = get_user_model()

username = os.getenv("ADMIN_USERNAME")
email = os.getenv("ADMIN_EMAIL")
password = os.getenv("ADMIN_PASSWORD")

if not username or not password:
    print("Missing admin env variables")
else:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(
            username=username,
            email=email,
            password=password
        )
        print("Superuser created")
    else:
        print("Superuser already exists")