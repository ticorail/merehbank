from django.test import TestCase
from django.utils import timezone
from datetime import datetime
from rest_framework.test import APIClient
from django.db.models import Min, Q
from django.contrib.auth import get_user_model
from decimal import Decimal

from .models import Account, Transaction, MoneyRequest

User = get_user_model()


class HistoryFilterTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='histuser', email='h@example.com', password='pass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Account opened on 2026-02-01
        created_at = timezone.make_aware(datetime(2026, 2, 1))
        self.account = Account.objects.create(
            owner=self.user,
            account_number='USD000011',
            balance=Decimal('500.00'),
            overdraft_limit=Decimal('0.00'),
            currency=Account.CURRENCY_USD,
            is_main=True,
        )
        # override auto_now_add for tests so created_at reflects desired date
        Account.objects.filter(pk=self.account.pk).update(created_at=created_at)
        self.account.refresh_from_db()

    def test_before_creation_period_history(self):
        resp = self.client.get('/history', {'month': '1', 'year': '2026', 'page': '1'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['results'], [])
        self.assertTrue(resp.data['filters'].get('is_before_history', False))

    def test_current_month_history_contains_transaction(self):
        now = timezone.now()
        ts = timezone.make_aware(datetime(now.year, now.month, 3, 10, 0, 0))
        t = Transaction.objects.create(transaction_type=Transaction.TYPE_DEPOSIT, amount=Decimal('20.00'), account=self.account, timestamp=ts)

        resp = self.client.get('/history', {'month': str(now.month), 'year': str(now.year), 'page': '1'})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(len(resp.data['results']) >= 1)
        ids = [r['id'] for r in resp.data['results']]
        self.assertIn(t.id, ids)

    def test_future_month_history_flag(self):
        now = timezone.now()
        year = now.year
        month = now.month + 1
        if month == 13:
            month = 1
            year += 1
        resp = self.client.get('/history', {'month': str(month), 'year': str(year), 'page': '1'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['results'], [])
        self.assertTrue(resp.data['filters'].get('is_future_period', False))

    def test_valid_period_without_transactions(self):
        # choose March 2026 (after opening) but with no transactions
        # debug: inspect earliest account created and oldest activity
        earliest_account_created = Account.objects.filter(owner=self.user).aggregate(first=Min('created_at'))['first']
        oldest_transaction = Transaction.objects.filter(Q(account__owner=self.user) | Q(source_account__owner=self.user) | Q(destination_account__owner=self.user)).aggregate(oldest=Min('timestamp'))['oldest']

        resp = self.client.get('/history', {'month': '3', 'year': '2026', 'page': '1'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['results'], [])
        self.assertFalse(resp.data['filters'].get('is_before_history', False))
        self.assertFalse(resp.data['filters'].get('is_future_period', False))
