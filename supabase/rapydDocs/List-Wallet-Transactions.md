### List Wallet Transactions

Retrieve a list of all transactions related to a wallet.


## List Wallet Transactions:
# Request structure: 
    curl -X get 'https://sandboxapi.rapyd.net/v1/ewallets/ewallet_c1943cfeda5f98247ab117e5d2648861/transactions' \
    -H 'access_key: your-access-key-here' \
    -H 'Content-Type: application/json' \
    -H 'salt: your-random-string-here' \
    -H 'signature: your-calculated-signature-here' \
    -H 'timestamp: your-unix-timestamp-here'


# Response structure:
    {
        "status": {
            "error_code": "",
            "status": "SUCCESS",
            "message": "",
            "response_code": "",
            "operation_id": "cb8163af-6942-4f1e-849b-7d54f621be05"
        },
        "data": [
            {
                "id": "wt_bbd5578112e0e74740f71690d648a7d3",
                "currency": "USD",
                "amount": 9.99,
                "ewallet_id": "ewallet_c1943cfeda5f98247ab117e5d2648861",
                "type": "payment_funds_in",
                "subtype": null,
                "balance_type": "available_balance",
                "balance": 191254.92,
                "created_at": 1763462541,
                "status": "CLOSED",
                "reason": "",
                "metadata": {}
            },
            {
                "id": "wt_dddf02617216003e2fb47020c4653264",
                "currency": "USD",
                "amount": 14.35,
                "ewallet_id": "ewallet_c1943cfeda5f98247ab117e5d2648861",
                "type": "payment_funds_in",
                "subtype": null,
                "balance_type": "available_balance",
                "balance": 191244.93,
                "created_at": 1763460569,
                "status": "CLOSED",
                "reason": "",
                "metadata": {}
            }
        ]
    }

## List Wallet Transactions by type:
# reuqest structure:
    curl -X get 'https://sandboxapi.rapyd.net/v1/ewallets/ewallet_c1943cfeda5f98247ab117e5d2648861/transactions?type=payment_funds_in&page_size=2&page_number=1' \
    -H 'access_key: your-access-key-here' \
    -H 'Content-Type: application/json' \
    -H 'salt: your-random-string-here' \
    -H 'signature: your-calculated-signature-here' \
    -H 'timestamp: your-unix-timestamp-here'

# response structure:
    {
        "status": {
            "error_code": "",
            "status": "SUCCESS",
            "message": "",
            "response_code": "",
            "operation_id": "9eb50757-e079-49e4-aebd-abc30ff32d77"
        },
        "data": [
            {
                "id": "wt_bbd5578112e0e74740f71690d648a7d3",
                "currency": "USD",
                "amount": 9.99,
                "ewallet_id": "ewallet_c1943cfeda5f98247ab117e5d2648861",
                "type": "payment_funds_in",
                "subtype": null,
                "balance_type": "available_balance",
                "balance": 191254.92,
                "created_at": 1763462541,
                "status": "CLOSED",
                "reason": "",
                "metadata": {}
            },
            {
                "id": "wt_dddf02617216003e2fb47020c4653264",
                "currency": "USD",
                "amount": 14.35,
                "ewallet_id": "ewallet_c1943cfeda5f98247ab117e5d2648861",
                "type": "payment_funds_in",
                "subtype": null,
                "balance_type": "available_balance",
                "balance": 191244.93,
                "created_at": 1763460569,
                "status": "CLOSED",
                "reason": "",
                "metadata": {}
            }
        ]
    }


## Parameters
    Request Path Parameters
    ewallet = ID of the wallet. String starting with ewallet_.

    Request Query Parameters
    balance = The updated wallet balance after successful completion of the transaction.

    currency = Three-letter ISO 4217 code for the currency of the transactions.

    end_date = Timestamp of the last transaction, in Unix time.

    ending_before = The ID of the wallet transaction created after the last wallet transaction you want to retrieve. String starting with wt_.

    page_number = Page number to retrieve.

    page_size = Number of results per page.

    start_date = Timestamp of the first transaction, in Unix time.

    starting_after = The ID of the wallet transaction created before the first wallet transaction you want to retrieve. String starting with wt_.

    type = Type of transaction.

    Request Header Parameters
    access_key = Unique access key provided by Rapyd for each authorized user.

    Content-Type = Indicates that the data appears in JSON format. Set to application/json.

    salt = Random string. Recommended length: 8-16 characters.

    signature = Signature calculated for each request individually.

    timestamp = Timestamp for the request, in Unix time (seconds).

    # Response Parameters
    amount = Amount of the transaction, in units of the currency defined in currency. Decimal, including the correct number of decimal places for the currency exponent, as defined in ISO 4217:2015.

    balance = Amount of the balance affected by the transaction.

    balance_type = Type of the currency account balance of the wallet affected by the transaction. See Wallet Balance Types.

    created_at = Time the transaction was made, in Unix time.

    currency_code = Three-letter ISO 4217 code for the currency used in the amount field.

    destination_balance_type = Type of the currency account balance of the wallet receiving the money. See Wallet Balance Types.

    destination_ewallet_id = ID of the wallet receiving the money. String starting with ewallet_.

    destination_phone_number = Phone number of the owner of the wallet receiving the money, in E.164 format.

    destination_transaction_id = ID of the transaction with regard to the destination. String starting with wt_.

    ewallet_id = ID of the affected wallet. String starting with ewallet_.

    id = ID of the transaction. UUID.

    metadata = A JSON object defined by the client. See Metadata.

    reason = Reason for the transaction.

    response_metadata = Metadata created with Set Transfer Response.

    source_balance_type = Type of the currency account balance of the wallet sending the money. See Wallet Balance Types.

    source_ewallet_id = ID of the wallet sending the money. String starting with ewallet_.

    source_transaction_id = ID of the transaction with regard to the source. String starting with wt_.

    status = Status of the transaction.
        CAN - Canceled. The transferor canceled the transfer.
        CLO - Closed. The transferee accepted the funds.
        DEC - Declined. The transferee rejected the transfer.
        EXP - Expired. The transferee did not respond before the transfer expired.
        HLD - Hold. Rapyd Protect is putting this transfer on hold and reviewing it.
        PEN - Pending. Waiting for the transferee to accept.
        REJ - Rejected. Rapyd Protect has rejected this transfer.

    subtype = Subtype of the transaction.

    transfer_response_at = Time of the Set Transfer Response operation, in Unix time.

    type = Transaction type. See Transaction Types.


    # Code Samples:
        const makeRequest = require('<path-to-your-utility-file>/utilities').makeRequest;

        async function main() {
            try {
                const result = await makeRequest(
                'GET',
                '/v1/user/ewallet_5d228399661dac92968ace74f7aa00c6/transactions'
                );
                console.log(result);
            } catch (error) {
                console.error('Error completing request', error);
            }
        }