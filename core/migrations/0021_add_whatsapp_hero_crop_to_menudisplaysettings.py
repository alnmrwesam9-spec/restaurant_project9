"""
Add whatsapp and hero_crop fields to MenuDisplaySettings.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0020_alter_additivelegend_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="menudisplaysettings",
            name="whatsapp",
            field=models.CharField(max_length=64, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="menudisplaysettings",
            name="hero_crop",
            field=models.CharField(max_length=16, blank=True, default="center"),
        ),
    ]

