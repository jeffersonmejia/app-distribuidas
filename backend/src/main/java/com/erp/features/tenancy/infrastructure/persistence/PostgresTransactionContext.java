package com.erp.features.tenancy.infrastructure.persistence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

//SOLID: SRP — ESTA CLASE FIJA IDENTIDAD Y TENANT COMO VARIABLES LOCALES DE LA TRANSACCIÓN.
@Component
public class PostgresTransactionContext {
    private final JdbcTemplate jdbcTemplate;

    public PostgresTransactionContext(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void setActor(String actorId) {
        jdbcTemplate.queryForObject("select set_config('app.actor_id', ?, true)", String.class, actorId);
    }

    public void setRequestedTenant(String tenantId) {
        jdbcTemplate.queryForObject("select set_config('app.requested_tenant_id', ?, true)", String.class, tenantId);
    }

    public void setTenant(String tenantId) {
        jdbcTemplate.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantId);
    }

    public void setPermission(String permission) {
        jdbcTemplate.queryForObject("select set_config('app.permission', ?, true)", String.class, permission);
    }
}
