#!/bin/bash

# Thmanyah CMS Environment Setup Script
set -e

echo "Setting up Thmanyah CMS environment..."

# Function to generate random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Function to generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-50
}

# Detect environment
if [ "$1" = "production" ]; then
    ENV_FILE="env.prod"
    TEMPLATE_FILE="env.prod.template"
    echo "Setting up for PRODUCTION environment"
else
    ENV_FILE="env.dev" 
    TEMPLATE_FILE="env.dev.template"
    echo "Setting up for DEVELOPMENT environment"
fi

# Check if .env already exists
if [ -f ".env" ]; then
    echo "WARNING: .env file already exists. Backing up to .env.backup"
    cp .env .env.backup
fi

# Copy the appropriate template
echo "Copying $TEMPLATE_FILE to $ENV_FILE"
cp "$TEMPLATE_FILE" "$ENV_FILE"

# For production, replace placeholder values
if [ "$1" = "production" ]; then
    echo "Generating secure passwords and secrets..."
    
    DB_PASSWORD=$(generate_password)
    JWT_SECRET=$(generate_jwt_secret)
    REDIS_PASSWORD=$(generate_password)
    
    # Replace placeholders with actual values
    sed -i.bak "s/CHANGE_THIS_SECURE_PASSWORD/$DB_PASSWORD/g" "$ENV_FILE"
    sed -i.bak "s/CHANGE_THIS_TO_SECURE_RANDOM_STRING/$JWT_SECRET/g" "$ENV_FILE"
    sed -i.bak "s/CHANGE_THIS_REDIS_PASSWORD/$REDIS_PASSWORD/g" "$ENV_FILE"
    
    # Clean up backup file
    rm "$ENV_FILE.bak"
    
    echo "Production credentials generated!"
    echo "Database password: $DB_PASSWORD"
    echo "JWT Secret: $JWT_SECRET"
    echo "Redis password: $REDIS_PASSWORD"
    echo ""
    echo "IMPORTANT: Save these credentials securely!"
    echo "Consider using a proper secrets management system for production."
fi

echo ""
echo "Environment configuration:"
echo "  Source: $TEMPLATE_FILE"
echo "  Target: .env"
echo ""

# Create necessary directories
echo "Creating required directories..."
mkdir -p backups
mkdir -p cms/uploads
mkdir -p ssl

# Set proper permissions
chmod 755 backups cms/uploads ssl
chmod 600 "$ENV_FILE"

echo "Environment setup complete!"
echo ""
echo "To start the platform:"
echo "  Development: docker-compose up"
echo "  Production:  docker-compose --profile production up"
echo ""
echo "Useful commands:"
echo "  View logs:      docker-compose logs -f"
echo "  Database shell: docker-compose exec postgres psql -U postgres -d thmanyah_cms"
echo "  Redis CLI:      docker-compose exec redis redis-cli"
echo ""
echo "Service URLs (when running):"
echo "  CMS Admin:      http://localhost:3000"
echo "  Discovery API:  http://localhost:3001"
echo "  pgAdmin:        http://localhost:8080"
echo "  Redis UI:       http://localhost:8081" 