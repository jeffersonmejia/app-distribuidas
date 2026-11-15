package com.erp.features.projects.presentation.controller;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import com.erp.features.projects.application.usecase.ProjectsException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

//SOLID: SRP — ESTE ADAPTADOR CONVIERTE UN PATCH JSON EN CAMPOS TIPADOS PERMITIDOS.
final class PatchFields {
    private PatchFields() { }

    /** Acepta solo las claves declaradas; un null explícito se conserva para borrar un campo opcional. */
    static Map<String, Object> parse(ObjectMapper mapper, JsonNode body, Map<String, Class<?>> allowed,
                                     String errorCode) {
        if (body == null || !body.isObject()) { throw new ProjectsException(errorCode); }
        Map<String, Object> fields = new HashMap<>();
        Iterator<Map.Entry<String, JsonNode>> entries = body.fields();
        while (entries.hasNext()) {
            Map.Entry<String, JsonNode> entry = entries.next();
            Class<?> type = allowed.get(entry.getKey());
            if (type == null) { throw new ProjectsException(errorCode); }
            try {
                fields.put(entry.getKey(), entry.getValue().isNull() ? null
                        : mapper.treeToValue(entry.getValue(), type));
            } catch (JsonProcessingException | IllegalArgumentException exception) {
                throw new ProjectsException(errorCode);
            }
        }
        return fields;
    }
}
