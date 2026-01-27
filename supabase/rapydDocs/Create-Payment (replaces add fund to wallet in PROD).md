### Create Payment
Create a payment to collect money into a Rapyd Wallet.

Use this method in the following situations:
- To collect money immediately for a one-time charge.
- To fund one or more Rapyd Wallets.
- To replace a failed payment in a group payment. You can replace all or part of the portion that failed.

If the payment_method is not specified, Rapyd collects the funds from the default_payment_method of the customer object. The default payment method must be tokenizable.

For card payments, Rapyd saves the card payment method to the customer if you set save_payment_method to true. If you do not want Rapyd to save the card payment method to the customer, set save_payment_method to false. The default is false.

When Rapyd does not save the card payment method to the customer, the values of payment_method and payment_method_data.id in the response are null.

Payment Facilitator (PayFac) Card payments: As a PayFac, your sub-merchant can collect funds from a card payment, and you can direct the funds to your client wallet. The collected funds are settled via the PayFac’s client wallet. See the sample 'Payment with Merchant Wallet' on this page and the Creating a Card Payment workflow.

In production, you cannot save a card payment method for a telephone order.

Some card payment methods require payment_method.fields.recurrence_type to specify the primary intended purpose of a saved payment method. See Saving a European Card While Creating a Payment. One of the following values:
- recurring - Regular payments for an indefinite period.
- installment - Regular payments for a defined number of payment cycles.
- unscheduled - Individual unrelated payments. This is the default.

The payment method might also require initiation_type for each payment. See Creating a Payment with a European Card on File.

This method triggers Payment Succeeded Webhook. This webhook contains the same information as the response. If the action of a third party is not required, the Payment Completed Webhook is also triggered.

The following asynchronous webhooks provide information about later changes to the payment object:

- Escrow Payment Released Webhook
- Payment Expired Webhook
- Payment Failed Webhook

In the sandbox:
To simulate completion of a payment method that requires the action of a third party, you must run Complete Payment.
To simulate completion of a payment that requires 3DS authentication, see Simulating 3DS Authentication. Relevant where the payment method type is card.
To simulate a cardholder dispute, create a payment using a specific, reserved card number. Set payment_method_options.3d_required to false. See Simulating Cardholder Disputes.

# Note
Only clients with PCI certification can handle personal identifying information for cards. Clients that are not PCI-certified can use Rapyd Checkout to collect money from a card. See Checkout Page.

If you create a payment that is split by amount and the total of the identified wallets is less than the amount of the payment, the remainder is paid into the client wallet.

For a split payment, you must choose amount for all wallets or percentage for all wallets. You cannot mix these options.

Before you create a payment with a tokenized payment method, verify that the value of is_tokenizable is true.

When you create a card payment, a zero-amount transaction is processed.

Transactions with 3DS authentication must be authenticated within 15 minutes.

Requests for very small amounts are rounded down to zero, are not processed, and throw an error. This can occur in payments that are split among two or more wallets, or in payments with FX.

Use this method to create a network reference ID for a recurring card payment. You also can create a network reference ID when you add a payment method to a customer. See Add Payment Method to Customer.

A SEPA (Single Euro Payments Area) bank transfer can be disputed for 13 months after the payment is created.


## Prerequisites
You must run Get Payment Method Required Fields before creating a payment.
Payment Method - Required for using a payment method on file. See Add Payment Method to Customer and Create Card Token.
Customer - Required for using a customer’s default payment method on file.
Wallet - Required for directing the collected funds to a merchant or customer. See Create Wallet.
Response Errors
For error examples, see Create Payment Error Examples.
For more information on errors, refer to the following pages:


# Payment Errors
Bank Transfer Error Messages
Card Network Errors
Card Transaction Errors
Foreign Exchange Errors


# Request Structure:
curl -X post 'https://sandboxapi.rapyd.net/v1/payments' \
-H 'access_key: your-access-key-here' \
-H 'Content-Type: application/json' \
-H 'idempotency: your-idempotency-parameter-here' \
-H 'salt: your-random-string-here' \
-H 'signature: your-calculated-signature-here' \
-H 'timestamp: your-unix-timestamp-here' \
--data-raw '{
    "amount": 50.00,
    "currency": "ILS",
    "customer": "cus_4e25112ac20e144ad073a614dc46934b",
    "description": "Payment by customer's default payment method" 
}'

