import os
import requests
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

FUJI_RPC = os.getenv("FUJI_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")


class X402Client:
    """Buyer-side x402 client."""

    def __init__(self, private_key: str):
        self.w3 = Web3(Web3.HTTPProvider(FUJI_RPC))
        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

    def request_service(self, endpoint_url: str, agreed_price_wei: int) -> dict:
        print(f"[x402] Requesting {endpoint_url}")

        response = requests.get(endpoint_url, timeout=10)

        if response.status_code == 402:
            payment_info = response.json()
            print(f"[x402] Payment required: {payment_info}")

            tx_hash = self._send_payment(
                to=payment_info["paymentAddress"],
                amount_wei=agreed_price_wei
            )
            print(f"[x402] Payment sent: {tx_hash}")

            retry = requests.get(
                endpoint_url,
                headers={"X-Payment-Tx": tx_hash},
                timeout=10
            )

            if retry.status_code == 200:
                print(f"[x402] Service received!")
                return retry.json()
            else:
                raise RuntimeError(f"Service delivery failed after payment: {retry.status_code}")

        elif response.status_code == 200:
            return response.json()
        else:
            raise RuntimeError(f"Unexpected response: {response.status_code}")

    def _send_payment(self, to: str, amount_wei: int) -> str:
        nonce = self.w3.eth.get_transaction_count(self.address)
        tx = {
            "to": Web3.to_checksum_address(to),
            "value": amount_wei,
            "gas": 21000,
            "gasPrice": self.w3.to_wei("30", "gwei"),
            "nonce": nonce,
            "chainId": 43113,
        }
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return tx_hash.hex()


class X402Server:
    """Seller-side x402 server."""

    def __init__(self, seller_address: str, w3: Web3):
        self.seller_address = seller_address
        self.w3 = w3
        self.paid_transactions = set()

    def create_flask_app(self, service_content: dict, price_wei: int):
        from flask import Flask, request, jsonify

        app = Flask(__name__)

        @app.route("/service", methods=["GET"])
        def serve():
            payment_tx = request.headers.get("X-Payment-Tx")

            if not payment_tx:
                return jsonify({
                    "x402Version": "1.0",
                    "paymentRequired": True,
                    "paymentAddress": self.seller_address,
                    "chain": "avalanche-fuji",
                    "chainId": 43113,
                    "currency": "AVAX",
                    "memo": "x402 service payment"
                }), 402

            if self._verify_payment(payment_tx, price_wei):
                self.paid_transactions.add(payment_tx)
                return jsonify({
                    "status": "delivered",
                    "content": service_content,
                    "paymentTx": payment_tx
                }), 200
            else:
                return jsonify({"error": "Payment verification failed"}), 402

        return app

    def _verify_payment(self, tx_hash: str, expected_wei: int) -> bool:
        if tx_hash in self.paid_transactions:
            return False

        try:
            tx = self.w3.eth.get_transaction(tx_hash)
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)

            is_to_seller = tx["to"].lower() == self.seller_address.lower()
            is_sufficient = tx["value"] >= int(expected_wei * 0.99)
            is_confirmed = receipt["status"] == 1
            is_on_fuji = tx["chainId"] == 43113

            return is_to_seller and is_sufficient and is_confirmed and is_on_fuji
        except Exception as e:
            print(f"[x402] Payment verification error: {e}")
            return False
