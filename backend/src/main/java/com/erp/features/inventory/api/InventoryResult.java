package com.erp.features.inventory.api;

//SOLID: SRP — ESTA INTERFAZ REPRESENTA EL RESULTADO PÚBLICO DE UNA OPERACIÓN.
public sealed interface InventoryResult<T>
        permits InventoryResult.Success, InventoryResult.Failure {

    //SOLID: SRP — ESTE RECORD TRANSPORTA EL VALOR DE UNA OPERACIÓN EXITOSA.
    record Success<T>(T value) implements InventoryResult<T> {}

    //SOLID: SRP — ESTE RECORD TRANSPORTA UN ERROR DE NEGOCIO DEL CONTRATO.
    record Failure<T>(InventoryErrorCode code) implements InventoryResult<T> {}
}

