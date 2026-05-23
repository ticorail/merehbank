from datetime import datetime, timezone as dt_timezone
from calendar import monthrange
from django.utils import timezone
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.utils import OperationalError, ProgrammingError
from django.db.models import Q, F, Case, When, Value, CharField, Min
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.generics import CreateAPIView
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.conf import settings

from .models import Account, MoneyRequest, Notification, RevokedAccessToken, Transaction
from .serializers import (
    AccountSerializer,
    DepositSerializer,
    LoginSerializer,
    MoneyRequestSerializer,
    OpenAccountSerializer,
    TransactionSerializer,
    TransferSerializer,
    UserRegistrationSerializer,
    WithdrawSerializer,
)


class RegisterView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'message': 'Compte créé avec succès.',
                'user': {
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    refresh_cookie_name = 'merehbank_refresh_token'

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        response = Response(
            {
                'access': serializer.validated_data['access'],
                'user': serializer.validated_data['user'],
            },
            status=status.HTTP_200_OK,
        )
        response.set_cookie(
            self.refresh_cookie_name,
            serializer.validated_data['refresh'],
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax',
            path='/',
        )
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
    refresh_cookie_name = 'merehbank_refresh_token'

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh') or request.COOKIES.get(self.refresh_cookie_name)
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data={'refresh': refresh_token})
        serializer.is_valid(raise_exception=True)

        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        next_refresh = serializer.validated_data.get('refresh')
        if next_refresh:
            response.set_cookie(
                self.refresh_cookie_name,
                next_refresh,
                httponly=True,
                secure=not settings.DEBUG,
                samesite='Lax',
                path='/',
            )
        return response


