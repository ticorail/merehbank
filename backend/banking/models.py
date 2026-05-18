from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction


class Account(models.Model):
    ACCOUNT_TYPE_CHECKING = 'checking'
    ACCOUNT_TYPE_SAVINGS = 'savings'
    ACCOUNT_TYPE_CHOICES = [
        (ACCOUNT_TYPE_CHECKING, 'Checking'),
        (ACCOUNT_TYPE_SAVINGS, 'Savings'),
    ]

    CURRENCY_HTG = 'HTG'
    CURRENCY_USD = 'USD'
    CURRENCY_CHOICES = [
        (CURRENCY_HTG, 'Gourdes (HTG)'),
        (CURRENCY_USD, 'US Dollar (USD)'),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='accounts')
    account_number = models.CharField(max_length=34, unique=True)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    account_type = models.CharField(max_length=10, choices=ACCOUNT_TYPE_CHOICES, default=ACCOUNT_TYPE_CHECKING)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_HTG)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'currency'], name='unique_owner_currency')
        ]

    def __str__(self):
        owner_name = getattr(self.owner, 'username', str(self.owner))
        return f"{owner_name} — {self.account_number} ({self.account_type}, {self.currency})"

    @transaction.atomic
    def deposit(self, amount):
        """Déposer de l'argent sur ce compte."""
        if amount <= 0:
            raise ValidationError('Le montant du dépôt doit être positif.')
        self.balance += amount
        self.save()
        Transaction.objects.create(
            transaction_type=Transaction.TYPE_DEPOSIT,
            amount=amount,
            account=self,
            description=f'Dépôt de {amount} {self.currency}',
        )
        return self.balance

    @transaction.atomic
    def withdraw(self, amount):
        """Retirer de l'argent de ce compte."""
        if amount <= 0:
            raise ValidationError('Le montant du retrait doit être positif.')
        if self.balance < amount:
            raise ValidationError(f'Solde insuffisant. Disponible : {self.balance} {self.currency}')
        self.balance -= amount
        self.save()
        Transaction.objects.create(
            transaction_type=Transaction.TYPE_WITHDRAWAL,
            amount=amount,
            account=self,
            description=f'Retrait de {amount} {self.currency}',
        )
        return self.balance

    @transaction.atomic
    def transfer(self, destination_account, amount):
        """Transférer de l'argent vers un autre compte."""
        source_id = self.pk
        destination_id = destination_account.pk

        if amount <= 0:
            raise ValidationError('Le montant du transfert doit être positif.')
        if source_id == destination_id:
            raise ValidationError('Impossible de transférer vers le même compte.')

        first_id, second_id = sorted([source_id, destination_id])
        locked_accounts = (
            Account.objects.select_for_update().filter(pk__in=[first_id, second_id]).order_by('pk')
        )
        source_account, destination_account = locked_accounts

        if source_account.currency != destination_account.currency:
            raise ValidationError(f'Les devises doivent correspondre. Source : {source_account.currency}, Destination : {destination_account.currency}')
        if source_account.balance < amount:
            raise ValidationError(f'Solde insuffisant. Disponible : {source_account.balance} {source_account.currency}')

        # Débiter la source, créditer la destination
        source_account.balance -= amount
        source_account.save()
        destination_account.balance += amount
        destination_account.save()

        # Créer un enregistrement de transaction de transfert
        
        Transaction.objects.create(
            transaction_type=Transaction.TYPE_TRANSFER,
            amount=amount,
            source_account=source_account,
            destination_account=destination_account,
            description=f'Transfert de {amount} {source_account.currency} vers {destination_account.account_number}',
        )
        return source_account.balance


class Transaction(models.Model):
    TYPE_DEPOSIT = 'deposit'
    TYPE_WITHDRAWAL = 'withdrawal'
    TYPE_TRANSFER = 'transfer'
    TRANSACTION_TYPE_CHOICES = [
        (TYPE_DEPOSIT, 'Deposit'),
        (TYPE_WITHDRAWAL, 'Withdrawal'),
        (TYPE_TRANSFER, 'Transfer'),
    ]

    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    timestamp = models.DateTimeField(auto_now_add=True)

    # Pour les dépôts/retraits, le champ compte est le compte affecté.

    account = models.ForeignKey('Account', null=True, blank=True, related_name='transactions', on_delete=models.CASCADE)

    # Pour les transferts, la source et la destination peuvent être utilisées.

    source_account = models.ForeignKey('Account', null=True, blank=True, related_name='outgoing_transfers', on_delete=models.SET_NULL)
    destination_account = models.ForeignKey('Account', null=True, blank=True, related_name='incoming_transfers', on_delete=models.SET_NULL)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.transaction_type} {self.amount} on {self.timestamp.isoformat()}"

    def clean(self):

        # Valider que les transferts utilisent des comptes avec la même devise

        if self.transaction_type == self.TYPE_TRANSFER:
            src = self.source_account
            dst = self.destination_account
            if src and dst and src.currency != dst.currency:
                raise ValidationError('Les comptes source et destination doivent avoir la même devise pour les transferts.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
