from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.conf import settings
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .models import Account, MoneyRequest, Notification, RevokedAccessToken, Transaction


class AccountModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='client1', password='secret12345')
        self.other_user = User.objects.create_user(username='client2', password='secret12345')

    def test_deposit_increases_balance_and_creates_transaction(self):
        account = Account.objects.create(
            owner=self.user,
            account_number='HTG001',
            balance=Decimal('100.00'),
            currency=Account.CURRENCY_HTG,
        )

        new_balance = account.deposit(Decimal('25.50'))

        account.refresh_from_db()
        self.assertEqual(new_balance, Decimal('125.50'))
        self.assertEqual(account.balance, Decimal('125.50'))
        self.assertEqual(Transaction.objects.count(), 1)
        self.assertEqual(Transaction.objects.first().transaction_type, Transaction.TYPE_DEPOSIT)

    def test_deposit_rejects_non_positive_amount(self):
        account = Account.objects.create(
            owner=self.user,
            account_number='HTG002',
            balance=Decimal('100.00'),
            currency=Account.CURRENCY_HTG,
        )

        with self.assertRaises(ValidationError):
            account.deposit(Decimal('0'))

    def test_withdraw_requires_sufficient_balance(self):
        account = Account.objects.create(
            owner=self.user,
            account_number='HTG003',
            balance=Decimal('50.00'),
            currency=Account.CURRENCY_HTG,
        )

        with self.assertRaises(ValidationError):
            account.withdraw(Decimal('75.00'))

    def test_transfer_updates_both_accounts_and_creates_transaction(self):
        source = Account.objects.create(
            owner=self.user,
            account_number='HTG004',
            balance=Decimal('200.00'),
            currency=Account.CURRENCY_HTG,
        )
        destination = Account.objects.create(
            owner=self.other_user,
            account_number='HTG005',
            balance=Decimal('40.00'),
            currency=Account.CURRENCY_HTG,
        )

        new_balance = source.transfer(destination, Decimal('60.00'), 'Nom du beneficiaire')

        source.refresh_from_db()
        destination.refresh_from_db()
        self.assertEqual(new_balance, Decimal('140.00'))
        self.assertEqual(source.balance, Decimal('140.00'))
        self.assertEqual(destination.balance, Decimal('100.00'))
        self.assertEqual(Transaction.objects.count(), 2)
        transaction = Transaction.objects.filter(account=source).first()
        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.transaction_type, Transaction.TYPE_TRANSFER)
        self.assertEqual(transaction.source_account, source)
        self.assertEqual(transaction.destination_account, destination)
        self.assertEqual(transaction.description, 'Virement vers Nom du beneficiaire — 60.00 HTG')

    def test_transfer_rejects_same_account(self):
        account = Account.objects.create(
            owner=self.user,
            account_number='HTG006',
            balance=Decimal('100.00'),
            currency=Account.CURRENCY_HTG,
        )

        with self.assertRaises(ValidationError):
            account.transfer(account, Decimal('10.00'))

    @patch('banking.models.get_rate', return_value=Decimal('0.25'))
    def test_transfer_allows_different_currency(self, mocked_get_rate):
        source = Account.objects.create(
            owner=self.user,
            account_number='HTG007',
            balance=Decimal('100.00'),
            currency=Account.CURRENCY_HTG,
        )
        destination = Account.objects.create(
            owner=self.other_user,
            account_number='USD001',
            balance=Decimal('100.00'),
            currency=Account.CURRENCY_USD,
        )

        new_balance = source.transfer(destination, Decimal('10.00'))

        source.refresh_from_db()
        destination.refresh_from_db()
        self.assertEqual(new_balance, Decimal('90.00'))
        self.assertEqual(source.balance, Decimal('90.00'))
        self.assertEqual(destination.balance, Decimal('102.50'))
        mocked_get_rate.assert_called_once_with('HTG', 'USD')

        transfer = Transaction.objects.filter(transaction_type=Transaction.TYPE_TRANSFER).order_by('id').first()
        self.assertIsNotNone(transfer)
        self.assertEqual(
            transfer.description,
            'Virement vers USD001 — 10.00 HTG (2.50 USD @ 0.25)',
        )

    @patch('banking.models.get_rate', return_value=Decimal('0.25'))
    def test_preview_transfer_returns_estimated_amount_for_different_currency(self, mocked_get_rate):
        source = Account.objects.create(
            owner=self.user,
            account_number='HTG008',
            balance=Decimal('100.00'),
            currency=Account.CURRENCY_HTG,
        )
        destination = Account.objects.create(
            owner=self.other_user,
            account_number='USD002',
            balance=Decimal('100.00'),
            currency=Account.CURRENCY_USD,
        )

        estimated_amount, rate = source.preview_transfer(destination, Decimal('20.00'))

        self.assertEqual(rate, Decimal('0.25'))
        self.assertEqual(estimated_amount, Decimal('5.00'))
        mocked_get_rate.assert_called_once_with('HTG', 'USD')


