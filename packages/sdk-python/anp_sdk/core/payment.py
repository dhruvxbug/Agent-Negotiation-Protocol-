import requests
from web3 import Web3
from ..contracts.client import ContractClient


class X402Client:

    def __init__(self, client: ContractClient):
        self.client = client
        self.w3 = client.w3
        self.address = client.address
        self.account = client.account

    def request_service(self, endpoint_url: str, agreed_price_wei: int,
                        timeout: int = 30) -> dict:
        response = requests.get(endpoint_url, timeout=timeout)

        if response.status_code == 402:
            payment_info = response.json()
            print(f"[x402] 402 received. Paying {agreed_price_wei} wei to {payment_info['paymentAddress']}")
            tx_hash = self._send_payment(payment_info["paymentAddress"], agreed_price_wei)
            print(f"[x402] Payment sent: {tx_hash}")
            retry = requests.get(endpoint_url, headers={"X-Payment-Tx": tx_hash}, timeout=timeout)
            if retry.status_code == 200:
                return retry.json()
            raise RuntimeError(f"Service delivery failed after payment: {retry.status_code} {retry.text}")

        if response.status_code == 200:
            return response.json()

        raise RuntimeError(f"Unexpected status: {response.status_code}")

    def _send_payment(self, to: str, amount_wei: int) -> str:
        nonce = self.w3.eth.get_transaction_count(self.address)
        tx = {
            "to": Web3.to_checksum_address(to),
            "value": amount_wei,
            "gas": 21000,
            "gasPrice": self.w3.to_wei("30", "gwei"),
            "nonce": nonce,
            "chainId": self.client.chain_config["chain_id"],
        }
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return tx_hash.hex()


class X402Server:

    def __init__(self, client: ContractClient):
        self.client = client
        self.seller_address = client.address
        self.w3 = client.w3
        self.paid_transactions: set = set()

    def create_app(self, content_getter: callable, price_wei_getter: callable):
        from flask import Flask, request, jsonify
        app = Flask(__name__)

        @app.route("/service", methods=["GET"])
        def serve():
            payment_tx = request.headers.get("X-Payment-Tx")
            price_wei = price_wei_getter()

            if not payment_tx:
                return jsonify({
                    "x402Version": "1.0",
                    "paymentRequired": True,
                    "paymentAddress": self.seller_address,
                    "chain": "avalanche-fuji",
                    "chainId": self.client.chain_config["chain_id"],
                    "currency": "AVAX",
                    "priceWei": str(price_wei),
                }), 402

            if self._verify_payment(payment_tx, price_wei):
                self.paid_transactions.add(payment_tx)
                return jsonify({
                    "status": "delivered",
                    "content": content_getter(),
                    "paymentTx": payment_tx
                }), 200

            return jsonify({"error": "Payment verification failed"}), 402

        @app.route("/health", methods=["GET"])
        def health():
            return jsonify({"status": "ok", "seller": self.seller_address}), 200

        return app

    def _verify_payment(self, tx_hash: str, expected_wei: int) -> bool:
        if tx_hash in self.paid_transactions:
            return False
        try:
            tx = self.w3.eth.get_transaction(tx_hash)
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            return (
                tx["to"].lower() == self.seller_address.lower() and
                tx["value"] >= int(expected_wei * 0.99) and
                receipt["status"] == 1 and
                tx.get("chainId") == self.client.chain_config["chain_id"]
            )
        except Exception as e:
            print(f"[x402] Verification error: {e}")
            return False
