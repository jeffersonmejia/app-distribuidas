output "frontend_url" {
  value = module.application.frontend_url
}

output "postgres_fqdn" {
  value = module.postgres.fqdn
}

output "postgres_database" {
  value = module.postgres.database_name
}
