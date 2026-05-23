from django.urls import path

from .views import (
    AccountView,
    DepositView,
    LoginView,
    MoneyRequestView,
    MoneyRequestAcceptView,
    MoneyRequestRejectView,
    AccountTransactionsView,
    NotificationView,
        HistoryView,
    RefreshView,
    LogoutView,
    RegisterView,
    TransactionListView,
    TransferQuoteView,
    TransferView,
    WithdrawView,
)

urlpatterns = [
    path('register', RegisterView.as_view(), name='register'),
    path('login', LoginView.as_view(), name='login'),
    path('token/refresh', RefreshView.as_view(), name='token-refresh'),
    path('logout', LogoutView.as_view(), name='logout'),
    path('account', AccountView.as_view(), name='account'),
    path('deposit', DepositView.as_view(), name='deposit'),
    path('withdraw', WithdrawView.as_view(), name='withdraw'),
    path('transfer/quote', TransferQuoteView.as_view(), name='transfer-quote'),
    path('transfer', TransferView.as_view(), name='transfer'),
    path('money-requests', MoneyRequestView.as_view(), name='money-requests'),
    path('money-requests/<int:request_id>/accept', MoneyRequestAcceptView.as_view(), name='money-request-accept'),
    path('money-requests/<int:request_id>/reject', MoneyRequestRejectView.as_view(), name='money-request-reject'),
    path('notifications', NotificationView.as_view(), name='notifications'),
        path('history', HistoryView.as_view(), name='history'),
    path('transactions', TransactionListView.as_view(), name='transactions'),
    path('accounts/<str:account_number>/transactions', AccountTransactionsView.as_view(), name='account-transactions'),
]
