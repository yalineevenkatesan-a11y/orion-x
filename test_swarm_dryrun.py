"""
Phase 4 Swarm Orchestrator and AutoGen Auto-Repair Loop Dry-Run Verification.
"""
import sys
import os
import asyncio

# Ensure services is on sys.path
sys.path.insert(0, os.path.abspath("."))

from services.backend.agents.swarm_kernel import swarm_kernel
from services.backend.sandbox.docker_engine import sandbox_manager

async def test_swarm():
    print("=== ORION-X PHASE 4 SWARM SIMULATION VERIFICATION ===")
    
    instruction = "Refactor database queries to use connection pooling & enforce AST type safety"
    workspace_path = os.getcwd()
    target_files = [
        "renderer/src/components/workspace/WorkspaceLayout.tsx",
        "renderer/src/components/workspace/NeuralGraphDashboard.tsx"
    ]

    print(f"\n[STEP 1] Running Swarm Kernel simulation for instruction: '{instruction}'...")
    result = await swarm_kernel.run_swarm_simulation(
        instruction=instruction,
        workspace_path=workspace_path,
        target_files=target_files,
        hub=None,
        vector_service=None,
        max_retries=3
    )

    print(f"\n[STEP 2] Verifying Swarm Result:")
    print(f"Session ID: {result['session_id']}")
    print(f"Status: {result['status']}")
    print(f"Iterations: {result['iterations']}")
    print(f"Affected files: {result['affected_files']}")
    print(f"Blast radius risk level: {result['blast_radius']['risk_level']}")
    print(f"Diff output:\n{result['diff'][:350]}")

    assert result["status"] == "COMPLETED", f"Expected COMPLETED, got {result['status']}"
    assert result["iterations"] >= 1, "Expected at least 1 iteration"
    assert len(result["affected_files"]) > 0, "Expected affected files in diff"

    print("\n[STEP 3] Teardown sandbox session...")
    cleaned = sandbox_manager.teardown_session(result["session_id"])
    print(f"Teardown clean: {cleaned}")

    print("\n>>> ALL PHASE 4 SWARM SIMULATION CHECKS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(test_swarm())
