variable "name" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "github_actions_principal_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
