import re
from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth import authenticate
from django.contrib.auth import password_validation
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Account, Transaction


class UserRegistrationSerializer(serializers.ModelSerializer):
    NAME_PATTERN = re.compile(r"^[A-Za-zÀ-ÿ]+(?:[ -][A-Za-zÀ-ÿ]+)*$")
    PASSWORD_SPECIAL_PATTERN = re.compile(r"[^A-Za-z0-9]")

    email = serializers.EmailField(required=True)
    first_name = serializers.CharField(required=True, min_length=2, max_length=50)
    last_name = serializers.CharField(required=True, min_length=2, max_length=50)
    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})
    main_currency = serializers.ChoiceField(choices=Account.CURRENCY_CHOICES, required=True)
    terms = serializers.BooleanField(required=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'password_confirm', 'first_name', 'last_name', 'main_currency', 'terms']

    def validate_first_name(self, value):
        return self._validate_name(value, 'Prénom')

    def validate_last_name(self, value):
        return self._validate_name(value, 'Nom')

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError('Un compte existe déjà avec cette adresse email.')
        if len(normalized_email) > 150:
            raise serializers.ValidationError("L'adresse email est trop longue.")
        return normalized_email

    def validate_password(self, value):
        if not re.search(r'[A-Z]', value):
            raise serializers.ValidationError('Le mot de passe doit contenir au moins une majuscule.')
        if not re.search(r'[a-z]', value):
            raise serializers.ValidationError('Le mot de passe doit contenir au moins une minuscule.')
        if not re.search(r'\d', value):
            raise serializers.ValidationError('Le mot de passe doit contenir au moins un chiffre.')
        if not self.PASSWORD_SPECIAL_PATTERN.search(value):
            raise serializers.ValidationError('Le mot de passe doit contenir au moins un caractère spécial.')
        return value

    def validate_main_currency(self, value):
        return value.strip().upper()

    def validate_password_confirm(self, value):
        password = self.initial_data.get('password')
        if password is not None and value != password:
            raise serializers.ValidationError(
                'La confirmation du mot de passe ne correspond pas.'
            )
        return value

    def validate(self, attrs):
        if not attrs.get('terms'):
            raise serializers.ValidationError(
                {'terms': 'Vous devez accepter les conditions générales.'}
            )
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError(
                {'password_confirm': 'La confirmation du mot de passe ne correspond pas.'}
            )

        user = User(
            username=attrs['email'],
            email=attrs['email'],
            first_name=attrs['first_name'],
            last_name=attrs['last_name'],
        )
        try:
            password_validation.validate_password(attrs['password'], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def _validate_name(self, value, field_label):
        normalized_value = ' '.join(value.strip().split())
        if not self.NAME_PATTERN.fullmatch(normalized_value):
            raise serializers.ValidationError(
                f'{field_label} ne peut contenir que des lettres, espaces et tirets.'
            )
        return normalized_value

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('password_confirm', None)
        main_currency = validated_data.pop('main_currency')
        validated_data.pop('terms', None)
        validated_data['username'] = validated_data['email']
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        Account.create_for_user(owner=user, currency=main_currency)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        login_value = attrs.get('email') or attrs.get('username', '')
        email = login_value.strip().lower()
        password = attrs.get('password', '')

        if not email:
            raise serializers.ValidationError({'email': "L'email est requis."})

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User.objects.filter(username__iexact=email).first()

        if user is None:
            raise serializers.ValidationError({'non_field_errors': ['Email ou mot de passe incorrect.']})

        authenticated_user = authenticate(
            request=self.context.get('request'),
            username=user.username,
            password=password,
        )

        if authenticated_user is None:
            raise serializers.ValidationError({'non_field_errors': ['Email ou mot de passe incorrect.']})

        refresh = RefreshToken.for_user(authenticated_user)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'email': authenticated_user.email,
                'first_name': authenticated_user.first_name,
                'last_name': authenticated_user.last_name,
            },
        }


class AccountSerializer(serializers.ModelSerializer):
    available_balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Account
        fields = [
            'id',
            'account_number',
            'balance',
            'overdraft_limit',
            'available_balance',
            'account_type',
            'currency',
            'is_main',
            'created_at',
        ]
        read_only_fields = fields


