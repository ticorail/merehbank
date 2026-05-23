from django.db import migrations, models


def populate_main_accounts(apps, schema_editor):
    Account = apps.get_model('banking', 'Account')

    owner_ids = (
        Account.objects.order_by()
        .values_list('owner_id', flat=True)
        .distinct()
    )

    for owner_id in owner_ids:
        main_account = (
            Account.objects.filter(owner_id=owner_id)
            .order_by('created_at', 'pk')
            .first()
        )
        if main_account is not None:
            Account.objects.filter(owner_id=owner_id).update(is_main=False)
            Account.objects.filter(pk=main_account.pk).update(is_main=True)


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('banking', '0003_account_overdraft_limit'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='is_main',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(populate_main_accounts, migrations.RunPython.noop),
    ]
