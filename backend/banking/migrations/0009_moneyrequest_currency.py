from django.db import migrations, models


def populate_money_request_currency(apps, schema_editor):
    MoneyRequest = apps.get_model('banking', 'MoneyRequest')

    for money_request in MoneyRequest.objects.select_related('requester_account'):
        if money_request.requester_account_id:
            MoneyRequest.objects.filter(pk=money_request.pk).update(
                currency=money_request.requester_account.currency,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('banking', '0008_alter_account_options_moneyrequest_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='moneyrequest',
            name='currency',
            field=models.CharField(choices=[('HTG', 'Gourdes (HTG)'), ('USD', 'US Dollar (USD)')], max_length=3, null=True),
        ),
        migrations.RunPython(populate_money_request_currency, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='moneyrequest',
            name='currency',
            field=models.CharField(choices=[('HTG', 'Gourdes (HTG)'), ('USD', 'US Dollar (USD)')], max_length=3),
        ),
    ]