class TransactionSerializer(serializers.ModelSerializer):
    source_owner_name = serializers.SerializerMethodField()
    destination_owner_name = serializers.SerializerMethodField()
    account_currency = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    transfer_kind_label = serializers.SerializerMethodField()
    transfer_summary = serializers.SerializerMethodField()
    transfer_sent_amount = serializers.SerializerMethodField()
    transfer_received_amount = serializers.SerializerMethodField()
    transfer_exchange_rate = serializers.SerializerMethodField()
    source_account_number = serializers.SerializerMethodField()
    destination_account_number = serializers.SerializerMethodField()
    source_currency = serializers.SerializerMethodField()
    destination_currency = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id',
            'transaction_type',
            'amount',
            'timestamp',
            'status',
            'account',
            'account_currency',
            'source_account',
            'destination_account',
            'description',
            'source_owner_name',
            'destination_owner_name',
            'transfer_kind_label',
            'transfer_summary',
            'transfer_sent_amount',
            'transfer_received_amount',
            'transfer_exchange_rate',
            'source_account_number',
            'destination_account_number',
            'source_currency',
            'destination_currency',
        ]
        read_only_fields = fields

    def get_source_owner_name(self, obj):
        return obj.source_owner_name

    def get_destination_owner_name(self, obj):
        return obj.destination_owner_name

    def get_account_currency(self, obj):
        if obj.account is None:
            return None
        return obj.account.currency

    def get_status(self, obj):
        return 'completed'

    def _get_transfer_pair(self, obj):
        if obj.transaction_type != Transaction.TYPE_TRANSFER:
            return None

        return (
            Transaction.objects.filter(
                transaction_type=Transaction.TYPE_TRANSFER,
                source_account=obj.source_account,
                destination_account=obj.destination_account,
            )
            .exclude(pk=obj.pk)
            .select_related('account', 'source_account', 'destination_account')
            .first()
        )

    def _get_transfer_context(self, obj):
        if obj.transaction_type != Transaction.TYPE_TRANSFER:
            return None

        source_account = obj.source_account
        destination_account = obj.destination_account
        if source_account is None or destination_account is None:
            return None

        pair = self._get_transfer_pair(obj)
        is_internal = source_account.owner_id == destination_account.owner_id
        is_source_row = obj.account_id == source_account.id

        sent_amount = obj.amount if is_source_row else (pair.amount if pair else obj.amount)
        received_amount = obj.amount if not is_source_row else (pair.amount if pair else obj.amount)

        if sent_amount and received_amount:
            exchange_rate = (Decimal(str(received_amount)) / Decimal(str(sent_amount))).quantize(
                Decimal('0.000001'),
                rounding=ROUND_HALF_UP,
            )
        else:
            exchange_rate = None

        return {
            'is_internal': is_internal,
            'is_source_row': is_source_row,
            'source_account_number': source_account.account_number,
            'destination_account_number': destination_account.account_number,
            'source_currency': source_account.currency,
            'destination_currency': destination_account.currency,
            'sent_amount': sent_amount,
            'received_amount': received_amount,
            'exchange_rate': exchange_rate,
        }

    def get_transfer_kind_label(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        return 'Transfert interne' if context['is_internal'] else 'Virement'

    def get_transfer_summary(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        # For internal transfers (between user's own accounts) keep the detailed
        # summary including account numbers and exchange rate. For transfers
        # between different clients, expose only a simple, non-sensitive label.
        if context['is_internal']:
            return (
                f"Compte débité: {context['source_account_number']} ({context['source_currency']}) • "
                f"Compte crédité: {context['destination_account_number']} ({context['destination_currency']}) • "
                f"Taux: {context['exchange_rate']} • "
                f"Montant envoyé: {context['sent_amount']:.2f} {context['source_currency']} • "
                f"Montant reçu: {context['received_amount']:.2f} {context['destination_currency']}"
            )

        # Non-internal transfers: avoid leaking account numbers. If this row is
        # the source-side row, indicate a sent transfer; if it's the
        # destination-side row, indicate a received transfer with sender name.
        if context.get('is_source_row'):
            # Sent transfer: show recipient name only
            recipient = obj.destination_owner_name or context.get('destination_account_number')
            return f"Virement vers {recipient}"
        else:
            sender = obj.source_owner_name or context.get('source_account_number')
            return f"Virement reçu de {sender}"

    def get_transfer_sent_amount(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        return f"{context['sent_amount']:.2f} {context['source_currency']}"

    def get_transfer_received_amount(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        return f"{context['received_amount']:.2f} {context['destination_currency']}"

    def get_transfer_exchange_rate(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        return str(context['exchange_rate']) if context['exchange_rate'] is not None else None

    def get_source_account_number(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        return context['source_account_number']

    def get_destination_account_number(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        return context['destination_account_number']

    def get_source_currency(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        return context['source_currency']

    def get_destination_currency(self, obj):
        context = self._get_transfer_context(obj)
        if context is None:
            return None
        return context['destination_currency']


class DepositSerializer(serializers.Serializer):
    account_number = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)


class WithdrawSerializer(serializers.Serializer):
    account_number = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)


class TransferSerializer(serializers.Serializer):
    source_account_number = serializers.CharField()
    destination_account_number = serializers.CharField()
    recipient_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    request_id = serializers.IntegerField(required=False, min_value=1)

    def validate_source_account_number(self, value):
        return value.strip().upper()

    def validate_destination_account_number(self, value):
        return value.strip().upper()

    def validate_recipient_name(self, value):
        return ' '.join(value.strip().split())


class MoneyRequestSerializer(serializers.Serializer):
    debtor_email = serializers.EmailField()
    source_account_number = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal('0.01'))
    message = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate_debtor_email(self, value):
        return value.strip().lower()

    def validate_source_account_number(self, value):
        return value.strip().upper()

    def validate_message(self, value):
        return ' '.join(value.strip().split())


class OpenAccountSerializer(serializers.Serializer):
    currency = serializers.ChoiceField(choices=Account.CURRENCY_CHOICES)

    def validate_currency(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        user = self.context['request'].user
        currency = attrs['currency']

        if Account.objects.filter(owner=user, currency=currency).exists():
            raise serializers.ValidationError(
                {'currency': f'Vous possédez déjà un compte {currency}.'}
            )

        return attrs
