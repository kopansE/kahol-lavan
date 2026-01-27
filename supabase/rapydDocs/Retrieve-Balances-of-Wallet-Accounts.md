### Retrieve Balances of Wallet Accounts

Retrieve the balances of currency accounts in a Rapyd Wallet.

request:
curl -X get 'https://sandboxapi.rapyd.net/v1/ewallets/ewallet_b9cbf3f4691aab019efacc3e376548df/accounts' \
-H 'access_key: your-access-key-here' \
-H 'Content-Type: application/json' \
-H 'salt: your-random-string-here' \
-H 'signature: your-calculated-signature-here' \
-H 'timestamp: your-unix-timestamp-here'

response: 
{
    "status": {
        "error_code": "",
        "status": "SUCCESS",
        "message": "",
        "response_code": "",
        "operation_id": "885d9f7f-4e2a-4e7a-85b2-e0cde8fc07a6"
    },
    "data": [
        {
            "id": "644410b8-e721-43b2-8847-4764cc0e4a00",
            "currency": "EUR",
            "alias": "EUR",
            "balance": 4900,
            "received_balance": 0,
            "on_hold_balance": 0,
            "reserve_balance": 0,
            "limits": null,
            "limit": null
        }
    ]
}