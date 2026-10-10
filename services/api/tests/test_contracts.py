from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

import pytest

from generate_contracts import render_contracts  # noqa: E402


def test_generated_typescript_contracts_match_pydantic_models() -> None:
    expected = render_contracts()
    target = ROOT / "packages/types/src/generated.ts"
    assert target.read_text(encoding="utf-8") == expected, f"Regenerate stale contract: {target}"
    sibling = ROOT.parent / "shaktios-app/src/types/contracts.ts"
    if not sibling.exists():
        # CI checks out only this repo; the sibling Expo copy is verified
        # in local two-checkout development via scripts/generate_contracts.py --mobile.
        pytest.skip(f"Sibling checkout absent: {sibling}")
    assert sibling.read_text(encoding="utf-8") == expected, f"Regenerate stale contract: {sibling}"
