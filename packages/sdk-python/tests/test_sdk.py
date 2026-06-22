"""
Phase 6 — Python SDK tests.
Mocks ContractClient and tests the AgentSDK public API.
"""
import os
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ["FUJI_RPC_URL"] = "https://api.avax-test.network/ext/bc/C/rpc"
os.environ["AGENT_REGISTRY_ADDRESS"] = "0x0000000000000000000000000000000000000001"
os.environ["NEGOTIATION_ENGINE_ADDRESS"] = "0x0000000000000000000000000000000000000002"
os.environ["SKILL_REGISTRY_ADDRESS"] = "0x0000000000000000000000000000000000000003"
os.environ["ANTHROPIC_API_KEY"] = "sk-test"
os.environ["LLM_PROVIDER"] = "anthropic"


@pytest.fixture
def mock_contract_client():
    """Fixture that patches ContractClient with mock web3 behavior."""
    with patch("anp_sdk.contracts.client.ContractClient") as MockClient:
        instance = MockClient.return_value

        # Mock AgentRegistry
        instance.register_agent = AsyncMock()
        instance.register_agent.return_value = None

        instance.get_agent = AsyncMock()
        instance.get_agent.return_value = {
            "name": "TestAgent",
            "serviceNiche": "data-analysis",
            "reputationScore": 7500,
            "dealsCompleted": 5,
            "totalEarnedWei": 100000000000000000,
        }

        instance.get_total_agents = AsyncMock()
        instance.get_total_agents.return_value = 2

        instance.agent_index = AsyncMock()
        instance.agent_index.side_effect = lambda i: [
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
        ][i]

        # Mock NegotiationEngine
        instance.open_session = AsyncMock()
        instance.open_session.return_value = (
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        )

        instance.get_session = AsyncMock()
        instance.get_session.return_value = {
            "buyer": "0xbuyer",
            "seller": "0xseller",
            "serviceDescription": "test",
            "currentRound": 3,
            "maxRounds": 5,
            "agreedPrice": 50000000000000000,
            "status": 2,
            "buyerOffers": [60000000000000000, 55000000000000000, 50000000000000000],
            "sellerOffers": [80000000000000000, 70000000000000000, 55000000000000000],
        }

        # Mock SkillRegistry
        instance.attest_skill = AsyncMock()
        instance.get_agent_skills = AsyncMock()
        instance.get_agent_skills.return_value = [0, 1, 2, 3, 4]
        instance.is_fully_capable = AsyncMock()
        instance.is_fully_capable.return_value = True

        yield instance


@pytest.fixture
def sdk(mock_contract_client):
    from anp_sdk import AgentSDK

    return AgentSDK(
        private_key="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        chain="fuji",
    )


class TestAgentSDK:
    """Tests for the AgentSDK public API."""

    @pytest.mark.asyncio
    async def test_setup_registers_agent(self, sdk, mock_contract_client):
        name = "TestAgent"
        niche = "data-analysis"
        sdk.setup(name=name, niche=niche, framework="raw")
        mock_contract_client.register_agent.assert_awaited_once_with(name, niche)

    @pytest.mark.asyncio
    async def test_reputation_returns_float(self, sdk, mock_contract_client):
        rep = sdk.reputation()
        assert isinstance(rep, float)
        assert rep == 7.5

    @pytest.mark.asyncio
    async def test_hire_returns_agreement(self, sdk, mock_contract_client):
        result = sdk.hire(
            service="Analyze DeFi protocols",
            niche="data-analysis",
            max_price_usdc=100.0,
            min_reputation=5.0,
        )
        assert "agreedPriceUsdc" in result
        assert "content" in result

    @pytest.mark.asyncio
    async def test_list_as_seller_starts_server(self, sdk, mock_contract_client):
        with patch("anp_sdk.sdk.X402Server") as MockServer:
            instance = MockServer.return_value
            instance.serve = MagicMock()

            sdk.list_as_seller(
                service_content={"test": "data"},
                floor_price_usdc=40.0,
                port=5001,
            )

            instance.serve.assert_called_once()

    @pytest.mark.asyncio
    async def test_setup_attests_all_skills(self, sdk, mock_contract_client):
        sdk._attest_all_skills = MagicMock()
        sdk.setup(name="TestAgent", niche="data-analysis", framework="raw")
        sdk._attest_all_skills.assert_called_once()

    def test_sdk_address_property(self, sdk):
        assert sdk.address.startswith("0x")
        assert len(sdk.address) == 42

    @pytest.mark.asyncio
    async def test_hire_no_matching_agents(self, sdk, mock_contract_client):
        mock_contract_client.get_total_agents.return_value = 0
        result = sdk.hire(
            service="test",
            niche="data-analysis",
            max_price_usdc=100.0,
            min_reputation=5.0,
        )
        assert result["agreedPriceUsdc"] == 0
        assert "error" in result or "content" in result


class TestContractClient:
    """Tests for the ContractClient class."""

    def test_contract_client_initialization(self):
        from anp_sdk.contracts.client import ContractClient

        with patch("anp_sdk.contracts.client.Web3") as MockWeb3:
            client = ContractClient(
                rpc_url="https://api.avax-test.network/ext/bc/C/rpc",
                registry_address="0x0000000000000000000000000000000000000001",
                engine_address="0x0000000000000000000000000000000000000002",
                skill_address="0x0000000000000000000000000000000000000003",
                private_key="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            )
            assert client is not None
            MockWeb3.assert_called_once()


class TestStrategyEngine:
    """Tests for the Strategy Engine (mock LLM)."""

    @pytest.mark.asyncio
    async def test_generate_bid_within_budget(self):
        from anp_sdk.core.strategy import StrategyEngine

        engine = StrategyEngine(provider="anthropic", api_key="sk-test")

        with patch.object(engine, "llm_client") as mock_llm:
            mock_response = MagicMock()
            mock_response.content = [MagicMock(text='{"bid": 55.0, "rationale": "test"}')]
            mock_llm.messages.create.return_value = mock_response

            bid = await engine.generate_bid(
                rounds_elapsed=2,
                max_rounds=5,
                my_last_price=None,
                their_last_price=80.0,
                budget_cap=100.0,
                strategy="linear_concession",
            )
            assert isinstance(bid, float)
            assert 0 < bid <= 100.0


class TestX402Client:
    """Tests for the x402 payment client."""

    @pytest.mark.asyncio
    async def test_send_payment(self):
        from anp_sdk.core.payment import X402Client

        client = X402Client(private_key="0x" + "ab" * 32, rpc_url="https://api.avax-test.network/ext/bc/C/rpc")

        with patch.object(client, "web3") as mock_web3:
            mock_web3.eth.send_transaction = MagicMock()
            mock_web3.eth.send_transaction.return_value = b"\x01" * 32
            mock_web3.eth.wait_for_transaction_receipt = MagicMock()

            tx_hash = await client.send_payment(
                to_address="0x0000000000000000000000000000000000000001",
                amount_wei=50000000000000000,
            )
            assert tx_hash is not None
