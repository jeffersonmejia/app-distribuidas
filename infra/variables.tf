variable "azure_subscription_id" {
  type = string
}

variable "environment" {
  type    = string
  default = "develop"
}

variable "resource_group_name" {
  type = string
}

variable "resource_suffix" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9]{5,8}$", var.resource_suffix))
    error_message = "El sufijo debe tener entre 5 y 8 caracteres alfanuméricos en minúscula."
  }
}

variable "github_actions_principal_id" {
  type = string
}

variable "postgres_region" {
  type    = string
  default = "Brazil South"
}

variable "postgres_sku" {
  type    = string
  default = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  type    = number
  default = 32768
}

variable "postgres_backup_days" {
  type    = number
  default = 7
}

variable "postgres_database_name" {
  type    = string
  default = "erp_crm"
}

variable "postgres_admin_username" {
  type    = string
  default = "pgadmin"
}

variable "postgres_admin_password" {
  type      = string
  sensitive = true
}

variable "db_runtime_password" {
  type      = string
  sensitive = true
}

variable "db_migration_password" {
  type      = string
  sensitive = true
}

variable "frontend_image_tag" {
  type = string
}

variable "backend_image_tag" {
  type = string
}

variable "enable_backend" {
  description = "Activa el backend; requiere credenciales de roles y configuración del emisor JWT."
  type        = bool
  default     = false
}

variable "allow_azure_services_postgres" {
  description = "Permite el firewall Azure 0.0.0.0; incluye servicios de otras suscripciones Azure."
  type        = bool
  default     = false
}

variable "auth_issuer_uri" {
  type    = string
  default = ""
}

variable "auth_audience" {
  type    = string
  default = ""
}