class LogoutView(APIView):
    """Invalidate (blacklist) a refresh token on logout.

    Accepts POST { "refresh": "<token>" }.
    If blacklist support isn't enabled, behaviour is best-effort and returns success.
    """
    permission_classes = [permissions.AllowAny]
    refresh_cookie_name = 'merehbank_refresh_token'

    def post(self, request):
        refresh_token = request.data.get('refresh') or request.COOKIES.get(self.refresh_cookie_name)
        access_token = self._extract_access_token(request)

        if not refresh_token and not access_token:
            return Response(
                {'detail': 'Access token or refresh token required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if access_token:
            try:
                token = AccessToken(access_token)
                self._revoke_access_token(token)
            except TokenError:
                # If the access token is already expired or invalid, it's effectively unusable.
                pass

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                self._revoke_access_token(token.access_token)
                # blacklist() exists only if token_blacklist app is installed; wrap safely
                try:
                    token.blacklist()
                except AttributeError:
                    # blacklist not available; ignore and continue
                    pass
            except TokenError:
                return Response({'detail': 'Invalid refresh token.'}, status=status.HTTP_400_BAD_REQUEST)

        response = Response({'detail': 'Logged out.'}, status=status.HTTP_200_OK)
        response.delete_cookie(self.refresh_cookie_name, path='/')
        return response

    def _extract_access_token(self, request):
        auth_header = request.headers.get('Authorization', '')
        prefix = 'Bearer '
        if auth_header.startswith(prefix):
            return auth_header[len(prefix):].strip()
        return None

    def _revoke_access_token(self, token):
        try:
            RevokedAccessToken.objects.get_or_create(
                jti=token['jti'],
                defaults={
                    'expires_at': datetime.fromtimestamp(
                        token['exp'],
                        tz=dt_timezone.utc,
                    )
                },
            )
        except (ProgrammingError, OperationalError):
            # Continue graceful logout when the revocation table isn't migrated yet.
            pass


class AccountView(APIView):
    def get(self, request):
        accounts = Account.objects.filter(owner=request.user).order_by('-is_main', '-created_at')
        serializer = AccountSerializer(accounts, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = OpenAccountSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        account = Account.create_for_user(
            owner=request.user,
            currency=serializer.validated_data['currency'],
        )
        response_serializer = AccountSerializer(account)
        return Response(
            {
                'message': f'Compte {account.currency} créé avec succès.',
                'account': response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class DepositView(APIView):
    def post(self, request):
        serializer = DepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        account = get_object_or_404(
            Account,
            owner=request.user,
            account_number=serializer.validated_data['account_number'],
        )
        try:
            new_balance = account.deposit(serializer.validated_data['amount'])
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)
        return Response(
            {
                'message': 'Dépôt effectué avec succès.',
                'account_number': account.account_number,
                'new_balance': new_balance,
            },
            status=status.HTTP_200_OK,
        )


class WithdrawView(APIView):
    def post(self, request):
        serializer = WithdrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        account = get_object_or_404(
            Account,
            owner=request.user,
            account_number=serializer.validated_data['account_number'],
        )
        try:
            new_balance = account.withdraw(serializer.validated_data['amount'])
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)
        return Response(
            {
                'message': 'Retrait effectué avec succès.',
                'account_number': account.account_number,
                'new_balance': new_balance,
            },
            status=status.HTTP_200_OK,
        )


class TransferView(APIView):
    def post(self, request):
        serializer = TransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        source_account = get_object_or_404(
            Account,
            owner=request.user,
            account_number=serializer.validated_data['source_account_number'],
        )
        destination_account = Account.objects.filter(
            account_number=serializer.validated_data['destination_account_number'],
        ).first()
        if destination_account is None:
            raise ValidationError(
                {'destination_account_number': 'Aucun compte ne correspond à ce numéro.'}
            )
        request_id = serializer.validated_data.get('request_id')

        try:
            with transaction.atomic():
                if request_id is not None:
                    money_request = get_object_or_404(
                        MoneyRequest.objects.select_for_update().select_related('requester_account'),
                        pk=request_id,
                        debtor=request.user,
                    )
                    if money_request.status == MoneyRequest.STATUS_COMPLETED:
                        raise ValidationError({'detail': 'Cette demande a déjà été traitée.'})
                    if money_request.status != MoneyRequest.STATUS_ACCEPTED:
                        raise ValidationError({'detail': 'Cette demande doit d’abord être acceptée.'})

                new_balance = source_account.transfer(
                    destination_account,
                    serializer.validated_data['amount'],
                    serializer.validated_data.get('recipient_name', ''),
                )

                if request_id is not None:
                    money_request.status = MoneyRequest.STATUS_COMPLETED
                    money_request.save(update_fields=['status'])
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)
        return Response(
            {
                'message': 'Virement effectué avec succès.',
                'source_account_number': source_account.account_number,
                'destination_account_number': destination_account.account_number,
                'new_balance': new_balance,
            },
            status=status.HTTP_200_OK,
        )


class TransferQuoteView(APIView):
    def post(self, request):
        serializer = TransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        source_account = get_object_or_404(
            Account,
            owner=request.user,
            account_number=serializer.validated_data['source_account_number'],
        )
        destination_account = Account.objects.filter(
            account_number=serializer.validated_data['destination_account_number'],
        ).first()
        if destination_account is None:
            raise ValidationError(
                {'destination_account_number': 'Aucun compte ne correspond à ce numéro.'}
            )

        try:
            estimated_received, rate = source_account.preview_transfer(
                destination_account,
                serializer.validated_data['amount'],
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)

        return Response(
            {
                'source_account_number': source_account.account_number,
                'destination_account_number': destination_account.account_number,
                'source_currency': source_account.currency,
                'destination_currency': destination_account.currency,
                'exchange_rate': str(rate) if rate is not None else None,
                'estimated_received_amount': str(estimated_received),
            },
            status=status.HTTP_200_OK,
        )


class MoneyRequestView(APIView):
    def post(self, request):
        serializer = MoneyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requester_account = Account.objects.filter(
            owner=request.user,
            account_number=serializer.validated_data['source_account_number'],
        ).first()
        if requester_account is None:
            raise ValidationError(
                {'source_account_number': 'Aucun compte ne correspond à ce numéro.'}
            )

        debtor = User.objects.filter(
            Q(email__iexact=serializer.validated_data['debtor_email'])
            | Q(username__iexact=serializer.validated_data['debtor_email'])
        ).exclude(pk=request.user.pk).first()

        if debtor is None:
            raise ValidationError(
                {'debtor_email': 'Aucun client ne correspond à cette adresse email.'}
            )

        try:
            money_request = MoneyRequest.objects.create(
                requester_account=requester_account,
                debtor=debtor,
                currency=requester_account.currency,
                amount=serializer.validated_data['amount'],
                message=serializer.validated_data.get('message', ''),
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)

        requester_name = requester_account.owner.get_full_name().strip() or requester_account.owner.username
        formatted_amount = f'{money_request.amount.normalize():f}' if money_request.amount % 1 == 0 else f'{money_request.amount:.2f}'
        notification_message = (
            f'{requester_name} vous demande {formatted_amount} {requester_account.currency}. '
            'Voulez-vous accepter cette demande ?'
        )

        return Response(
            {
                'message': 'Demande envoyée avec succès.',
                'money_request': {
                    'id': money_request.id,
                    'debtor_email': debtor.email,
                    'amount': str(money_request.amount),
                    'currency': money_request.currency,
                    'message': money_request.message,
                    'notification_message': notification_message,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class MoneyRequestAcceptView(APIView):
    def post(self, request, request_id):
        money_request = get_object_or_404(
            MoneyRequest.objects.select_related('requester_account', 'requester_account__owner', 'debtor'),
            pk=request_id,
            debtor=request.user,
        )

        if money_request.status != MoneyRequest.STATUS_PENDING:
            raise ValidationError({'detail': 'Cette demande a déjà été traitée.'})

        money_request.status = MoneyRequest.STATUS_ACCEPTED
        money_request.accepted_at = timezone.now()
        money_request.save(update_fields=['status', 'accepted_at'])

        requester_name = money_request.requester_account.owner.get_full_name().strip() or money_request.requester_account.owner.username
        requester_email = money_request.requester_account.owner.email

        return Response(
            {
                'message': 'Demande acceptée.',
                'money_request': {
                    'id': money_request.id,
                    'requester_name': requester_name,
                    'requester_email': requester_email,
                    'amount': str(money_request.amount),
                    'currency': money_request.currency,
                    'message': money_request.message,
                    'status': money_request.status,
                },
                'transfer': {
                    'destination_account_number': money_request.requester_account.account_number,
                    'recipient_name': requester_name,
                    'recipient_email': requester_email,
                    'amount': str(money_request.amount),
                    'currency': money_request.currency,
                    'message': money_request.message,
                    'request_id': money_request.id,
                },
            },
            status=status.HTTP_200_OK,
        )


class MoneyRequestRejectView(APIView):
    def post(self, request, request_id):
        money_request = get_object_or_404(
            MoneyRequest.objects.select_related('requester_account', 'requester_account__owner', 'debtor'),
            pk=request_id,
            debtor=request.user,
        )

        if money_request.status != MoneyRequest.STATUS_PENDING:
            raise ValidationError({'detail': 'Cette demande a déjà été traitée.'})

        money_request.status = MoneyRequest.STATUS_REJECTED
        money_request.rejected_at = timezone.now()
        money_request.save(update_fields=['status', 'rejected_at'])

        requester_name = money_request.requester_account.owner.get_full_name().strip() or money_request.requester_account.owner.username
        formatted_amount = f'{money_request.amount.normalize():f}' if money_request.amount % 1 == 0 else f'{money_request.amount:.2f}'
        debtor_name = request.user.get_full_name().strip() or request.user.username
        Notification.objects.create(
            user=money_request.requester_account.owner,
            title='Demande refusée',
            message=f'{debtor_name} a refusé votre demande de {formatted_amount} {money_request.currency}.',
        )

        return Response(
            {
                'message': 'Demande refusée.',
                'money_request': {
                    'id': money_request.id,
                    'requester_name': requester_name,
                    'requester_email': money_request.requester_account.owner.email,
                    'amount': str(money_request.amount),
                    'currency': money_request.currency,
                    'message': money_request.message,
                    'status': money_request.status,
                },
            },
            status=status.HTTP_200_OK,
        )


class TransactionListView(APIView):
    def get(self, request):
        transactions = Transaction.objects.filter(account__owner=request.user) | Transaction.objects.filter(
            source_account__owner=request.user
        ) | Transaction.objects.filter(destination_account__owner=request.user)
        transactions = transactions.distinct().order_by('-timestamp')
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)


class HistoryView(APIView):
    PAGE_SIZE = 20

    def get(self, request):
        month = request.query_params.get('month', '').strip()
        year = request.query_params.get('year', '').strip()
        kind = request.query_params.get('kind', 'all').strip().lower()
        currency = request.query_params.get('currency', 'all').strip().upper()
        page = request.query_params.get('page', '1').strip()

        try:
            month_value = int(month) if month else None
        except ValueError:
            raise ValidationError({'month': 'Le mois doit être un nombre compris entre 1 et 12.'})

        if month_value is not None and not 1 <= month_value <= 12:
            raise ValidationError({'month': 'Le mois doit être compris entre 1 et 12.'})

        try:
            year_value = int(year) if year else None
        except ValueError:
            raise ValidationError({'year': 'L’année doit être un nombre valide.'})

        user_transactions = Transaction.objects.filter(
            Q(account__owner=request.user)
            | Q(source_account__owner=request.user)
            | Q(destination_account__owner=request.user)
        )

        user_money_requests = MoneyRequest.objects.filter(requester_account__owner=request.user)

        oldest_transaction = user_transactions.aggregate(oldest=Min('timestamp'))['oldest']
        oldest_request = user_money_requests.aggregate(
            oldest=Min(Coalesce('accepted_at', 'rejected_at', 'created_at'))
        )['oldest']
        oldest_date = min(
            [date for date in [oldest_transaction, oldest_request] if date is not None],
            default=None,
        )
        # If there are no transactions/requests yet, fall back to the earliest
        # account creation date for this user so we can correctly detect
        # periods before the account(s) existed.
        earliest_account_created = (
            Account.objects.filter(owner=request.user).aggregate(first=Min('created_at'))['first']
        )
        now = timezone.now()
        current_year = now.year
        oldest_year = oldest_date.year if oldest_date is not None else current_year

        # Do not raise for years outside the available range; instead allow
        # filtering to return an empty result set. This avoids surfacing a
        # technical error for periods before account creation or future months.

        if kind not in {'all', 'deposit', 'withdrawal', 'transfer', 'money_request'}:
            raise ValidationError({'kind': 'Le type de transaction sélectionné est invalide.'})

        if currency not in {'ALL', 'HTG', 'USD'}:
            raise ValidationError({'currency': 'La devise sélectionnée est invalide.'})

        transaction_history = self._build_transaction_history_queryset(user_transactions)
        money_request_history = self._build_money_request_history_queryset(user_money_requests)

        # Flags for frontend messaging
        is_before_history = False
        is_future_period = False

        if month_value is not None and year_value is not None:
            # build month/year bounds as timezone-aware datetimes
            try:
                start_naive = datetime(year_value, month_value, 1)
            except ValueError:
                raise ValidationError({'month': 'Le mois/année fournis sont invalides.'})
            tz = timezone.get_current_timezone()
            start = timezone.make_aware(start_naive, tz)
            if month_value == 12:
                next_month_start_naive = datetime(year_value + 1, 1, 1)
            else:
                next_month_start_naive = datetime(year_value, month_value + 1, 1)
            next_month_start = timezone.make_aware(next_month_start_naive, tz)

            start_utc = start.astimezone(dt_timezone.utc)
            end_utc = next_month_start.astimezone(dt_timezone.utc)

            # compare against the oldest known activity date, or the earliest
            # account creation date when there is no activity yet.
            compare_date = oldest_date or earliest_account_created
            if compare_date is not None and end_utc <= compare_date.astimezone(dt_timezone.utc):
                is_before_history = True

            if start_utc > now.astimezone(dt_timezone.utc):
                is_future_period = True

            transaction_history = transaction_history.filter(history_date__gte=start_utc, history_date__lt=end_utc)
            money_request_history = money_request_history.filter(history_date__gte=start_utc, history_date__lt=end_utc)

        else:
            if month_value is not None:
                # fall back to month-only filter (across years) when year not provided
                transaction_history = transaction_history.filter(history_date__month=month_value)
                money_request_history = money_request_history.filter(history_date__month=month_value)

            if year_value is not None:
                # entire year
                try:
                    start_naive = datetime(year_value, 1, 1)
                except ValueError:
                    raise ValidationError({'year': 'L’année fournie est invalide.'})
                tz = timezone.get_current_timezone()
                start = timezone.make_aware(start_naive, tz)
                next_year_start_naive = datetime(year_value + 1, 1, 1)
                next_year_start = timezone.make_aware(next_year_start_naive, tz)

                start_utc = start.astimezone(dt_timezone.utc)
                end_utc = next_year_start.astimezone(dt_timezone.utc)

                compare_date = oldest_date or earliest_account_created
                if compare_date is not None and end_utc <= compare_date.astimezone(dt_timezone.utc):
                    is_before_history = True

                if start_utc > now.astimezone(dt_timezone.utc):
                    is_future_period = True

                transaction_history = transaction_history.filter(history_date__gte=start_utc, history_date__lt=end_utc)
                money_request_history = money_request_history.filter(history_date__gte=start_utc, history_date__lt=end_utc)

        if kind != 'all':
            transaction_history = transaction_history.filter(kind=kind)
            if kind == 'money_request':
                money_request_history = money_request_history
            else:
                money_request_history = money_request_history.none()

        if currency != 'ALL':
            transaction_history = transaction_history.filter(account_currency=currency)
            money_request_history = money_request_history.filter(account_currency=currency)

        combined_history = transaction_history.union(money_request_history, all=True).order_by('-history_date', '-id')

        paginator = Paginator(combined_history, self.PAGE_SIZE)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)

        available_years = list(range(oldest_year, current_year + 1))

        return Response(
            {
                'filters': {
                    'month': month_value,
                    'year': year_value,
                    'kind': kind,
                    'currency': currency,
                    'is_before_history': is_before_history,
                    'is_future_period': is_future_period,
                },
                'available_years': available_years,
                'pagination': {
                    'count': paginator.count,
                    'page': page_obj.number,
                    'page_size': self.PAGE_SIZE,
                    'num_pages': paginator.num_pages,
                    'has_next': page_obj.has_next(),
                    'has_previous': page_obj.has_previous(),
                },
                'results': [
                    {
                        **item,
                        'message': item.get('history_message', ''),
                        'status': item.get('history_status', ''),
                    }
                    for item in list(page_obj.object_list)
                ],
            },
            status=status.HTTP_200_OK,
        )

    def _build_transaction_history_queryset(self, queryset):
        return (
            queryset.select_related('account', 'source_account', 'source_account__owner', 'destination_account', 'destination_account__owner')
            .annotate(
                history_date=F('timestamp'),
                kind=Case(
                    When(transaction_type=Transaction.TYPE_DEPOSIT, then=Value('deposit')),
                    When(transaction_type=Transaction.TYPE_WITHDRAWAL, then=Value('withdrawal')),
                    default=Value('transfer'),
                    output_field=CharField(),
                ),
                account_number=F('account__account_number'),
                account_currency=F('account__currency'),
                account_is_main=F('account__is_main'),
                counterpart_name=Case(
                    When(
                        transaction_type=Transaction.TYPE_TRANSFER,
                        account_id=F('source_account_id'),
                        then=F('destination_account__owner__first_name'),
                    ),
                    default=Value(''),
                    output_field=CharField(),
                ),
                title=Case(
                    When(transaction_type=Transaction.TYPE_DEPOSIT, then=Value('Dépôt')),
                    When(transaction_type=Transaction.TYPE_WITHDRAWAL, then=Value('Retrait')),
                    When(
                        transaction_type=Transaction.TYPE_TRANSFER,
                        account_id=F('source_account_id'),
                        then=Value('Virement envoyé'),
                    ),
                    default=Value('Virement reçu'),
                    output_field=CharField(),
                ),
                history_message=F('description'),
                history_status=Value('completed', output_field=CharField()),
            )
            .values(
                'id',
                'history_date',
                'kind',
                'title',
                'history_message',
                'amount',
                'account_number',
                'account_currency',
                'account_is_main',
                'counterpart_name',
                'history_status',
            )
            .order_by()
        )

    def _build_money_request_history_queryset(self, queryset):
        return (
            queryset.select_related('requester_account', 'requester_account__owner', 'debtor')
            .annotate(
                history_date=Coalesce('accepted_at', 'rejected_at', 'created_at'),
                kind=Value('money_request', output_field=CharField()),
                account_number=F('requester_account__account_number'),
                account_currency=F('currency'),
                account_is_main=F('requester_account__is_main'),
                counterpart_name=F('debtor__first_name'),
                title=Case(
                    When(status=MoneyRequest.STATUS_PENDING, then=Value('Demande d’argent envoyée')),
                    When(status=MoneyRequest.STATUS_ACCEPTED, then=Value('Demande acceptée')),
                    When(status=MoneyRequest.STATUS_REJECTED, then=Value('Demande refusée')),
                    default=Value('Demande d’argent'),
                    output_field=CharField(),
                ),
                history_message=Case(
                    When(
                        status=MoneyRequest.STATUS_PENDING,
                        then=Value('Demande en attente de réponse'),
                    ),
                    When(
                        status=MoneyRequest.STATUS_ACCEPTED,
                        then=Value('La demande a été acceptée.'),
                    ),
                    When(
                        status=MoneyRequest.STATUS_REJECTED,
                        then=Value('La demande a été refusée.'),
                    ),
                    default=F('message'),
                    output_field=CharField(),
                ),
                history_status=F('status'),
            )
            .values(
                'id',
                'history_date',
                'kind',
                'title',
                'history_message',
                'amount',
                'account_number',
                'account_currency',
                'account_is_main',
                'counterpart_name',
                'history_status',
            )
            .order_by()
        )


class AccountTransactionsView(APIView):
    PAGE_SIZE = 10

    def get(self, request, account_number):
        account = get_object_or_404(
            Account,
            owner=request.user,
            account_number=account_number,
        )

        month = request.query_params.get('month', '').strip()
        year = request.query_params.get('year', '').strip()
        page = request.query_params.get('page', '1').strip()

        try:
            month_value = int(month) if month else None
        except ValueError:
            raise ValidationError({'month': 'Le mois doit être un nombre compris entre 1 et 12.'})

        if month_value is not None and not 1 <= month_value <= 12:
            raise ValidationError({'month': 'Le mois doit être compris entre 1 et 12.'})

        try:
            year_value = int(year) if year else None
        except ValueError:
            raise ValidationError({'year': 'L’année doit être un nombre valide.'})

        # Determine filtering bounds in a timezone-aware manner to avoid
        # mismatches when the DB stores timestamps in UTC. Build start/end
        # datetimes for the requested month/year (or year) and filter with
        # `__gte` / `__lt` which is more reliable than `__month`/`__year`.
        now = timezone.now()
        current_year = now.year
        opening_year = account.created_at.year

        is_before_account_opening = False
        is_future_period = False

        queryset = Transaction.objects.filter(account=account).order_by('-timestamp', '-id')

        if month_value is not None and year_value is not None:
            # start = first day of month at 00:00 in current timezone
            try:
                start_naive = datetime(year_value, month_value, 1)
            except ValueError:
                raise ValidationError({'month': 'Le mois/année fournis sont invalides.'})

            tz = timezone.get_current_timezone()
            start = timezone.make_aware(start_naive, tz)

            # compute start of next month
            if month_value == 12:
                next_month_start_naive = datetime(year_value + 1, 1, 1)
            else:
                next_month_start_naive = datetime(year_value, month_value + 1, 1)
            next_month_start = timezone.make_aware(next_month_start_naive, tz)

            # Convert to UTC for DB comparison
            start_utc = start.astimezone(dt_timezone.utc)
            end_utc = next_month_start.astimezone(dt_timezone.utc)

            # Flags for frontend messaging
            if end_utc <= account.created_at.astimezone(dt_timezone.utc):
                is_before_account_opening = True

            if start_utc > now.astimezone(dt_timezone.utc):
                is_future_period = True

            queryset = queryset.filter(timestamp__gte=start_utc, timestamp__lt=end_utc)

        elif year_value is not None:
            # entire year selected
            try:
                start_naive = datetime(year_value, 1, 1)
            except ValueError:
                raise ValidationError({'year': 'L’année fournie est invalide.'})
            tz = timezone.get_current_timezone()
            start = timezone.make_aware(start_naive, tz)
            next_year_start_naive = datetime(year_value + 1, 1, 1)
            next_year_start = timezone.make_aware(next_year_start_naive, tz)

            start_utc = start.astimezone(dt_timezone.utc)
            end_utc = next_year_start.astimezone(dt_timezone.utc)

            if end_utc <= account.created_at.astimezone(dt_timezone.utc):
                is_before_account_opening = True

            if start_utc > now.astimezone(dt_timezone.utc):
                is_future_period = True

            queryset = queryset.filter(timestamp__gte=start_utc, timestamp__lt=end_utc)

        paginator = Paginator(queryset, self.PAGE_SIZE)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)

        serializer = TransactionSerializer(page_obj.object_list, many=True)
        return Response(
            {
                'account': AccountSerializer(account).data,
                'filters': {
                    'month': month_value,
                    'year': year_value,
                    'is_before_account_opening': is_before_account_opening,
                    'is_future_period': is_future_period,
                },
                'available_years': list(range(opening_year, current_year + 1)),
                'pagination': {
                    'count': paginator.count,
                    'page': page_obj.number,
                    'page_size': self.PAGE_SIZE,
                    'num_pages': paginator.num_pages,
                    'has_next': page_obj.has_next(),
                    'has_previous': page_obj.has_previous(),
                },
                'results': serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationView(APIView):
    def get(self, request):
        payload = []

        # Include deposits on user's accounts, and transfers where the stored
        # transaction row corresponds to the destination account (avoid duplicating
        # the source-side transfer row which also references the same destination).
        deposits_q = Q(transaction_type=Transaction.TYPE_DEPOSIT, account__owner=request.user)
        transfers_q = Q(
            transaction_type=Transaction.TYPE_TRANSFER,
            destination_account__owner=request.user,
            account__pk=F('destination_account__pk'),
        )

        legacy_notifications = (
            Transaction.objects.filter(deposits_q | transfers_q)
            .select_related('account', 'source_account', 'source_account__owner', 'destination_account')
        )

        for transaction in legacy_notifications:
            if transaction.transaction_type == Transaction.TYPE_DEPOSIT and transaction.account is not None:
                payload.append(
                    {
                        'id': transaction.id,
                        'type': 'deposit',
                        'title': 'Dépôt en succursale',
                        'message': (
                            f"Vous avez fait un dépôt de {transaction.amount:.2f} {transaction.account.currency} en succursale"
                        ),
                        'date': transaction.timestamp,
                        'read': False,
                    }
                )
                continue

            if transaction.transaction_type == Transaction.TYPE_TRANSFER and transaction.account is not None:
                sender_name = transaction.source_owner_name or 'un client'
                payload.append(
                    {
                        'id': transaction.id,
                        'type': 'transfer',
                        'title': 'Virement reçu',
                        'message': (
                            f"Vous avez reçu {transaction.amount:.2f} {transaction.account.currency} de {sender_name}"
                        ),
                        'date': transaction.timestamp,
                        'read': False,
                    }
                )

        for notification in Notification.objects.filter(user=request.user).exclude(title='Nouvelle demande d\'argent').only('id', 'title', 'message', 'is_read', 'created_at'):
            payload.append(
                {
                    'id': -notification.id,
                    'type': 'notification',
                    'title': notification.title,
                    'message': notification.message,
                    'date': notification.created_at,
                    'read': notification.is_read,
                }
            )

        for money_request in (
            MoneyRequest.objects.filter(debtor=request.user, status=MoneyRequest.STATUS_PENDING)
            .select_related('requester_account', 'requester_account__owner')
            .order_by('-created_at')
        ):
            requester_name = money_request.requester_account.owner.get_full_name().strip() or money_request.requester_account.owner.username
            formatted_amount = f'{money_request.amount.normalize():f}' if money_request.amount % 1 == 0 else f'{money_request.amount:.2f}'
            payload.append(
                {
                    'id': -1000000 - money_request.id,
                    'request_id': money_request.id,
                    'type': 'money_request',
                    'title': 'Nouvelle demande d\'argent',
                    'message': (
                        f"{requester_name} vous demande {formatted_amount} {money_request.currency}. "
                        f"Voulez-vous accepter cette demande ?"
                    ),
                    'requester_name': requester_name,
                    'requester_email': money_request.requester_account.owner.email,
                    'requester_account_number': money_request.requester_account.account_number,
                    'amount': str(money_request.amount),
                    'currency': money_request.currency,
                    'request_message': money_request.message,
                    'date': money_request.created_at,
                    'read': False,
                }
            )

        payload.sort(key=lambda item: item['date'], reverse=True)
        return Response(payload[:6])