class BankingApiTests(APITestCase):
    refresh_cookie_name = 'merehbank_refresh_token'

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='apiuser', password='secret12345')
        self.other_user = User.objects.create_user(username='otheruser', password='secret12345')
        self.single_account_user = User.objects.create_user(
            username='single@example.com',
            email='single@example.com',
            password='secret12345',
        )
        self.htg_account = Account.objects.create(
            owner=self.user,
            account_number='HTG100',
            balance=Decimal('500.00'),
            overdraft_limit=Decimal('0.00'),
            currency=Account.CURRENCY_HTG,
            is_main=True,
        )
        self.usd_account = Account.objects.create(
            owner=self.user,
            account_number='USD100',
            balance=Decimal('150.00'),
            overdraft_limit=Decimal('0.00'),
            currency=Account.CURRENCY_USD,
            is_main=False,
        )
        self.other_account = Account.objects.create(
            owner=self.other_user,
            account_number='HTG200',
            balance=Decimal('75.00'),
            overdraft_limit=Decimal('0.00'),
            currency=Account.CURRENCY_HTG,
        )
        self.other_usd_account = Account.objects.create(
            owner=self.other_user,
            account_number='USD200',
            balance=Decimal('55.00'),
            overdraft_limit=Decimal('0.00'),
            currency=Account.CURRENCY_USD,
        )
        self.single_htg_account = Account.objects.create(
            owner=self.single_account_user,
            account_number='HTG300',
            balance=Decimal('100.00'),
            overdraft_limit=Decimal('0.00'),
            currency=Account.CURRENCY_HTG,
            is_main=True,
        )

    def authenticate(self):
        self.client.force_authenticate(user=self.user)

    def test_register_endpoint_creates_user(self):
        response = self.client.post(
            '/register',
            {
                'first_name': 'Jean',
                'last_name': 'Dupont',
                'email': 'newuser@example.com',
                'password': 'Secure123!',
                'password_confirm': 'Secure123!',
                'main_currency': Account.CURRENCY_USD,
                'terms': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], 'Compte créé avec succès.')
        self.assertTrue(User.objects.filter(username='newuser@example.com').exists())
        created_user = User.objects.get(username='newuser@example.com')
        created_account = Account.objects.get(owner=created_user)
        self.assertEqual(created_account.currency, Account.CURRENCY_USD)
        self.assertEqual(created_account.account_number, f'USD{created_user.pk:06d}')
        self.assertEqual(created_account.overdraft_limit, Decimal('0.00'))
        self.assertTrue(created_account.is_main)

    def test_register_endpoint_returns_field_errors(self):
        User.objects.create_user(
            username='existing@example.com',
            email='existing@example.com',
            password='Secure123!',
        )

        response = self.client.post(
            '/register',
            {
                'first_name': 'J',
                'last_name': 'Dupont1',
                'email': 'EXISTING@example.com',
                'password': 'password',
                'password_confirm': 'different-password',
                'main_currency': 'EUR',
                'terms': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('first_name', response.data)
        self.assertIn('last_name', response.data)
        self.assertIn('email', response.data)
        self.assertIn('password', response.data)
        self.assertIn('password_confirm', response.data)
        self.assertIn('main_currency', response.data)

    def test_login_and_refresh_endpoints_work(self):
        login_response = self.client.post(
            '/login',
            {
                'username': 'apiuser',
                'password': 'secret12345',
            },
            format='json',
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_response.data)
        self.assertNotIn('refresh', login_response.data)
        self.assertIn(self.refresh_cookie_name, login_response.cookies)
        self.assertTrue(login_response.cookies[self.refresh_cookie_name]['httponly'])
        self.assertEqual(login_response.cookies[self.refresh_cookie_name]['path'], '/')
        if settings.DEBUG:
            self.assertFalse(login_response.cookies[self.refresh_cookie_name]['secure'])
        else:
            self.assertTrue(login_response.cookies[self.refresh_cookie_name]['secure'])

        refresh_response = self.client.post(
            '/token/refresh',
            format='json',
        )

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_response.data)
        self.assertNotIn('refresh', refresh_response.data)

    def test_login_with_unknown_email_returns_generic_error(self):
        login_response = self.client.post(
            '/login',
            {
                'email': 'unknown@example.com',
                'password': 'secret12345',
            },
            format='json',
        )

        self.assertEqual(login_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', login_response.data)
        self.assertEqual(login_response.data['non_field_errors'][0], 'Email ou mot de passe incorrect.')

    def test_logout_revokes_access_token_and_blacklists_refresh(self):
        refresh = RefreshToken.for_user(self.user)
        access = str(refresh.access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        account_response = self.client.get('/account')
        self.assertEqual(account_response.status_code, status.HTTP_200_OK)

        logout_response = self.client.post(
            '/logout',
            {'refresh': str(refresh)},
            format='json',
        )

        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertTrue(RevokedAccessToken.objects.filter(jti=AccessToken(access)['jti']).exists())
        self.assertIn(self.refresh_cookie_name, logout_response.cookies)

        revoked_response = self.client.get('/account')
        self.assertEqual(revoked_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_account_endpoint_returns_user_accounts(self):
        self.authenticate()

        response = self.client.get('/account')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertIn('overdraft_limit', response.data[0])
        self.assertIn('available_balance', response.data[0])

    def test_account_post_opens_secondary_account(self):
        self.client.force_authenticate(user=self.single_account_user)

        response = self.client.post(
            '/account',
            {'currency': Account.CURRENCY_USD},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['account']['currency'], Account.CURRENCY_USD)
        self.assertEqual(response.data['account']['account_number'], f'USD{self.single_account_user.pk:06d}')
        self.assertEqual(response.data['account']['overdraft_limit'], '0.00')
        self.assertEqual(response.data['account']['available_balance'], '0.00')
        self.assertFalse(response.data['account']['is_main'])
        self.assertTrue(
            Account.objects.filter(owner=self.single_account_user, currency=Account.CURRENCY_USD).exists()
        )
        self.single_htg_account.refresh_from_db()
        opened_account = Account.objects.get(
            owner=self.single_account_user,
            currency=Account.CURRENCY_USD,
        )
        self.assertTrue(self.single_htg_account.is_main)
        self.assertFalse(opened_account.is_main)

    def test_account_endpoint_returns_main_account_first(self):
        self.authenticate()

        response = self.client.get('/account')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data[0]['is_main'])
        self.assertEqual(response.data[0]['account_number'], self.htg_account.account_number)
        self.assertFalse(response.data[1]['is_main'])

    def test_account_post_rejects_duplicate_currency(self):
        self.client.force_authenticate(user=self.single_account_user)

        response = self.client.post(
            '/account',
            {'currency': Account.CURRENCY_HTG},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('currency', response.data)

    def test_deposit_endpoint_updates_balance(self):
        self.authenticate()

        response = self.client.post(
            '/deposit',
            {
                'account_number': 'HTG100',
                'amount': '25.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.htg_account.refresh_from_db()
        self.assertEqual(self.htg_account.balance, Decimal('525.00'))

    def test_withdraw_endpoint_rejects_insufficient_balance(self):
        self.authenticate()

        response = self.client.post(
            '/withdraw',
            {
                'account_number': 'HTG100',
                'amount': '999.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_transfer_endpoint_updates_balances(self):
        self.authenticate()

        response = self.client.post(
            '/transfer',
            {
                'source_account_number': 'HTG100',
                'destination_account_number': 'HTG200',
                'recipient_name': 'Nom du beneficiaire',
                'amount': '50.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.htg_account.refresh_from_db()
        self.other_account.refresh_from_db()
        self.assertEqual(self.htg_account.balance, Decimal('450.00'))
        self.assertEqual(self.other_account.balance, Decimal('125.00'))

    def test_transfer_endpoint_rejects_insufficient_balance_with_clear_message(self):
        self.authenticate()

        response = self.client.post(
            '/transfer',
            {
                'source_account_number': 'HTG100',
                'destination_account_number': 'HTG200',
                'recipient_name': 'Nom du beneficiaire',
                'amount': '5000.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIsInstance(response.data, list)
        self.assertEqual(response.data[0], 'Solde insuffisant pour le moment.')

    @patch('banking.models.get_rate', return_value=Decimal('0.25'))
    def test_transfer_endpoint_allows_other_client_account_with_different_currency(self, mocked_get_rate):
        self.authenticate()

        response = self.client.post(
            '/transfer',
            {
                'source_account_number': 'HTG100',
                'destination_account_number': 'USD200',
                'recipient_name': 'Nom libre',
                'amount': '25.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.htg_account.refresh_from_db()
        self.other_usd_account.refresh_from_db()
        self.assertEqual(self.htg_account.balance, Decimal('475.00'))
        self.assertEqual(self.other_usd_account.balance, Decimal('61.25'))
        mocked_get_rate.assert_called_once_with('HTG', 'USD')

    @patch('banking.models.get_rate', return_value=Decimal('0.25'))
    def test_transfer_quote_returns_estimated_received_amount(self, mocked_get_rate):
        self.authenticate()

        response = self.client.post(
            '/transfer/quote',
            {
                'source_account_number': 'HTG100',
                'destination_account_number': 'USD200',
                'recipient_name': 'Nom libre',
                'amount': '20.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source_currency'], 'HTG')
        self.assertEqual(response.data['destination_currency'], 'USD')
        self.assertEqual(response.data['exchange_rate'], '0.25')
        self.assertEqual(response.data['estimated_received_amount'], '5.00')
        mocked_get_rate.assert_called_once_with('HTG', 'USD')

    @patch('banking.models.get_rate', return_value=Decimal('0.25'))
    def test_transfer_endpoint_allows_same_owner_destination_account(self, mocked_get_rate):
        self.authenticate()

        response = self.client.post(
            '/transfer',
            {
                'source_account_number': 'HTG100',
                'destination_account_number': 'USD100',
                'amount': '25.00',
                'recipient_name': 'Compte secondaire',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.htg_account.refresh_from_db()
        self.usd_account.refresh_from_db()
        self.assertEqual(self.htg_account.balance, Decimal('475.00'))
        self.assertEqual(self.usd_account.balance, Decimal('156.25'))
        mocked_get_rate.assert_called_once_with('HTG', 'USD')

        transfer = Transaction.objects.filter(account=self.htg_account).order_by('-id').first()
        self.assertIsNotNone(transfer)
        self.assertIn('Virement interne vers Compte USD', transfer.description)

    def test_transactions_endpoint_returns_user_transactions(self):
        self.authenticate()
        self.htg_account.deposit(Decimal('20.00'))
        self.htg_account.withdraw(Decimal('10.00'))
        self.htg_account.transfer(self.other_account, Decimal('15.00'))

        response = self.client.get('/transactions')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 3)
        self.assertTrue(all('account_currency' in transaction for transaction in response.data))
        transfer_rows = [transaction for transaction in response.data if transaction['transaction_type'] == 'transfer']
        self.assertTrue(all('transfer_kind_label' in transaction for transaction in transfer_rows))
        self.assertTrue(all('transfer_summary' in transaction for transaction in transfer_rows))

    @patch('banking.models.get_rate', return_value=Decimal('0.25'))
    def test_internal_transfer_history_is_clear(self, mocked_get_rate):
        self.authenticate()

        response = self.client.post(
            '/transfer',
            {
                'source_account_number': 'HTG100',
                'destination_account_number': 'USD100',
                'recipient_name': 'Compte USD',
                'amount': '20.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.get('/transactions')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        transfer_rows = [transaction for transaction in response.data if transaction['transaction_type'] == 'transfer']
        self.assertTrue(any(transaction['transfer_kind_label'] == 'Transfert interne' for transaction in transfer_rows))
        self.assertTrue(any('Compte débité: HTG100 (HTG)' in transaction['transfer_summary'] for transaction in transfer_rows))
        self.assertTrue(any('Compte crédité: USD100 (USD)' in transaction['transfer_summary'] for transaction in transfer_rows))

    def test_notifications_endpoint_returns_incoming_messages(self):
        self.authenticate()
        self.htg_account.deposit(Decimal('20.00'))
        self.other_account.transfer(self.htg_account, Decimal('15.00'))

        response = self.client.get('/notifications')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)
        messages = [notification['message'] for notification in response.data]
        self.assertTrue(any('Vous avez fait un dépôt de 20.00 HTG en succursale' in message for message in messages))
        self.assertTrue(any('Vous avez reçu 15.00 HTG de otheruser' in message for message in messages))

    @patch('banking.models.get_rate', return_value=Decimal('0.25'))
    def test_notifications_endpoint_ignores_internal_transfers(self, mocked_get_rate):
        self.authenticate()

        response = self.client.post(
            '/transfer',
            {
                'source_account_number': 'HTG100',
                'destination_account_number': 'USD100',
                'recipient_name': 'Compte USD',
                'amount': '20.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.get('/notifications')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        messages = [notification['message'] for notification in response.data]
        self.assertFalse(any('Compte USD' in message for message in messages))

    def test_account_transactions_endpoint_paginates_and_filters(self):
        self.authenticate()

        Account.objects.filter(pk=self.htg_account.pk).update(
            created_at=datetime(2023, 1, 1, tzinfo=dt_timezone.utc)
        )
        self.htg_account.refresh_from_db()

        created_transactions = []
        for _ in range(12):
            self.htg_account.deposit(Decimal('1.00'))
            created_transactions.append(
                Transaction.objects.filter(account=self.htg_account).order_by('-id').first()
            )

        for index, transaction in enumerate(created_transactions):
            if transaction is None:
                continue
            transaction_timestamp = datetime(2025, 3, 15, 12, 0, tzinfo=dt_timezone.utc)
            if index < 3:
                transaction_timestamp = datetime(2025, 1, 15, 12, 0, tzinfo=dt_timezone.utc)
            Transaction.objects.filter(pk=transaction.pk).update(timestamp=transaction_timestamp)

        response = self.client.get(f'/accounts/{self.htg_account.account_number}/transactions')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['account']['account_number'], self.htg_account.account_number)
        self.assertEqual(response.data['pagination']['count'], 12)
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['pagination']['num_pages'], 2)
        self.assertEqual(response.data['available_years'][0], 2023)

        filtered_response = self.client.get(
            f'/accounts/{self.htg_account.account_number}/transactions?year=2025&month=3&page=1'
        )

        self.assertEqual(filtered_response.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered_response.data['pagination']['count'], 9)
        self.assertTrue(
            all(
                datetime.fromisoformat(transaction['timestamp'].replace('Z', '+00:00')).year == 2025
                and datetime.fromisoformat(transaction['timestamp'].replace('Z', '+00:00')).month == 3
                for transaction in filtered_response.data['results']
            )
        )

    def test_history_endpoint_paginates_filters_and_includes_money_requests(self):
        self.authenticate()

        self.other_user.email = 'other@example.com'
        self.other_user.save(update_fields=['email'])

        Account.objects.filter(pk=self.htg_account.pk).update(
            created_at=datetime(2023, 1, 1, tzinfo=dt_timezone.utc)
        )
        self.htg_account.refresh_from_db()

        for index in range(21):
            self.htg_account.deposit(Decimal('1.00'))
            transaction = Transaction.objects.filter(account=self.htg_account).order_by('-id').first()
            if transaction is not None:
                timestamp = datetime(2025, 5, 10, 12, 0, tzinfo=dt_timezone.utc)
                if index == 20:
                    timestamp = datetime(2023, 2, 10, 12, 0, tzinfo=dt_timezone.utc)
                Transaction.objects.filter(pk=transaction.pk).update(timestamp=timestamp)

        request = self.client.post(
            '/money-requests',
            {
                'debtor_email': self.other_user.email,
                'source_account_number': self.htg_account.account_number,
                'amount': '50.00',
                'message': 'Test historique',
            },
            format='json',
        )
        self.assertEqual(request.status_code, status.HTTP_201_CREATED)

        response = self.client.get('/history')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pagination']['page_size'], 20)
        self.assertEqual(response.data['pagination']['num_pages'], 2)
        self.assertEqual(response.data['available_years'][0], 2023)
        self.assertGreaterEqual(response.data['pagination']['count'], 22)
        self.assertTrue(any(item['kind'] == 'money_request' for item in response.data['results']))

        filtered = self.client.get('/history?year=2023&month=2&kind=deposit&currency=HTG')
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertTrue(all(item['kind'] == 'deposit' for item in filtered.data['results']))
        self.assertTrue(all(item['account_currency'] == 'HTG' for item in filtered.data['results']))

    def test_money_request_endpoint_creates_notification_for_debtor(self):
        self.authenticate()
        self.user.first_name = 'John'
        self.user.last_name = 'Doe'
        self.user.save(update_fields=['first_name', 'last_name'])
        self.other_user.email = 'jane@example.com'
        self.other_user.save(update_fields=['email'])

        response = self.client.post(
            '/money-requests',
            {
                'debtor_email': self.other_user.email,
                'source_account_number': self.htg_account.account_number,
                'amount': '100.00',
                'message': 'Remboursement',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MoneyRequest.objects.count(), 1)
        self.assertEqual(MoneyRequest.objects.first().currency, Account.CURRENCY_HTG)
        notification = Notification.objects.get(user=self.other_user)
        self.assertEqual(
            notification.message,
            f'John Doe vous demande 100 {self.htg_account.currency}. Voulez-vous accepter cette demande ?',
        )
        self.assertEqual(notification.title, 'Nouvelle demande d\'argent')

    def test_money_request_endpoint_uses_selected_usd_account_currency(self):
        self.authenticate()
        self.user.first_name = 'John'
        self.user.last_name = 'Doe'
        self.user.save(update_fields=['first_name', 'last_name'])
        self.other_user.email = 'jane@example.com'
        self.other_user.save(update_fields=['email'])

        response = self.client.post(
            '/money-requests',
            {
                'debtor_email': self.other_user.email,
                'source_account_number': self.usd_account.account_number,
                'amount': '100.00',
                'message': 'Remboursement',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        money_request = MoneyRequest.objects.get()
        self.assertEqual(money_request.currency, Account.CURRENCY_USD)
        self.assertEqual(
            Notification.objects.get(user=self.other_user).message,
            'John Doe vous demande 100 USD. Voulez-vous accepter cette demande ?',
        )

    def test_notifications_endpoint_includes_money_request_notifications(self):
        self.authenticate()
        self.user.first_name = 'John'
        self.user.last_name = 'Doe'
        self.user.save(update_fields=['first_name', 'last_name'])
        self.other_user.email = 'jane@example.com'
        self.other_user.save(update_fields=['email'])

        self.client.post(
            '/money-requests',
            {
                'debtor_email': self.other_user.email,
                'source_account_number': self.htg_account.account_number,
                'amount': '100.00',
                'message': 'Remboursement',
            },
            format='json',
        )

        self.client.force_authenticate(user=self.other_user)
        response = self.client.get('/notifications')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        messages = [notification['message'] for notification in response.data]
        self.assertTrue(
            any(
                f'John Doe vous demande 100 {self.htg_account.currency}. Voulez-vous accepter cette demande ?' in message
                for message in messages
            )
        )
        self.assertTrue(any(notification['type'] == 'money_request' for notification in response.data))

    def test_accepting_money_request_returns_prefill_payload_without_transfer(self):
        self.authenticate()
        self.user.first_name = 'John'
        self.user.last_name = 'Doe'
        self.user.save(update_fields=['first_name', 'last_name'])
        self.other_user.email = 'jane@example.com'
        self.other_user.save(update_fields=['email'])

        create_response = self.client.post(
            '/money-requests',
            {
                'debtor_email': self.other_user.email,
                'source_account_number': self.htg_account.account_number,
                'amount': '100.00',
                'message': 'Peux-tu m\'envoyer cet argent ?',
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        request_id = create_response.data['money_request']['id']

        self.client.force_authenticate(user=self.other_user)
        response = self.client.post(f'/money-requests/{request_id}/accept', format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['money_request']['status'], MoneyRequest.STATUS_ACCEPTED)
        self.assertEqual(response.data['transfer']['destination_account_number'], self.htg_account.account_number)
        self.assertEqual(response.data['transfer']['amount'], '100.00')
        self.assertEqual(Transaction.objects.count(), 0)

    def test_rejecting_money_request_notifies_requester(self):
        self.authenticate()
        self.user.first_name = 'John'
        self.user.last_name = 'Doe'
        self.user.save(update_fields=['first_name', 'last_name'])
        self.other_user.first_name = 'Jane'
        self.other_user.last_name = 'Doe'
        self.other_user.email = 'jane@example.com'
        self.other_user.save(update_fields=['first_name', 'last_name', 'email'])

        create_response = self.client.post(
            '/money-requests',
            {
                'debtor_email': self.other_user.email,
                'source_account_number': self.htg_account.account_number,
                'amount': '100.00',
                'message': 'Peux-tu m\'envoyer cet argent ?',
            },
            format='json',
        )

        request_id = create_response.data['money_request']['id']
        self.client.force_authenticate(user=self.other_user)
        response = self.client.post(f'/money-requests/{request_id}/reject', format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['money_request']['status'], MoneyRequest.STATUS_REJECTED)
        requester_notifications = Notification.objects.filter(user=self.user)
        self.assertTrue(requester_notifications.exists())
        self.assertTrue(requester_notifications.filter(message='Jane Doe a refusé votre demande de 100 HTG.').exists())
