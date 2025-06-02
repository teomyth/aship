# Examples

This document provides real-world examples of using Aship for various deployment scenarios.

## Example Projects

### 1. Simple Web Application

A basic web application deployment with environment selection.

**Project Structure:**
```
my-web-app/
├── aship.yml
├── playbooks/
│   └── deploy.yml
└── inventory/
    └── hosts
```

**aship.yml:**
```yaml
name: "Web Application"
description: "Deploy a simple web application"

playbooks:
  deploy: "playbooks/deploy.yml"

vars:
  environment:
    type: choice
    description: "Target environment"
    choices: ["development", "staging", "production"]
    default: "development"
    required: true

  app_version:
    type: string
    description: "Application version to deploy"
    default: "latest"
    required: true

  enable_ssl:
    type: bool
    description: "Enable SSL/HTTPS"
    default: false

tags:
  # Tag definitions with descriptions
  common: "Basic system setup"
  app: "Application deployment"
  nginx: "Nginx configuration"
  ssl: "SSL/TLS setup"

  # Default and groups
  default: ["common", "app"]
  quick: ["app"]
  full: ["common", "app", "nginx", "ssl"]
```

**Usage:**
```bash
# Initialize and deploy
aship init
aship deploy

# Quick deployment (app only)
aship deploy --tags quick

# Full deployment with SSL
aship deploy --tags full
```

### 2. Multi-Service Microservices Platform

Complex deployment with multiple services and dependencies.

**aship.yml:**
```yaml
name: "Microservices Platform"
description: "Deploy microservices with database and monitoring"

playbooks:
  deploy: "playbooks/deploy.yml"
  rollback: "playbooks/rollback.yml"
  scale: "playbooks/scale.yml"

vars:
  environment:
    type: choice
    description: "Deployment environment"
    choices: ["dev", "staging", "prod"]
    required: true
    group: "Environment"

  services:
    type: multiselect
    description: "Services to deploy"
    choices: ["api", "web", "worker", "scheduler", "notifications"]
    default: ["api", "web"]
    required: true
    group: "Services"

  database_migrate:
    type: bool
    description: "Run database migrations"
    default: true
    group: "Database"

  replicas:
    type: number
    description: "Number of replicas per service"
    default: 2
    group: "Scaling"

  monitoring_enabled:
    type: bool
    description: "Enable monitoring stack"
    default: true
    group: "Features"

tags:
  # Tag definitions with descriptions
  common: "Basic system setup and dependencies"
  database: "Database setup and migrations"
  api: "API service deployment"
  web: "Web frontend deployment"
  worker: "Background worker deployment"
  monitoring: "Monitoring and alerting setup"
  nginx: "Load balancer configuration"

  # Default and groups
  default: ["common", "api", "web"]
  minimal: ["common", "api"]
  standard: ["common", "database", "api", "web", "nginx"]
  full: ["common", "database", "api", "web", "worker", "nginx", "monitoring"]
```

**Usage:**
```bash
# Deploy specific services
aship deploy
# Select: environment=prod, services=[api,web], replicas=3

# Rollback deployment
aship rollback

# Scale services
aship scale --extra-vars '{"target_replicas": 5}'
```

### 3. Infrastructure as Code

Managing infrastructure components with Aship.

**aship.yml:**
```yaml
name: "Infrastructure Management"
description: "Manage cloud infrastructure and services"

playbooks:
  provision: "playbooks/provision.yml"
  configure: "playbooks/configure.yml"
  destroy: "playbooks/destroy.yml"

vars:
  cloud_provider:
    type: choice
    description: "Cloud provider"
    choices: ["aws", "gcp", "azure", "digitalocean"]
    required: true
    group: "Infrastructure"

  instance_type:
    type: choice
    description: "Instance type/size"
    choices: ["small", "medium", "large", "xlarge"]
    default: "medium"
    group: "Infrastructure"

  region:
    type: string
    description: "Deployment region"
    default: "us-east-1"
    group: "Infrastructure"

  enable_monitoring:
    type: bool
    description: "Enable infrastructure monitoring"
    default: true
    group: "Features"

  backup_retention:
    type: number
    description: "Backup retention days"
    default: 7
    group: "Backup"

tags:
  # Tag definitions with descriptions
  network: "Network infrastructure setup"
  security: "Security configuration"
  compute: "Compute resources provisioning"
  os: "Operating system configuration"
  services: "Service installation and setup"
  monitoring: "Monitoring infrastructure"
  cleanup: "Resource cleanup"
  backup: "Backup operations"

  # Tag groups
  provision: ["network", "security", "compute"]
  configure: ["os", "services", "monitoring"]
  destroy: ["cleanup", "backup"]
```

### 4. Database Management

Database deployment and maintenance tasks.

