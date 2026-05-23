from decimal import Decimal

from django.db import migrations


def reset_overdraft_limits(apps, schema_editor):
    Account = apps.get_model('banking', 'Account')
    Account.objects.all().update(overdraft_limit=Decimal('0.00'))


class Migration(migrations.Migration):
    dependencies = [
        ('banking', '0010_moneyrequest_status_timestamps'),
    ]

    operations = [
        migrations.RunPython(reset_overdraft_limits, migrations.RunPython.noop),
    ]