# Response Structure:
{
    "status": {
        "error_code": "",
        "status": "SUCCESS",
        "message": "",
        "response_code": "",
        "operation_id": "5e81e0ba-2495-4a7f-babc-5b6e820db572"
    },
    "data": {
        "id": "payment_d31d3ca850419ab5e2f9f1a33f9c6eea",
        "amount": 45,
        "original_amount": 45,
        "is_partial": false,
        "currency_code": "EUR",
        "country_code": "GB",
        "status": "CLO",
        "description": "Payment by customer's default payment method",
        "merchant_reference_id": "",
        "customer_token": "cus_4e25112ac20e144ad073a614dc46934b",
        "payment_method": null,
        "payment_method_data": {
            "id": null,
            "type": "gb_visa_card",
            "category": "card",
            "metadata": {},
            "image": "",
            "webhook_url": "",
            "supporting_documentation": "",
            "next_action": "not_applicable",
            "name": "John Doe",
            "last4": "1111",
            "acs_check": "unchecked",
            "cvv_check": "unchecked",
            "bin_details": {
                "type": "DEBIT",
                "brand": "VISA",
                "level": "CLASSIC",
                "issuer": "CONOTOXIA SP. Z O.O",
                "country": "PL",
                "bin_number": "411111"
            },
            "expiration_year": "35",
            "expiration_month": "12",
            "fingerprint_token": "ocfp_e599f990674473ce6283b245e9ad2467",
            "network_reference_id": "507150",
            "payment_account_reference": "V00180MCW82MN270KDRQO8AJNBBMJ"
        },
        "auth_code": null,
        "expiration": 1756896871,
        "captured": true,
        "refunded": false,
        "refunded_amount": 0,
        "receipt_email": "",
        "redirect_url": "",
        "complete_payment_url": "",
        "error_payment_url": "",
        "receipt_number": "",
        "flow_type": "",
        "address": null,
        "statement_descriptor": "Doc Team",
        "transaction_id": "",
        "created_at": 1756292071,
        "metadata": {},
        "failure_code": "",
        "failure_message": "",
        "paid": true,
        "paid_at": 1756292071,
        "dispute": null,
        "refunds": null,
        "order": null,
        "outcome": null,
        "visual_codes": {},
        "textual_codes": {},
        "instructions": [],
        "ewallet_id": "ewallet_c1943cfeda5f98247ab117e5d2648861",
        "ewallets": [
            {
                "ewallet_id": "ewallet_c1943cfeda5f98247ab117e5d2648861",
                "amount": 45,
                "percent": 100,
                "refunded_amount": 0
            }
        ],
        "payment_method_options": {},
        "payment_method_type": "gb_visa_card",
        "payment_method_type_category": "card",
        "fx_rate": 1,
        "merchant_requested_currency": null,
        "merchant_requested_amount": null,
        "fixed_side": "",
        "payment_fees": null,
        "invoice": "",
        "escrow": null,
        "group_payment": "",
        "cancel_reason": null,
        "initiation_type": "customer_present",
        "mid": "",
        "next_action": "not_applicable",
        "error_code": "",
        "remitter_information": {},
        "save_payment_method": false,
        "merchant_advice_code": null,
        "merchant_advice_message": null,
        "transaction_link_id": null
    }
}


# Request Header Parameters
- access_key: Unique access key provided by Rapyd for each authorized user.
- Content-Type: Indicates that the data appears in JSON format. Set to application/json.
- idempotency: A unique key that prevents the platform from creating the same object twice.
- salt: Random string. Recommended length: 8-16 characters.
- signature: Signature calculated for each request individually.
- timestamp: Timestamp for the request, in Unix time (seconds).


# Request Body Parameters
address: Billing address associated with the payment. For details of fields in the 'address' object, see Create Address.

amount: The amount of the payment, in units of the currency defined in currency. Decimal, including the correct number of decimal places for the currency exponent, as defined in ISO 4217:2015. To verify a card, set to 0.

capture: Determines when the payment is processed for capture. Relevant to card payments.
true - Capture the payment immediately.

false - Authorize the payment, then capture some or all of the payment at a later time, when the merchant runs the Capture Payment method.

Note: Some card payment methods do not support delayed capture. Default value: true

client_details: Describes the browser that the customer is using. The client collects this information and sends it in the request. This information is required for 3DS authentication of the customer for card payments. Rapyd recommends providing all fields, especially ip_address. Visa requires ip_address, screen_height, and screen_width. The Client Details information is not returned in the REST response or in webhooks. See Creating a Card Payment With 3DS Authentication - Rapyd 3DS for additional request parameters that are required for 3DS authentication.

complete_payment_url: URL where the customer is redirected after successfully completing an operation on a hosted page. Does not support localhost URLs.

