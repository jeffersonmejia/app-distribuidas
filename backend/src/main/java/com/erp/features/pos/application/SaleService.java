package com.erp.features.pos.application;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import com.erp.features.inventory.api.InventoryMovements;
import com.erp.features.inventory.api.InventoryFailure;
import com.erp.features.pos.api.SaleException;
import com.erp.features.pos.api.Sales;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;
import static com.erp.features.pos.api.SaleException.Code.*;

//SOLID: SRP — ESTE SERVICIO REGISTRA VENTAS DENTRO DE LA TRANSACCIÓN DE INVENTORY.
@Service
public class SaleService implements Sales {
    private final InventoryMovements inventory;
    private final SaleStore store;
    public SaleService(InventoryMovements inventory, SaleStore store) {
        this.inventory = inventory; this.store = store;
    }

    @Override public Sale register(TenantId tenant, Command command) {
        if (tenant == null || command == null || command.saleId() == null
                || command.lines() == null || command.lines().isEmpty() || command.lines().size() > 100) {
            throw new SaleException(INVALID_REQUEST);
        }
        List<Line> lines = normalize(command.lines());
        String fingerprint = fingerprint(lines);
        String reference = "pos:sale:" + command.saleId();
        var stock = new InventoryMovements.StockCommand(reference, reference, lines.stream()
                .map(line -> new InventoryMovements.Line(line.productId(), line.unit(), line.quantity())).toList());
        try {
            return inventory.issueAndExecute(tenant, stock, movement -> {
                var existing = store.find(movement.tenantId(), command.saleId());
                if (existing.isPresent()) {
                    if (!existing.get().fingerprint().equals(fingerprint)) {
                        throw new SaleException(IDEMPOTENCY_CONFLICT);
                    }
                    return existing.get().sale();
                }
                List<SoldLine> sold = lines.stream().map(line -> new SoldLine(line.productId(), line.unit(),
                        line.quantity(), line.unitPrice(), line.taxAmount(),
                        line.unitPrice().multiply(line.quantity()).setScale(2, RoundingMode.HALF_UP))).toList();
                Sale sale = new Sale(command.saleId(), movement.id(), movement.occurredAt(), sold);
                store.save(movement.tenantId(), movement.actorId(), fingerprint, sale);
                return sale;
            });
        } catch (RuntimeException failure) {
            if (failure instanceof InventoryFailure inventoryFailure) {
                SaleException.Code code = java.util.Arrays.stream(SaleException.Code.values())
                        .filter(candidate -> candidate.name().equals(inventoryFailure.inventoryCode()))
                        .findFirst().orElse(SaleException.Code.INVENTORY_ERROR);
                throw new SaleException(code);
            }
            throw failure;
        }
    }

    private static List<Line> normalize(List<Line> input) {
        List<Line> result = new ArrayList<>();
        HashSet<java.util.UUID> seen = new HashSet<>();
        for (Line line : input) {
            if (line == null || line.productId() == null || line.unit() == null || line.unit().isBlank()
                    || line.unit().length() > 64
                    || !StandardCharsets.UTF_8.newEncoder().canEncode(line.unit())
                    || line.unit().getBytes(StandardCharsets.UTF_8).length > 64
                    || line.quantity() == null || line.quantity().signum() <= 0
                    || line.quantity().precision() > 1000 || Math.abs((long) line.quantity().scale()) > 1000
                    || !seen.add(line.productId())) { throw new SaleException(INVALID_REQUEST); }
            BigDecimal quantity = line.quantity().stripTrailingZeros();
            if (quantity.scale() < 0) { quantity = quantity.setScale(0); }
            result.add(new Line(line.productId(), line.unit(), quantity,
                    money(line.unitPrice()), money(line.taxAmount())));
        }
        result.sort(Comparator.comparing(line -> line.productId().toString()));
        return List.copyOf(result);
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null || value.signum() < 0 || (long) value.precision() - value.scale() > 131072
                || value.scale() > 16383) { throw new SaleException(INVALID_REQUEST); }
        try { return value.setScale(2, RoundingMode.UNNECESSARY); }
        catch (ArithmeticException exception) { throw new SaleException(INVALID_REQUEST); }
    }

    private static String fingerprint(List<Line> lines) {
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            DataOutputStream data = new DataOutputStream(buffer);
            data.writeInt(lines.size());
            for (Line line : lines) {
                field(data, line.productId().toString()); field(data, line.unit());
                field(data, line.quantity().toPlainString()); field(data, line.unitPrice().toPlainString());
                field(data, line.taxAmount().toPlainString());
            }
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(buffer.toByteArray()));
        } catch (IOException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Cannot fingerprint sale", exception);
        }
    }
    private static void field(DataOutputStream data, String value) throws IOException {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        data.writeInt(bytes.length); data.write(bytes);
    }
}