**aship.yml:**
```yaml
name: "Database Management"
description: "Deploy and manage database clusters"

playbooks:
  deploy: "playbooks/deploy-db.yml"
  backup: "playbooks/backup.yml"
  restore: "playbooks/restore.yml"
  maintenance: "playbooks/maintenance.yml"

vars:
  db_type:
    type: choice
    description: "Database type"
    choices: ["postgresql", "mysql", "mongodb", "redis"]
    required: true
    group: "Database"

  db_version:
    type: string
    description: "Database version"
    default: "latest"
    group: "Database"

  cluster_size:
    type: number
    description: "Number of database nodes"
    default: 3
    group: "Clustering"

  enable_replication:
    type: bool
    description: "Enable database replication"
    default: true
    group: "Clustering"

  backup_schedule:
    type: choice
    description: "Backup schedule"
    choices: ["hourly", "daily", "weekly"]
    default: "daily"
    group: "Backup"

  admin_password:
    type: password
    description: "Database admin password"
    required: true
    group: "Security"

tags:
  # Tag definitions with descriptions
  packages: "Package installation"
  config: "Configuration setup"
  users: "User management"
  replication: "Database replication setup"
  clustering: "Cluster configuration"
  failover: "Failover configuration"
  backup-config: "Backup configuration"
  schedule: "Backup scheduling"
  firewall: "Firewall configuration"
  ssl: "SSL/TLS setup"

  # Tag groups
  install: ["packages", "config", "users"]
  cluster: ["replication", "clustering", "failover"]
  backup: ["backup-config", "schedule"]
  security: ["firewall", "ssl", "users"]
```

## Common Patterns

### Environment-Specific Deployments

**Pattern 1: Single Config with Environment Variable**
```yaml
vars:
  environment:
    type: choice
    choices: ["dev", "staging", "prod"]
    required: true

  # Environment-specific defaults in playbook
  # - set_fact:
  #     app_port: "{{ 3000 if environment == 'dev' else 8080 }}"
```

**Pattern 2: Multiple Config Files**
```bash
# Different configs for different environments
aship deploy --config aship.dev.yml
aship deploy --config aship.prod.yml
```

### Blue-Green Deployments

```yaml
vars:
  deployment_slot:
    type: choice
    description: "Deployment slot"
    choices: ["blue", "green"]
    required: true

  switch_traffic:
    type: bool
    description: "Switch traffic after deployment"
    default: false

tags:
  # Tag definitions with descriptions
  app: "Application deployment"
  health-check: "Health check operations"
  load-balancer: "Load balancer configuration"
  dns: "DNS configuration"

  # Tag groups
  deploy: ["app", "health-check"]
  switch: ["load-balancer", "dns"]
```

### Rolling Updates

```yaml
vars:
  batch_size:
    type: number
    description: "Number of servers to update at once"
    default: 1

  max_fail_percentage:
    type: number
    description: "Maximum failure percentage"
    default: 0

tags:
  # Tag definitions with descriptions
  backup: "Backup operations"
  health-check: "Health check operations"
  stop-service: "Stop services"
  deploy: "Deploy application"
  start-service: "Start services"
  verify: "Verify deployment"
  cleanup: "Cleanup operations"

  # Tag groups
  pre-update: ["backup", "health-check"]
  update: ["stop-service", "deploy", "start-service"]
  post-update: ["verify", "cleanup"]
```

### Feature Flags

```yaml
vars:
  features:
    type: multiselect
    description: "Features to enable"
    choices: ["auth", "analytics", "caching", "monitoring"]
    default: ["auth"]

  experimental_features:
    type: multiselect
    description: "Experimental features (use with caution)"
    choices: ["new-ui", "beta-api", "advanced-search"]
    default: []
```

## Integration Examples

### CI/CD Pipeline Integration

**GitHub Actions:**
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install Aship
        run: npm install -g aship
      - name: Deploy
        run: |
          aship deploy \
            --skip-vars \
            --yes \
            --extra-vars '{"version":"${{ github.sha }}"}'
        env:
          ANSIBLE_HOST_KEY_CHECKING: False
```

**GitLab CI:**
```yaml
deploy:
  stage: deploy
  image: node:18
  before_script:
    - npm install -g aship
  script:
    - aship deploy --skip-vars --yes --extra-vars '{"version":"'$CI_COMMIT_SHA'"}'
  only:
    - main
```

### Docker Integration

```yaml
# Use Aship in Docker container
FROM node:18-alpine
RUN npm install -g aship ansible
COPY . /app
WORKDIR /app
CMD ["aship", "deploy", "--skip-vars", "--yes"]
```

### Terraform Integration

```yaml
# aship.yml for Terraform-provisioned infrastructure
vars:
  terraform_workspace:
    type: choice
    description: "Terraform workspace"
    choices: ["dev", "staging", "prod"]
    required: true

# Use custom Ansible configuration
ansible:
  configPath: "ansible.cfg"
```

## Best Practices from Examples

### 1. Organize by Environment
- Use clear environment separation
- Environment-specific variable defaults
- Separate inventory files per environment

### 2. Use Descriptive Variable Names
- `database_connection_timeout` instead of `timeout`
- `enable_ssl_certificate` instead of `ssl`
- Group related variables together

### 3. Provide Sensible Defaults
- Safe defaults for production environments
- Development-friendly defaults for dev environments
- Required fields for critical configurations

### 4. Use Tag Groups Effectively
- `quick` for fast deployments
- `full` for complete deployments
- `maintenance` for operational tasks

### 5. Security Considerations
- Use password type for sensitive data
- Don't store passwords in configuration files
- Use Ansible Vault for secrets
- Implement proper SSH key management

These examples demonstrate how Aship can be adapted to various deployment scenarios while maintaining simplicity and consistency.
