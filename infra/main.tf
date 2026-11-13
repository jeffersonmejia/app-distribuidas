data "azurerm_resource_group" "app" {
  name = var.resource_group_name
}

module "registry" {
  source = "./modules/container_registry"

  name                        = "appdist${var.resource_suffix}"
  resource_group_name         = data.azurerm_resource_group.app.name
  location                    = "Brazil South"
  github_actions_principal_id = var.github_actions_principal_id
  tags                        = local.common_tags
}

module "postgres" {
  source = "./modules/postgres"

  name                          = "pg-appdist-${var.environment}-${var.resource_suffix}"
  resource_group_name           = data.azurerm_resource_group.app.name
  location                      = var.postgres_region
  sku_name                      = var.postgres_sku
  storage_mb                    = var.postgres_storage_mb
  backup_retention_days         = var.postgres_backup_days
  database_name                 = var.postgres_database_name
  administrator_login           = var.postgres_admin_username
  administrator_password        = var.postgres_admin_password
  allow_azure_services          = var.enable_backend && var.allow_azure_services_postgres
  tags                          = local.common_tags
}

module "application" {
  source = "./modules/application_aci"

  name                  = "aci-appdist-${var.environment}"
  dns_name_label        = "appdist-${var.environment}-${var.resource_suffix}"
  resource_group_name   = data.azurerm_resource_group.app.name
  location              = "Brazil South"
  frontend_image        = "${module.registry.login_server}/frontend:${var.frontend_image_tag}"
  backend_image         = "${module.registry.login_server}/backend:${var.backend_image_tag}"
  registry_id           = module.registry.id
  registry_login_server = module.registry.login_server
  enable_backend        = var.enable_backend
  backend_environment = {
    AUTH_ISSUER_URI     = var.auth_issuer_uri
    AUTH_AUDIENCE       = var.auth_audience
    DB_RUNTIME_URL      = "jdbc:postgresql://${module.postgres.fqdn}:5432/${var.postgres_database_name}?sslmode=require"
    DB_RUNTIME_USER     = "erp_runtime_login"
    DB_MIGRATION_URL    = "jdbc:postgresql://${module.postgres.fqdn}:5432/${var.postgres_database_name}?sslmode=require"
    DB_MIGRATION_USER   = "erp_migrator"
    JAVA_TOOL_OPTIONS   = "-XX:MaxRAMPercentage=70"
  }
  backend_secure_environment = {
    DB_RUNTIME_PASSWORD  = var.db_runtime_password
    DB_MIGRATION_PASSWORD = var.db_migration_password
  }
  tags = local.common_tags
}

locals {
  common_tags = {
    project     = "app-distribuidas"
    environment = var.environment
    managed_by  = "terraform"
  }
}
