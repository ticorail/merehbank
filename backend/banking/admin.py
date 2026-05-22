from decimal import Decimal

from django import forms
from django.contrib import admin, messages
from django.contrib.admin.helpers import ActionForm
from django.db import transaction as db_transaction
from .models import Account, Transaction


class AccountOverdraftActionForm(ActionForm):
    overdraft_limit = forms.DecimalField(
        label='Limite de découvert',
        min_value=Decimal('0.00'),
        decimal_places=2,
        max_digits=14,
        required=True,
        help_text='Montant de la limite à accorder aux comptes sélectionnés.',
    )


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('account_number', 'owner', 'currency', 'balance', 'overdraft_limit', 'created_at')
    list_editable = ('overdraft_limit',)
    search_fields = ('account_number', 'owner__username', 'owner__email')
    list_filter = ('currency', 'account_type', 'created_at')
    actions = ('grant_overdraft_limit',)
    action_form = AccountOverdraftActionForm

    @admin.action(description='Accorder une limite de découvert')
    def grant_overdraft_limit(self, request, queryset):
        overdraft_limit = request.POST.get('overdraft_limit')
        if overdraft_limit in (None, ''):
            self.message_user(
                request,
                'Veuillez saisir une limite de découvert avant de lancer cette action.',
                level=messages.ERROR,
            )
            return

        try:
            amount = Decimal(overdraft_limit)
        except Exception:
            self.message_user(
                request,
                'La limite de découvert saisie est invalide.',
                level=messages.ERROR,
            )
            return

        if amount < 0:
            self.message_user(
                request,
                'La limite de découvert doit être positive ou nulle.',
                level=messages.ERROR,
            )
            return

        updated_count = queryset.update(overdraft_limit=amount)
        self.message_user(
            request,
            f'Limite de découvert mise à jour pour {updated_count} compte{"s" if updated_count > 1 else ""}.',
            level=messages.SUCCESS,
        )


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('transaction_type', 'amount', 'account', 'source_account', 'destination_account', 'timestamp')

    def save_model(self, request, obj, form, change):
        """When a transaction is created via admin, apply its effect to account balances.

        Only apply on creation (not on edit) to avoid double-applying.
        """
        is_creation = obj.pk is None
        with db_transaction.atomic():
            super().save_model(request, obj, form, change)

            if not is_creation:
                return

            amount = obj.amount

            # Deposit into `account`
            if obj.transaction_type == 'deposit' and obj.account is not None:
                acct = Account.objects.select_for_update().get(pk=obj.account.pk)
                acct.balance = acct.balance + amount
                acct.save()

            # Withdrawal from `account`
            if obj.transaction_type == 'withdrawal' and obj.account is not None:
                acct = Account.objects.select_for_update().get(pk=obj.account.pk)
                acct.balance = acct.balance - amount
                acct.save()

            # Transfer between source_account and destination_account
            if obj.transaction_type == 'transfer' and obj.source_account and obj.destination_account:
                src = Account.objects.select_for_update().get(pk=obj.source_account.pk)
                dst = Account.objects.select_for_update().get(pk=obj.destination_account.pk)
                src.balance = src.balance - amount
                dst.balance = dst.balance + amount
                src.save()
                dst.save()
