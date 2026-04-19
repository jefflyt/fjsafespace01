"""
scripts/run_qa_audit.py

Runs all 9 QA gate checks against a specific upload_id and outputs a pass/fail summary.

Usage:
    python scripts/run_qa_audit.py --upload-id <UPLOAD_UUID>
    python scripts/run_qa_audit.py --upload-id abc-123 --database-url postgresql://dev:dev@localhost:5432/fjsafespace

Requires: DATABASE_URL set in environment (or passed via --database-url).
          The upload must have at least one report generated against it.
"""

import argparse
import json
import os
import sys

# Ensure backend is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))


def run_audit(upload_id: str, database_url: str) -> None:
    from sqlmodel import Session, create_engine
    from app.models.workflow_b import Finding, Report

    engine = create_engine(database_url, pool_pre_ping=True)

    with Session(engine) as session:
        # Find reports associated with this upload
        reports = session.exec(
            Report.__class__.where(Report.upload_id == upload_id)  # type: ignore[arg-type]
        ).all()

        if not reports:
            print(f"[ERROR] No reports found for upload_id={upload_id}")
            sys.exit(1)

        report = reports[0]  # Use the first report
        findings = session.exec(
            Finding.__class__.where(Finding.upload_id == upload_id)  # type: ignore[arg-type]
        ).all()

        print(f"QA Audit for upload_id={upload_id}")
        print(f"Report: {report.id} (type={report.report_type}, status={report.reviewer_status})")
        print(f"Findings: {len(findings)}")
        print("=" * 60)

        # Import QA gate evaluators
        from app.services.qa_gates import (
            GATE_EVALUATORS,
            QA_GATE_ORDER,
        )

        passed_count = 0
        failed_count = 0

        for gate_id in QA_GATE_ORDER:
            evaluator = GATE_EVALUATORS[gate_id]
            if gate_id in ("QA-G1", "QA-G5"):
                result = evaluator(report, findings)
            elif gate_id in ("QA-G2", "QA-G6"):
                result = evaluator(findings)
            else:
                result = evaluator(report)

            status = "PASS" if result.passed else "FAIL"
            if result.passed:
                passed_count += 1
            else:
                failed_count += 1

            icon = "[PASS]" if result.passed else "[FAIL]"
            print(f"  {icon} {gate_id}: {result.message}")

        print("=" * 60)
        print(f"Results: {passed_count} passed, {failed_count} failed, {len(QA_GATE_ORDER)} total")

        if failed_count == 0:
            print("OVERALL: ALL QA GATES PASSED")
        else:
            print("OVERALL: QA GATES FAILED — report cannot be approved")


def main():
    parser = argparse.ArgumentParser(description="Run QA audit against an upload")
    parser.add_argument("--upload-id", required=True, help="Upload UUID to audit")
    parser.add_argument("--database-url", default=None, help="Database URL (defaults to DATABASE_URL env var)")
    args = parser.parse_args()

    database_url = args.database_url or os.environ.get("DATABASE_URL")
    if not database_url:
        print("[ERROR] DATABASE_URL not set. Use --database-url or set the environment variable.")
        sys.exit(1)

    run_audit(args.upload_id, database_url)


if __name__ == "__main__":
    main()
