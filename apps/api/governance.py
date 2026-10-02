"""
Governance, versioning, publish/rollback, and cryptographic audit log.
"""

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

GOVERNANCE_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "governance"))
os.makedirs(GOVERNANCE_DATA_DIR, exist_ok=True)


class AuditEntry(BaseModel):
    id: str
    timestamp: str
    author: str
    action: str  # "PUBLISH", "ROLLBACK", "RULE_CREATE", "RULE_UPDATE", "RULE_DELETE", "SIMULATION"
    domain_id: str
    version: str
    details: Dict[str, Any] = Field(default_factory=dict)
    prev_hash: str
    entry_hash: str


class VersionRecord(BaseModel):
    version: str
    domain_id: str
    status: str  # "published", "draft", "archived"
    created_at: str
    published_at: Optional[str] = None
    author: str
    rules_count: int
    strategy_snapshot: Dict[str, Any]


class GovernanceStore:
    def __init__(self, data_dir: str = GOVERNANCE_DATA_DIR):
        self.data_dir = data_dir
        self.audit_file = os.path.join(self.data_dir, "audit_chain.json")
        self.versions_file = os.path.join(self.data_dir, "versions.json")
        self._init_storage()

    def _init_storage(self):
        if not os.path.exists(self.audit_file):
            with open(self.audit_file, "w", encoding="utf-8") as f:
                json.dump([], f)
        if not os.path.exists(self.versions_file):
            with open(self.versions_file, "w", encoding="utf-8") as f:
                json.dump({}, f)

    def get_audit_trail(self, domain_id: Optional[str] = None) -> List[AuditEntry]:
        with open(self.audit_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        entries = [AuditEntry(**d) for d in data]
        if domain_id:
            entries = [e for e in entries if e.domain_id == domain_id]
        return entries

    def verify_audit_chain(self) -> Dict[str, Any]:
        """Verifies cryptographic integrity of the audit chain."""
        with open(self.audit_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if not data:
            return {"valid": True, "entries_checked": 0, "status": "empty"}

        prev_hash = "GENESIS_HASH_000000000000000000000000000000000000000000000000000000"
        for i, item in enumerate(data):
            expected_payload = f"{item['prev_hash']}:{item['timestamp']}:{item['action']}:{item['domain_id']}:{item['version']}"
            computed_hash = hashlib.sha256(expected_payload.encode("utf-8")).hexdigest()
            if item["prev_hash"] != prev_hash or item["entry_hash"] != computed_hash:
                return {
                    "valid": False,
                    "tampered_index": i,
                    "entry_id": item["id"],
                    "status": "TAMPER_DETECTED"
                }
            prev_hash = item["entry_hash"]

        return {"valid": True, "entries_checked": len(data), "status": "VERIFIED_SECURE"}

    def add_audit_entry(
        self,
        author: str,
        action: str,
        domain_id: str,
        version: str,
        details: Dict[str, Any]
    ) -> AuditEntry:
        with open(self.audit_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        prev_hash = raw_data[-1]["entry_hash"] if raw_data else "GENESIS_HASH_000000000000000000000000000000000000000000000000000000"
        now_iso = datetime.now(timezone.utc).isoformat()
        entry_id = f"aud_{int(time.time() * 1000)}"

        payload_to_hash = f"{prev_hash}:{now_iso}:{action}:{domain_id}:{version}"
        entry_hash = hashlib.sha256(payload_to_hash.encode("utf-8")).hexdigest()

        entry = AuditEntry(
            id=entry_id,
            timestamp=now_iso,
            author=author,
            action=action,
            domain_id=domain_id,
            version=version,
            details=details,
            prev_hash=prev_hash,
            entry_hash=entry_hash
        )

        raw_data.append(entry.model_dump())
        with open(self.audit_file, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, indent=2)

        return entry

    def get_versions(self, domain_id: str) -> List[VersionRecord]:
        with open(self.versions_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        domain_versions = data.get(domain_id, [])
        return [VersionRecord(**v) for v in domain_versions]

    def record_version(
        self,
        domain_id: str,
        version: str,
        status: str,
        author: str,
        strategy_snapshot: Dict[str, Any]
    ) -> VersionRecord:
        with open(self.versions_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        if domain_id not in data:
            data[domain_id] = []

        now_iso = datetime.now(timezone.utc).isoformat()

        # If publishing, mark prior published versions as archived
        if status == "published":
            for v in data[domain_id]:
                if v["status"] == "published":
                    v["status"] = "archived"

        record = VersionRecord(
            version=version,
            domain_id=domain_id,
            status=status,
            created_at=now_iso,
            published_at=now_iso if status == "published" else None,
            author=author,
            rules_count=len(strategy_snapshot.get("rules", [])),
            strategy_snapshot=strategy_snapshot
        )

        data[domain_id].append(record.model_dump())
        with open(self.versions_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        return record


governance_store = GovernanceStore()
