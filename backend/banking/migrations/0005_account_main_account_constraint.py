from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('banking', '0004_account_is_main'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='account',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_main=True),
                fields=('owner',),
                name='unique_main_account_per_owner',
            ),
        ),
    ]