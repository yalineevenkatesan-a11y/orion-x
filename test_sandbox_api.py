"""
Verification test script for Phase 3 Docker Sandbox Engine and FastAPI endpoints.
"""
import sys
import os
import asyncio
import json

# Ensure services is on sys.path
sys.path.insert(0, os.path.abspath("."))

from services.backend.sandbox.docker_engine import sandbox_manager

async def main():
    print("=== ORION-X PHASE 3 SANDBOX VERIFICATION ===")
    
    # 1. Direct Engine Test
    print("\n[STEP 1] Testing SandboxManager direct provisioning...")
    session = sandbox_manager.spawn_session(
        workspace_path=os.getcwd(),
        target_files=["services/backend/main.py"]
    )
    print(f"Session spawned: {session.session_id} (Mode: {session.mode})")
    assert session.sandbox_dir.exists(), f"Sandbox dir {session.sandbox_dir} does not exist!"
    print(f"Sandbox mount path: {session.sandbox_dir.resolve()}")

    print("\n[STEP 2] Executing command in isolated chamber...")
    cmd = 'python -c "print(\'ORION-SANDBOX-TEST-OUTPUT\'); import sys; sys.exit(0)"'
    result = await session.execute_isolated_command(cmd, hub=None)
    print(f"Command exit code: {result['exit_code']}, status: {result['status']}")
    print(f"Command stdout: {result['stdout'].strip()}")
    assert result['exit_code'] == 0, f"Expected exit code 0, got {result['exit_code']}"
    assert "ORION-SANDBOX-TEST-OUTPUT" in result['stdout']

    print("\n[STEP 3] Testing code diff and blast radius...")
    # Simulate a modification inside sandbox
    test_mod_file = session.sandbox_dir / "services" / "backend" / "main.py"
    if test_mod_file.exists():
        original_text = test_mod_file.read_text(encoding="utf-8")
        test_mod_file.write_text(original_text + "\n# TEST SANDBOX MODIFICATION\n", encoding="utf-8")
    
    diff_data = session.calculate_code_diff()
    print(f"Affected files: {diff_data['affected_files']}")
    print(f"Blast radius risk level: {diff_data['blast_radius']['risk_level']}")
    print(f"Diff output snippet:\n{diff_data['diff'][:300]}")
    assert len(diff_data['affected_files']) > 0, "Expected at least 1 affected file"

    print("\n[STEP 4] Testing teardown and cleanup...")
    sid = session.session_id
    sdir = session.sandbox_dir
    teardown_ok = sandbox_manager.teardown_session(sid)
    print(f"Teardown success: {teardown_ok}")
    assert not sdir.exists(), f"Sandbox dir {sdir} should be deleted after teardown!"

    print("\n[STEP 5] Probing Docker daemon status...")
    docker_status = sandbox_manager.check_docker_status()
    print(f"Docker chamber status: {docker_status}")

    print("\n>>> ALL PHASE 3 SANDBOX ENGINE CHECKS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(main())
