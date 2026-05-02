#!/bin/bash
# scripts/init-db.sh
# Runs inside Postgres container on first boot only
# Creates the database if it doesn't exist (pg entrypoint already creates it)
echo "PostgreSQL initialised for ConstructERP"
