from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from .exchange import get_rate


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
    overdraft_limit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    account_type = models.CharField(max_length=10, choices=ACCOUNT_TYPE_CHOICES, default=ACCOUNT_TYPE_CHECKING)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_HTG)
    is_main = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_main', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'currency'], name='unique_owner_currency'),
            models.UniqueConstraint(
                fields=['owner'],
                condition=models.Q(is_main=True),
                name='unique_main_account_per_owner',
            ),
        ]

    def __str__(self):
        owner_name = getattr(self.owner, 'username', str(self.owner))
        return f"{owner_name} — {self.account_number} ({self.account_type}, {self.currency})"

    @property
    def available_balance(self):
        return self.balance + self.overdraft_limit

    @classmethod
    def build_account_number(cls, user, currency):
        return f'{currency}{user.pk:06d}'

    @classmethod
    @transaction.atomic
    def create_for_user(cls, owner, currency, account_type=ACCOUNT_TYPE_CHECKING):
        owner_model = owner.__class__
        owner_model.objects.select_for_update().get(pk=owner.pk)
        has_existing_accounts = cls.objects.select_for_update().filter(owner=owner).exists()

        return cls.objects.create(
            owner=owner,
            account_number=cls.build_account_number(owner, currency),
            currency=currency,
            account_type=account_type,
            overdraft_limit=Decimal('0.00'),
            is_main=not has_existing_accounts,
        )

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
            raise ValidationError('Solde insuffisant pour le moment.')
        self.balance -= amount
        self.save()
        Transaction.objects.create(
            transaction_type=Transaction.TYPE_WITHDRAWAL,
            amount=amount,
            account=self,
            description=f'Retrait de {amount} {self.currency}',
        )
        return self.balance

    def preview_transfer(self, destination_account, amount):
        amount = Decimal(amount)

        if amount <= 0:
            raise ValidationError('Le montant du transfert doit être positif.')
        if self.pk == destination_account.pk:
            raise ValidationError('Impossible de transférer vers le même compte.')

        if self.currency == destination_account.currency:
            return amount, None

        try:
            rate = get_rate(self.currency, destination_account.currency)
        except Exception:
            raise ValidationError('Impossible de récupérer le taux de change pour le moment.')

        converted_amount = (amount * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return converted_amount, rate

    def _account_label(self):
        return f"Compte {self.currency}{' principal' if self.is_main else ''}"

    @transaction.atomic
    def transfer(self, destination_account, amount, recipient_name=""):
        """Transférer de l'argent vers un autre compte."""
        amount = Decimal(amount)
        source_id = self.pk
        destination_id = destination_account.pk

        locked_accounts = {
            account.pk: account
            for account in Account.objects.select_for_update().filter(pk__in=[source_id, destination_id])
        }
        source_account = locked_accounts[source_id]
        destination_account = locked_accounts[destination_id]

        converted_amount, rate_display = source_account.preview_transfer(destination_account, amount)

        if source_account.balance < amount:
            raise ValidationError('Solde insuffisant pour le moment.')

        # Débiter la source, créditer la destination (source uses original amount)
        source_account.balance -= amount
        source_account.save()
        destination_account.balance += converted_amount
        destination_account.save()

        internal_transfer = source_account.owner_id == destination_account.owner_id
        recipient_label = " ".join(recipient_name.split()) if recipient_name else ""
        beneficiary_name = (
            recipient_label
            or destination_account.owner.get_full_name().strip()
            or destination_account.account_number
        )

        source_history_target = (
            destination_account._account_label() if internal_transfer else beneficiary_name
        )
        destination_history_source = (
            source_account._account_label()
            if internal_transfer
            else source_account.owner.get_full_name().strip() or source_account.account_number
        )

        # Create two transaction records so each account sees the amount in its currency
        Transaction.objects.create(
            transaction_type=Transaction.TYPE_TRANSFER,
            amount=amount,
            account=source_account,
            source_account=source_account,
            destination_account=destination_account,
            description=(
                f"Virement {'interne ' if internal_transfer else ''}vers {source_history_target} — {amount:.2f} {source_account.currency}"
                + (
                    f" ({converted_amount:.2f} {destination_account.currency} @ {rate_display})"
                    if rate_display is not None
                    else ""
                )
            ),
        )

        Transaction.objects.create(
            transaction_type=Transaction.TYPE_TRANSFER,
            amount=converted_amount,
            account=destination_account,
            source_account=source_account,
            destination_account=destination_account,
            description=(
                f"Virement {'interne ' if internal_transfer else ''}reçu de {destination_history_source} — {converted_amount:.2f} {destination_account.currency}"
            ),
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

    @property
    def source_owner_name(self):
        if self.source_account is None:
            return ""
        owner = self.source_account.owner
        full_name = owner.get_full_name().strip()
        return full_name or owner.username

    @property
    def destination_owner_name(self):
        if self.destination_account is None:
            return ""
        owner = self.destination_account.owner
        full_name = owner.get_full_name().strip()
        return full_name or owner.username

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class RevokedAccessToken(models.Model):
    jti = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Revoked access token {self.jti}"


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.username}: {self.title}"


class MoneyRequest(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_COMPLETED = 'completed'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    requester_account = models.ForeignKey('Account', on_delete=models.CASCADE, related_name='outgoing_requests')
    debtor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='incoming_requests')
    currency = models.CharField(max_length=3, choices=Account.CURRENCY_CHOICES)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    message = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.requester_account.owner.username} requests {self.amount} {self.currency} from {self.debtor.username}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new:
            requester_name = self.requester_account.owner.get_full_name().strip() or self.requester_account.owner.username
            # Formate le montant pour enlever les zéros inutiles si possible, sinon garde 2 décimales
            formatted_amount = f"{self.amount.normalize():f}" if self.amount % 1 == 0 else f"{self.amount:.2f}"
            
            notif_message = f"{requester_name} vous demande {formatted_amount} {self.currency}. Voulez-vous accepter cette demande ?"
            
            Notification.objects.create(
                user=self.debtor,
                title="Nouvelle demande d'argent",
                message=notif_message
            )
