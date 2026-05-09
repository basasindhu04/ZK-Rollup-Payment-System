-- Migration: Create initial tables for ZK Rollup Payment System

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: payment_intents
CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount_wei NUMERIC(78,0) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    batch_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: batches
CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    batch_index INTEGER UNIQUE,
    old_state_root VARCHAR(66),
    new_state_root VARCHAR(66) NOT NULL,
    batch_hash VARCHAR(66) NOT NULL,
    tx_count INTEGER NOT NULL,
    relayer_address VARCHAR(42) NOT NULL,
    committed_at TIMESTAMPTZ,
    tx_hash VARCHAR(66),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: deposits
CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    amount_wei NUMERIC(78,0) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    block_number INTEGER NOT NULL,
    indexed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_intents_from_address ON payment_intents(from_address);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_deposits_user_address ON deposits(user_address);
CREATE INDEX IF NOT EXISTS idx_batches_batch_index ON batches(batch_index);
