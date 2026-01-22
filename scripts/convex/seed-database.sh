#!/bin/bash
# Seed Convex database with initial data
# Run from project root

set -e

echo "Seeding Convex database..."
npx convex run seed:runAll
echo "Database seeded successfully!"
