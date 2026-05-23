from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import Account, MoneyRequest, Notification
from rest_framework.test import APIClient

User = get_user_model()

class MoneyRequestModelTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username='johndoe', 
            email='john@example.com', 
            password='password123',
            first_name='John',
            last_name='Doe'
        )
        self.user_b = User.objects.create_user(
            username='janedoe', 
            email='jane@example.com', 
            password='password123',
            first_name='Jane',
            last_name='Doe'
        )
        self.account_a = Account.create_for_user(self.user_a, Account.CURRENCY_USD)

    def test_money_request_creates_notification(self):
        """
        Vérifie que la création d'une demande génère automatiquement une notification
        avec le nom complet, le bon montant et la bonne devise pour le débiteur.
        """
        request = MoneyRequest.objects.create(
            requester_account=self.account_a,
            debtor=self.user_b,
            currency=self.account_a.currency,
            amount=Decimal('100.00'),
            message="Remboursement"
        )

        self.assertTrue(Notification.objects.filter(user=self.user_b).exists())
        notification = Notification.objects.get(user=self.user_b)
        
        expected_message = "John Doe vous demande 100 USD. Voulez-vous accepter cette demande ?"
        self.assertEqual(notification.message, expected_message)
        self.assertFalse(notification.is_read)

    def test_money_request_rejects_invalid_source_account(self):
        self.user_b.email = 'jane@example.com'
        self.user_b.save(update_fields=['email'])

        api_client = APIClient()
        api_client.force_authenticate(user=self.user_a)

        response = api_client.post(
            '/money-requests',
            {
                'debtor_email': self.user_b.email,
                'source_account_number': 'USD999999',
                'amount': '100.00',
                'message': 'Remboursement',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['source_account_number'], 'Aucun compte ne correspond à ce numéro.')

    def test_money_request_rejects_own_email_as_debtor(self):
        api_client = APIClient()
        api_client.force_authenticate(user=self.user_a)

        response = api_client.post(
            '/money-requests',
            {
                'debtor_email': self.user_a.email,
                'source_account_number': self.account_a.account_number,
                'amount': '100.00',
                'message': 'Remboursement',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['debtor_email'], 'Aucun client ne correspond à cette adresse email.')

    def test_accept_and_transfer_creates_single_notification(self):
        """
        Simule le flux complet: A demande à B, B accepte et envoie le virement.
        Vérifie que le demandeur (A) voit une seule notification de type "Virement reçu".
        """
        # Create user accounts
        account_b = Account.create_for_user(self.user_b, Account.CURRENCY_USD)
        # Credit B so they can send the transfer
        account_b.deposit(Decimal('100.00'))

        # A creates a money request to B
        money_request = MoneyRequest.objects.create(
            requester_account=self.account_a,
            debtor=self.user_b,
            currency=self.account_a.currency,
            amount=Decimal('50.00'),
            message="Paiement"
        )

        # B accepts the request (mark accepted)
        money_request.status = MoneyRequest.STATUS_ACCEPTED
        money_request.save(update_fields=['status'])

        # B performs the transfer to A
        account_b.transfer(
            destination_account=self.account_a,
            amount=Decimal('50.00'),
            recipient_name=self.account_a.owner.get_full_name()
        )

        # Fetch notifications for A via the NotificationView logic using test client
        api_client = APIClient()
        api_client.force_authenticate(user=self.user_a)
        response = api_client.get('/notifications')
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        # Count transfer notifications (title == 'Virement reçu')
        transfers = [item for item in payload if item.get('title') == 'Virement reçu']
        self.assertEqual(len(transfers), 1, f"Expected 1 transfer notification, found {len(transfers)}: {payload}")

    def test_money_request_transfer_cannot_be_replayed(self):
        """
        Vérifie qu'une demande d'argent honorée devient completed et ne peut pas
        être rejouée via le même request_id.
        """
        account_b = Account.create_for_user(self.user_b, Account.CURRENCY_USD)
        account_b.deposit(Decimal('100.00'))

        money_request = MoneyRequest.objects.create(
            requester_account=self.account_a,
            debtor=self.user_b,
            currency=self.account_a.currency,
            amount=Decimal('25.00'),
            message='Paiement'
        )
        money_request.status = MoneyRequest.STATUS_ACCEPTED
        money_request.save(update_fields=['status'])

        api_client = APIClient()
        api_client.force_authenticate(user=self.user_b)

        response = api_client.post(
            '/transfer',
            {
                'source_account_number': account_b.account_number,
                'destination_account_number': self.account_a.account_number,
                'recipient_name': self.account_a.owner.get_full_name(),
                'amount': '25.00',
                'request_id': money_request.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        money_request.refresh_from_db()
        self.assertEqual(money_request.status, MoneyRequest.STATUS_COMPLETED)

        replay_response = api_client.post(
            '/transfer',
            {
                'source_account_number': account_b.account_number,
                'destination_account_number': self.account_a.account_number,
                'recipient_name': self.account_a.owner.get_full_name(),
                'amount': '25.00',
                'request_id': money_request.id,
            },
            format='json',
        )

        self.assertEqual(replay_response.status_code, 400)
        self.assertTrue(
            'traitée' in str(replay_response.data).lower() or 'already' in str(replay_response.data).lower()
        )