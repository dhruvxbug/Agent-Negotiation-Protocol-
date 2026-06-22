import { ContractClient } from "../contracts/client";

export class X402Client {
  private client: ContractClient;

  constructor(client: ContractClient) {
    this.client = client;
  }

  async requestService(
    endpointUrl: string, agreedPriceWei: bigint, timeout = 30000
  ): Promise<any> {
    const response = await fetch(endpointUrl, { signal: AbortSignal.timeout(timeout) });

    if (response.status === 402) {
      const paymentInfo = await response.json() as { paymentAddress: string };
      console.log(`[x402] 402 received. Paying ${agreedPriceWei} wei to ${paymentInfo.paymentAddress}`);

      const txHash = await this.sendPayment(paymentInfo.paymentAddress, agreedPriceWei);
      console.log(`[x402] Payment sent: ${txHash}`);

      const retry = await fetch(endpointUrl, {
        headers: { "X-Payment-Tx": txHash },
        signal: AbortSignal.timeout(timeout),
      });

      if (retry.status === 200) return retry.json();
      throw new Error(`Service delivery failed: ${retry.status}`);
    }

    if (response.status === 200) return response.json();
    throw new Error(`Unexpected status: ${response.status}`);
  }

  private async sendPayment(to: string, amountWei: bigint): Promise<string> {
    const tx = await this.client.wallet.sendTransaction({
      to,
      value: amountWei,
      gasLimit: 21000,
    });
    await tx.wait();
    return tx.hash;
  }
}
