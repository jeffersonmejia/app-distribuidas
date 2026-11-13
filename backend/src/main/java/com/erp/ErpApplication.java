package com.erp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

//SOLID: SRP — ESTA CLASE ARRANCA LA APLICACIÓN SPRING BOOT.
@SpringBootApplication
public class ErpApplication {
    public static void main(String[] args) {
        SpringApplication.run(ErpApplication.class, args);
    }
}
