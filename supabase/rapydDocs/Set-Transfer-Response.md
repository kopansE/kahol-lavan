## Set Transfer Response

Respond to a transfer of funds between wallets.

The transferee uses this method to accept or decline the transfer.

The sender can use this method to cancel the transfer, unless Rapyd Protect is reviewing the transfer.

This method triggers Transfer Funds Between Wallets Response Webhook.

# Note
This method can be used only one time per transfer transaction, and must be used before the expiration date set in the request to create the transfer.
This endpoint replaces the deprecated endpoint - POST /v1/ewallets/transfer/response
Rapyd continues to support the deprecated endpoint. No sunset date has been set.
The code samples include successful requests (200) and bad requests (400).
For error messages that appear due to bad requests (400), see:
# General Errors
Wallet Transaction Errors
For information about unauthorized request (401) and other authentication errors, see Troubleshooting Authentication and Authorization Errors.


# endpoint: /v1/ewallets/transfer/response
Accept


*Request structure:*

curl -X post 'https://sandboxapi.rapyd.net/v1/ewallets/transfer/response' \
-H 'access_key: your-access-key-here' \
-H 'Content-Type: application/json' \
-H 'idempotency: your-idempotency-parameter-here' \
-H 'salt: your-random-string-here' \
-H 'signature: your-calculated-signature-here' \
-H 'timestamp: your-unix-timestamp-here' \
--data-raw '{
    "id": "89a72f09-24b7-4eb4-9d49-9864f1d2abaf",
    "status": "accept"
}'

*Response structure:*
{
    "status": {
        "error_code": "",
        "status": "SUCCESS",
        "message": "",
        "response_code": "",
        "operation_id": "bcf6aeca-616b-4d6b-9c5b-5791efb31b0a"
    },
    "data": {
        "id": "89a72f09-24b7-4eb4-9d49-9864f1d2abaf",
        "status": "CLO",
        "amount": 50,
        "currency_code": "ILS",
        "destination_phone_number": "",
        "destination_ewallet_id": "ewallet_b5320c566cc4aa01fe77440ad08693f7",
        "destination_transaction_id": "wt_164b36175995fdd464326a1f3b9f2ef7",
        "source_ewallet_id": "ewallet_c1943cfeda5f98247ab117e5d2648861",
        "source_transaction_id": "wt_eca5edf2b42bd86e66d3e1cd4fdb694c",
        "transfer_response_at": 1764834186,
        "created_at": 1764834155,
        "metadata": {},
        "response_metadata": {},
        "expiration": 1766043755
    }
}



# Request Header Parameters

access_key = Unique access key provided by Rapyd for each authorized user.

Content-Type = Indicates that the data appears in JSON format. Set to application/json.

idempotency = A unique key that prevents the platform from creating the same object twice.

salt = Random string. Recommended length: 8-16 characters.

signature = Signature calculated for each request individually.

timestamp = Timestamp for the request, in Unix time (seconds).

# Request Body Parameters
id= ID of the transfer transaction, from the id field in the data object of the response. UUID.

metadata = A JSON object defined by the client. See Metadata.

status = Determines how to handle the transfer. One of the following values: accept | decline | cancel

Note: You cannot cancel a transfer that is being reviewed.


# Response Parameters
amount = Amount of the transaction, in units of the currency defined in currency. Decimal, including the correct number of decimal places for the currency exponent, as defined in ISO 4217:2015.

created_at = Time the transaction was made, in Unix time.

currency_code = Three-letter ISO 4217 code for the currency used in the amount field. (ILS)

destination_ewallet_id ID of the wallet receiving the money. String starting with ewallet_.

destination_phone_number = Phone number of the owner of the wallet receiving the money, in E.164 format.

destination_transaction_id = ID of the transaction with regard to the destination. String starting with wt_.

expiration = The day the transfer expires, in Unix time.

id = ID of the transaction. UUID.

metadata = A JSON object defined by the client. See Metadata.

response_metadata = Metadata created with Set Transfer Response.

source_ewallet_id = ID of the wallet sending the money. String starting with ewallet_.

source_transaction_id = ID of the transaction with regard to the source. String starting with wt_.

status = Status of the transaction:
    1. CAN - Canceled. The transferor canceled the transfer.
    2. CLO - Closed. The transferee accepted the funds.
    3. DEC - Declined. The transferee rejected the transfer.
    4. EXP - Expired. The transferee did not respond before the transfer expired.
    5. HLD - Hold. Rapyd Protect is putting this transfer on hold and reviewing it.
    6. PEN - Pending. Waiting for the transferee to accept.
    7. REJ - Rejected. Rapyd Protect has rejected this transfer.

transfer_response_at = Time of the Set Transfer Response operation, in Unix time.