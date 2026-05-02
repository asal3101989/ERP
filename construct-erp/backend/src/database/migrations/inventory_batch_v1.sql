-- Database Migration: Phase 8 - Inventory Batch Tracking
-- Location: backend/src/database/migrations/inventory_batch_v1.sql

-- 1. Create Inventory Batches Table
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE,
    received_date DATE DEFAULT CURRENT_DATE,
    opening_quantity NUMERIC(15,3) NOT NULL,
    current_quantity NUMERIC(15,3) NOT NULL,
    grn_id UUID REFERENCES grn(id),
    status VARCHAR(20) DEFAULT 'active', -- active, consumed, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE
);

-- 2. Add Index for FIFO performance (received_date, then batch_number)
CREATE INDEX IF NOT EXISTS idx_inventory_batches_fifo ON inventory_batches(inventory_id, received_date ASC, created_at ASC) WHERE status = 'active';

-- 3. Add Index for Expiry Tracking
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(expiry_date) WHERE expiry_date IS NOT NULL;

-- 4. Audit Log for Batch Movements
CREATE TABLE IF NOT EXISTS batch_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES inventory_batches(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- issue, transfer, adjustment
    quantity NUMERIC(15,3) NOT NULL,
    reference_id UUID, -- reference to stock_transactions.id
    transacted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE
);
