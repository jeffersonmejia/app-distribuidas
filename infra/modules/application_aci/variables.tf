variable "name" {
  type = string
}

variable "dns_name_label" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "frontend_image" {
  type = string
}

variable "backend_image" {
  type = string
}

variable "registry_id" {
  type = string
}

variable "registry_login_server" {
  type = string
}

variable "enable_backend" {
  type = bool
}

variable "backend_environment" {
  type = map(string)
}

variable "backend_secure_environment" {
  type      = map(string)
  sensitive = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
