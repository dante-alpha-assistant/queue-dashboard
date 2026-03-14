-- Migration: 0020_apps_custom_domain
-- Adds custom_domain column to apps table for tracking {slug}.dante.id subdomains
-- Task: 86347f29-4b55-4b41-a468-a7c5893b4bf6

-- custom_domain: stores the assigned subdomain, e.g. personal-crm-a7f3.dante.id
ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_domain TEXT;
