import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent.parent / ".env")

CHAIN_CONFIGS = {
    "fuji": {
        "rpc_url": os.getenv("FUJI_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc"),
        "chain_id": 43113,
        "name": "Avalanche Fuji",
        "explorer": "https://testnet.snowtrace.io",
        "contracts": {
            "AgentRegistry": os.getenv("AGENT_REGISTRY_ADDRESS", ""),
            "NegotiationEngine": os.getenv("NEGOTIATION_ENGINE_ADDRESS", ""),
            "SkillRegistry": os.getenv("SKILL_REGISTRY_ADDRESS", ""),
        }
    },
    "hardhat": {
        "rpc_url": "http://127.0.0.1:8545",
        "chain_id": 31337,
        "name": "Hardhat Local",
        "explorer": "",
        "contracts": {
            "AgentRegistry": os.getenv("LOCAL_AGENT_REGISTRY", ""),
            "NegotiationEngine": os.getenv("LOCAL_NEGOTIATION_ENGINE", ""),
            "SkillRegistry": os.getenv("LOCAL_SKILL_REGISTRY", ""),
        }
    }
}

DEFAULT_CHAIN = os.getenv("DEFAULT_CHAIN", "fuji")

_ABI_DIR = Path(__file__).parent / "contracts" / "abis"

def load_abi(contract_name: str) -> list:
    abi_path = _ABI_DIR / f"{contract_name}.json"
    with open(abi_path) as f:
        return json.load(f)

SDK_VERSION = "anp-sdk@0.1.0"

NEGOTIATION_DEFAULTS = {
    "max_rounds": int(os.getenv("MAX_NEGOTIATION_ROUNDS", "5")),
    "poll_interval": int(os.getenv("POLL_INTERVAL_SECONDS", "8")),
    "duration_seconds": 600,
}

LLM_CONFIG = {
    "model": "claude-sonnet-4-6",
    "max_tokens": 256,
    "api_key": os.getenv("ANTHROPIC_API_KEY", ""),
}
