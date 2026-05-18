from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.generics import CreateAPIView
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Account, Transaction
from .serializers import (
    AccountSerializer,
    DepositSerializer,
    TransactionSerializer,
    TransferSerializer,
    UserRegistrationSerializer,
    WithdrawSerializer,
)


class RegisterView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class AccountView(APIView):
    def get(self, request):
        accounts = Account.objects.filter(owner=request.user).order_by('-created_at')
        serializer = AccountSerializer(accounts, many=True)
        return Response(serializer.data)


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
        destination_account = get_object_or_404(
            Account,
            account_number=serializer.validated_data['destination_account_number'],
        )
        try:
            new_balance = source_account.transfer(destination_account, serializer.validated_data['amount'])
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


class TransactionListView(APIView):
    def get(self, request):
        transactions = Transaction.objects.filter(account__owner=request.user) | Transaction.objects.filter(
            source_account__owner=request.user
        ) | Transaction.objects.filter(destination_account__owner=request.user)
        transactions = transactions.distinct().order_by('-timestamp')
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)
