resource "azurerm_user_assigned_identity" "pull" {
  name                = "id-${var.name}-pull"
  resource_group_name = var.resource_group_name
  location            = var.location

  tags = var.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = var.registry_id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.pull.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_container_group" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  ip_address_type     = "Public"
  dns_name_label      = var.dns_name_label
  os_type             = "Linux"
  restart_policy      = "Always"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.pull.id]
  }

  image_registry_credential {
    server                    = var.registry_login_server
    user_assigned_identity_id = azurerm_user_assigned_identity.pull.id
  }

  container {
    name   = "frontend"
    image  = var.frontend_image
    cpu    = var.enable_backend ? 0.25 : 1
    memory = var.enable_backend ? 0.25 : 1

    ports {
      port     = 80
      protocol = "TCP"
    }

    liveness_probe {
      http_get {
        path   = "/"
        port   = 80
        scheme = "Http"
      }
      initial_delay_seconds = 10
      period_seconds        = 30
    }
  }

  dynamic "container" {
    for_each = var.enable_backend ? [1] : []
    content {
      name   = "backend"
      image  = var.backend_image
      cpu    = 0.75
      memory = 1.25

      ports {
        port     = 8080
        protocol = "TCP"
      }

      environment_variables        = var.backend_environment
      secure_environment_variables = var.backend_secure_environment
    }
  }

  exposed_port {
    port     = 80
    protocol = "TCP"
  }

  tags = var.tags

  depends_on = [azurerm_role_assignment.acr_pull]
}
