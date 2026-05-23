from decimal import Decimal

from django.db import migrations, models


def credit_accounts_by_currency(apps, schema_editor):
    Account = apps.get_model('banking', 'Account')

    Account.objects.filter(currency='USD').update(balance=models.F('balance') + Decimal('360.00'))
    Account.objects.filter(currency='HTG').update(balance=models.F('balance') + Decimal('10000.00'))


class Migration(migrations.Migration):

    dependencies = [
        ('banking', '0005_account_main_account_constraint'),
    ]

    operations = [
        migrations.RunPython(credit_accounts_by_currency, migrations.RunPython.noop),
    ]