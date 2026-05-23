from decimal import Decimal

from django.db import migrations


def record_currency_credit_transactions(apps, schema_editor):
    Account = apps.get_model('banking', 'Account')
    Transaction = apps.get_model('banking', 'Transaction')

    accounts = Account.objects.order_by('pk').only('pk', 'currency')

    for account in accounts:
        if account.currency == 'USD':
            amount = Decimal('360.00')
            description = 'Crédit de migration: +360 USD'
        elif account.currency == 'HTG':
            amount = Decimal('10000.00')
            description = 'Crédit de migration: +10000 HTG'
        else:
            continue

        Transaction.objects.create(
            transaction_type='deposit',
            amount=amount,
            account=account,
            description=description,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('banking', '0006_credit_accounts_by_currency'),
    ]

    operations = [
        migrations.RunPython(record_currency_credit_transactions, migrations.RunPython.noop),
    ]