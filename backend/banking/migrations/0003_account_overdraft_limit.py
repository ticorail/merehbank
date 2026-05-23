from decimal import Decimal

from django.db import migrations, models


def populate_overdraft_limits(apps, schema_editor):
    Account = apps.get_model('banking', 'Account')

    Account.objects.filter(currency='HTG').update(overdraft_limit=Decimal('25000.00'))
    Account.objects.filter(currency='USD').update(overdraft_limit=Decimal('250.00'))


class Migration(migrations.Migration):

    dependencies = [
        ('banking', '0002_revokedaccesstoken'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='overdraft_limit',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14),
        ),
        migrations.RunPython(populate_overdraft_limits, migrations.RunPython.noop),
    ]
