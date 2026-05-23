from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('banking', '0009_moneyrequest_currency'),
    ]

    operations = [
        migrations.AddField(
            model_name='moneyrequest',
            name='accepted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='moneyrequest',
            name='rejected_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
