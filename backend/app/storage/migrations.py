import sqlite3

MIGRATIONS = (
    """
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, source_namespace TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision >= 0), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL REFERENCES datasets(id),
    expected_revision INTEGER NOT NULL, committed_revision INTEGER,
    recorded_at TEXT NOT NULL, request_json TEXT NOT NULL,
    preview_json TEXT NOT NULL, additions_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    dataset_id TEXT NOT NULL REFERENCES datasets(id), id TEXT NOT NULL,
    payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL,
    accepted_revision INTEGER NOT NULL, recorded_at TEXT NOT NULL,
    import_id TEXT NOT NULL REFERENCES imports(id), source_row INTEGER NOT NULL,
    PRIMARY KEY (dataset_id, id)
);
CREATE TABLE IF NOT EXISTS runs (
    dataset_id TEXT NOT NULL REFERENCES datasets(id), id TEXT NOT NULL,
    revision INTEGER NOT NULL, recorded_at TEXT NOT NULL,
    event_count INTEGER NOT NULL, analysis_hash TEXT NOT NULL,
    payload_json TEXT NOT NULL, PRIMARY KEY (dataset_id, id)
);
PRAGMA user_version = 1;
    """,
    """
CREATE TABLE event_versions (
    dataset_id TEXT NOT NULL REFERENCES datasets(id), id TEXT NOT NULL,
    payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL,
    accepted_revision INTEGER NOT NULL, recorded_at TEXT NOT NULL,
    import_id TEXT NOT NULL REFERENCES imports(id), source_row INTEGER NOT NULL,
    correction_reason TEXT,
    PRIMARY KEY (dataset_id, id, accepted_revision)
);
INSERT INTO event_versions SELECT *, NULL FROM events;
DROP TABLE events;
ALTER TABLE event_versions RENAME TO events;
ALTER TABLE imports ADD COLUMN correction_reason TEXT;
ALTER TABLE imports ADD COLUMN normalizer_version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX events_revision ON events(dataset_id, accepted_revision);
PRAGMA user_version = 2;
    """,
)


def migrate(connection: sqlite3.Connection) -> None:
    connection.execute("BEGIN IMMEDIATE")
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    if version not in range(len(MIGRATIONS) + 1):
        raise ValueError("This history database requires a different RiskFlow version.")
    for script in MIGRATIONS[version:]:
        for statement in script.split(";"):
            if statement.strip():
                connection.execute(statement)
