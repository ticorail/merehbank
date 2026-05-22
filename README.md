# merehbank

## Backend API

Le backend est exposé en Django REST Framework avec authentification JWT.

### Authentification

Les routes protégées nécessitent ce header :

```http
Authorization: Bearer <access_token>
```

### Endpoints

| Méthode | Route | Accès | Description | Payload |
| --- | --- | --- | --- | --- |
| POST | `/register` | Public | Crée un nouvel utilisateur | `username`, `password`, `email` (optionnel), `first_name` (optionnel), `last_name` (optionnel) |
| POST | `/login` | Public | Retourne les tokens JWT `access` et `refresh` | `username`, `password` |
| POST | `/token/refresh` | Public | Génère un nouveau token `access` | `refresh` |
| GET | `/account` | Authentifié | Liste les comptes du client connecté | Aucun |
| POST | `/deposit` | Authentifié | Dépose un montant sur un compte | `account_number`, `amount` |
| POST | `/withdraw` | Authentifié | Retire un montant d’un compte | `account_number`, `amount` |
| POST | `/transfer` | Authentifié | Vire un montant vers un autre compte | `source_account_number`, `destination_account_number`, `amount` |
| GET | `/transactions` | Authentifié | Retourne l’historique des transactions du client | Aucun |
| GET | `/admin/` | Admin Django | Interface d’administration Django | Aucun |

### Référence API

#### POST `/register`

Crée un nouvel utilisateur.

Exemple de requête :

```json
{
	"username": "client1",
	"password": "secret12345",
	"email": "client1@example.com",
	"first_name": "Jean",
	"last_name": "Pierre"
}
```

Réponse attendue : `201 Created`

```json
{
	"username": "client1",
	"email": "client1@example.com",
	"first_name": "Jean",
	"last_name": "Pierre"
}
```

#### POST `/login`

Retourne les tokens JWT `access` et `refresh`.

Exemple de requête :

```json
{
	"username": "client1",
	"password": "secret12345"
}
```

Réponse attendue : `200 OK`

```json
{
	"refresh": "<refresh_token>",
	"access": "<access_token>"
}
```

#### POST `/token/refresh`

Génère un nouveau token `access`.

Exemple de requête :

```json
{
	"refresh": "<refresh_token>"
}
```

Réponse attendue : `200 OK`

```json
{
	"access": "<new_access_token>"
}
```

#### GET `/account`

Liste les comptes du client connecté.

Exemple de réponse :

```json
[
	{
		"id": 1,
		"account_number": "HTG100",
		"balance": "500.00",
		"account_type": "checking",
		"currency": "HTG",
		"created_at": "2026-05-15T10:00:00Z"
	}
]
```

#### POST `/deposit`

Dépose un montant sur un compte du client connecté.

Exemple de requête :

```json
{
	"account_number": "HTG100",
	"amount": "25.00"
}
```

Exemple de réponse :

```json
{
	"message": "Dépôt effectué avec succès.",
	"account_number": "HTG100",
	"new_balance": "525.00"
}
```

#### POST `/withdraw`

Retire un montant d’un compte du client connecté.

Exemple de requête :

```json
{
	"account_number": "HTG100",
	"amount": "25.00"
}
```

Réponse d’erreur possible :

```json
{
	"non_field_errors": ["Solde insuffisant. Disponible : 10.00 HTG"]
}
```

#### POST `/transfer`

Vire un montant vers un autre compte.

Exemple de requête :

```json
{
	"source_account_number": "HTG100",
	"destination_account_number": "HTG200",
	"amount": "50.00"
}
```

Exemple de réponse :

```json
{
	"message": "Virement effectué avec succès.",
	"source_account_number": "HTG100",
	"destination_account_number": "HTG200",
	"new_balance": "450.00"
}
```

#### GET `/transactions`

Retourne l’historique des transactions du client connecté.

Exemple de réponse :

```json
[
	{
		"id": 1,
		"transaction_type": "deposit",
		"amount": "25.00",
		"timestamp": "2026-05-15T10:10:00Z",
		"account": 1,
		"source_account": null,
		"destination_account": null,
		"description": "Dépôt de 25.00 HTG"
	}
]
```

### Règles métier

- Un dépôt doit avoir un montant strictement positif.
- Un retrait doit vérifier que le solde est suffisant.
- Un virement vérifie que le compte destination existe.
- Un virement vers le même compte est refusé.
- Un virement est exécuté de manière atomique.
- Un client peut avoir un compte en `HTG`, un compte en `USD`, ou les deux.

### Modèles principaux

- `Account` : numéro de compte, solde, type de compte, devise, propriétaire.
- `Transaction` : type de transaction, montant, date, compte source/destination, description.

### Tests

La suite de tests du module `banking` couvre les règles métier et les endpoints REST.