currency: In transactions without FX, defines the currency of the transaction. Three-letter ISO 4217 code.
    - In FX transactions:
        -- When fixed_side is buy, it is the currency received in the Rapyd wallet.
        -- When fixed_side is sell, it is the currency charged to the buyer.
        (See also fixed_side and requested_currency fields.)

customer: String or object describing the customer. Required if payment_method is blank.
    - string - ID of the customer who is making the payment. String starting with cus_.
    - object - Contains all fields required for the customer. See Create Customer.

description: Description of the payment transaction.

error_payment_url: URL where the customer is redirected if an error occurs during or after an operation on a hosted page. Does not support localhost URLs.

escrow: Determines whether the payment is held in escrow for later release. Default value = false.

escrow_release_days: Determines the number of days after creation of the payment that funds are released from escrow. Funds are released at 5:00 pm GMT on the day indicated. Integer, range: 1-90. default value = 90

ewallet: ID of the wallet that the money is paid into. String starting with ewallet_.Default value =ID of the default client wallet. Relevant when the request includes a single wallet.

ewallets: Specifies the wallets that the money is collected into. If this is left blank, the money goes into the oldest collection-type client wallet. If there is no collection client wallet, the money goes into the oldest general-type client wallet.

expiration: End of the time allowed for the customer to complete this payment, in Unix time. Default is: For card payment methods: 7 days

Note
Relevant to card payments: In some cases, the card networks require a shorter expiration date of the payment. In these cases, the expiration will be updated. Refer to the PAYMENT_COMPLETED webhook to view the updated expiration value. For other payment methods: 2 weeks. Relevant to all payment methods where the is_expirable field is true in the response to List Payment Methods by Country.

fixed_side: Indicates whether the FX rate is fixed for the buy side (seller) or for the sell side (buyer).
    - buy: The currency that the Rapyd Wallet receives for goods or services. Fixed side buy relates to the seller (merchant) funds. For example, a US-based merchant wants to charge 100 USD. The buyer (customer) pays the amount in MXN that converts to 100 USD.
    - sell: The currency that the buyer is charged for purchasing goods or services. Fixed side sell relates to the buyer (customer) funds. For example, a US-based merchant wants to charge a buyer 2,000 MXN and will accept whatever amount in USD that is converted from 2,000 MXN.
    Default = buy


group_payment: ID of the group payment. String starting with gp_. Relevant when the payment is part of a group payment.

initiation_type: Indicates how the transaction was initiated. One of the following:
    customer_present - The transaction was initiated by the customer.
    installment - The transaction was initiated by a subscription where there is a fixed number of installments.
    moto - The transaction was initiated by the merchant or Rapyd client for a mail order or telephone order.

    Note
    To enable moto in the production environment, contact Rapyd Client Support.

    - recurring - The transaction was initiated by a subscription where charges are made at regular intervals and there is no end date.

    - unscheduled - The transaction is a top-up transaction that was previously authorized by the cardholder and was initiated by the merchant or Rapyd client.


metadata

A JSON object defined by the client. See Metadata.

original_payment

(Sandbox only) ID of the original payment. String starting with payment_.

Required when initiation_type is set to an industry-specific Merchant-Initiated Transaction (MIT) value. amount must be less than or equal to the original payment amount.

payment_fees

Defines transaction fees and foreign exchange fees. These are fees that the Rapyd merchant can define for its consumers in addition to the payment amount. They are not related to the fees Rapyd charges to its clients.

payment_method

String (payment_method ID) or object. If not specified in this field, the payment method is the default payment method specified for the customer. Required when there is no default payment method.

payment_method_options

Object describing additional payment method fields required for the payment. These values are not saved as part of the payment method object.

To determine the fields required, run Get Payment Method Required Fields.

receipt_email

Email address that the receipt for this transaction is sent to.

Required for Visa card payments with 3DS authentication. See Creating a Card Payment With 3DS Authentication - Rapyd 3DS for additional request parameters that are required for 3DS authentication.

requested_currency

Currency for one side of an FX transaction. Three-letter ISO 4217 code.

When fixed_side is sell, it is the currency received in the Rapyd Wallet.

When fixed_side is buy, it is the currency charged to the buyer (customer).

Relevant to payments with FX.

See also currency and fixed_side fields.

save_payment_method

Relevant to card payment methods when the request includes full card details. Determines whether Rapyd saves the payment method for future use.

Note
In the sandbox, card details are removed after six months.

true - Save the payment method for future use.

false - Do not save the payment method.

false

statement_descriptor

A text description suitable for a customer's payment statement. 5-22 characters.