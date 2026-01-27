# # # Moving Funds Between Wallets # # # 
Send money within Rapyd’s ecosystem. | Enterprise

The Rapyd platform makes it simple for your customers to transfer money from their own Rapyd Wallet to the wallet of another customer. Common use cases may include:

A customer wants to transfer funds to a another customer's wallet.

A seller on a marketplace chooses to transfer funds to another seller's wallet.

A company wallet transfers funds to an employee's wallet for a faster transaction than disburse.

For example, one customer on your platform wants to move funds to another customer on your platform.

Customer 1 provides you with customer 2’s identifying information, the amount and currency to transfer. Your ERP system asks Rapyd to transfer the money to customer 2. When the transfer is initiated, your ERP asks customer 2 to accept the transfer. Rapyd completes the transfer, and your ERP notifies both customers that the money was transferred.

# Note
Why transfer funds between Rapyd Wallets instead of Disburse? Speed, Simplicity and Costs. Creating a wallet ecosystem allows you to more seamlessly pay your workers, speeds processing time and avoids costly transaction fees from third parties.

# Initiating Transfer to Another Wallet
When the customer asks to transfer funds to the customer's wallet, you ask Rapyd to initiate the transfer process. This is the first step in a two-step process.

For that, you'll use Transfer Funds Between Wallets with the following parameters:
Description of Parameters


# Body Parameter & Description

amount = Enter 100 (or other amount) as the amount to transfer from the customer's wallet.

currency = Enter "ILS" as the currency code for Israeli Shekels.

source_ewallet = Enter the ID (ewallet....) from the sender's ewallet coulmn in the db (users table). 

destination_ewallet = Enter the ID (ewallet....) from the reciever's ewallet coulmn in the db (users table). 


# Transfer Funds Between Wallets Request example
You ask Rapyd to transfer the money to customer 2's wallet.

*Request:*
const makeRequest = require('<path-to-your-utility-file>/utilities').makeRequest;

async function main() {
  try {
    const body = {
      source_ewallet: 'ewallet_56a273c10570528c608f2c6bcdc8ea41',
      destination_ewallet: 'ewallet_43b888d4c038a219c52f45e754139f74',
      amount: 50,
      currency: 'ILS'
    };
    const result = await makeRequest('POST', '/v1/ewallets/transfer', body);
    console.log(result);
  } catch (error) {
    console.error('Error completing request', error);
  }
}


*Response:*
{
    "status": {
        "error_code": "",
        "status": "SUCCESS",
        "message": "",
        "response_code": "",
        "operation_id": "1e6a07d6-7b06-4d6b-88b6-552fd4c2ec60"
    },
    "data": {
        "id": "af468df8-6f4e-11ea-833c-02e199f7f6f5",
        "status": "PEN",
        "amount": 100,
        "currency_code": "ILS",
        "transfer_response_at": 0,
        "created_at": 1585219432,
         
//   ...
          
    }
}


## Completing the Transfer!

When customer 2 indicates that she accepts the transfer, you ask Rapyd to complete the transaction.

For that, you'll use @supabase\rapydDocs\Set_Transfer_Response.md with the following parameters:

#Description of Parameters

id = Enter the transfer transaction 'id' that you received when you created the transfer transaction. For purposes of this use case lesson, we are using af468df8-6f4e-11ea-833c-02e199f7f6f5, which is the transfer transaction ID in our example.

status = Enter "accept" to indicate that customer 2 accepts the transfer.


# Set Transfer Response Request
You ask Rapyd to complete the transfer of $100.00 from the customer's wallet to customer 2's wallet.

const makeRequest = require('<path-to-your-utility-file>/utilities').makeRequest;

async function main() {
  try {
    const body = {
      id: 'af468df8-6f4e-11ea-833c-02e199f7f6f5',
      status: 'accept'
    };
    const result = await makeRequest('POST', '/v1/ewallets/transfer/response', body);
    console.log(result);
  } catch (error) {
    console.error('Error completing request', error);
  }
}

Response

{
    "status": {
        "error_code": "",
        "status": "SUCCESS",
        "message": "",
        "response_code": "",
        "operation_id": "4b8e014f-38ff-48dc-812b-547bd1f65874"
    },
    "data": {
        "id": "af468df8-6f4e-11ea-833c-02e199f7f6f5",
        "status": "CLO",
        "amount": 100,
        "currency_code": "USD",
        "destination_phone_number": null,
        "transfer_response_at": 1585219599,
        "created_at": 1585219432,
         
//   ...
          
    }
}
The data section of this response shows that the status is now CLO (closed). This indicates that the money has been transferred to customer 2's wallet.

Your website notifies both wallet contacts that the transfer is complete.