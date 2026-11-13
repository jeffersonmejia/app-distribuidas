output "frontend_url" {
  value = "http://${azurerm_container_group.this.fqdn}"
}
