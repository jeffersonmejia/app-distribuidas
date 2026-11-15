package com.erp.features.inventory.application.usecase;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import com.erp.features.inventory.api.InventoryMovements;
import com.erp.features.inventory.application.port.out.InventoryStore;
import com.erp.features.inventory.application.port.out.InventoryStore.StoredOperation;
import com.erp.features.inventory.domain.model.InventoryException;
import com.erp.features.inventory.domain.model.Stock;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;
import static com.erp.features.inventory.domain.model.InventoryException.Code.*;

//SOLID: SRP — ESTE SERVICIO COORDINA INVENTARIO DENTRO DE LA TRANSACCIÓN AUTORIZADA.
@Service
public class InventoryService implements InventoryMovements {
    private final TenantAccess access;
    private final InventoryStore store;

    public InventoryService(TenantAccess access, InventoryStore store) { this.access = access; this.store = store; }

    @Override public Operation receive(TenantId tenant, StockCommand command) {
        return stockOperation(tenant, command, Type.RECEIPT, Function.identity());
    }
    @Override public Operation issue(TenantId tenant, StockCommand command) {
        return issueAndExecute(tenant, command, Function.identity());
    }
    @Override public Operation reserve(TenantId tenant, StockCommand command) {
        return stockOperation(tenant, command, Type.RESERVE, Function.identity());
    }
    @Override public Operation confirmReservation(TenantId tenant, ReservationCommand command) {
        return confirmAndExecute(tenant, command, Function.identity());
    }
    @Override public Operation releaseReservation(TenantId tenant, ReservationCommand command) {
        return reservationOperation(tenant, command, Type.RELEASE, Function.identity());
    }
    @Override public <T> T issueAndExecute(TenantId tenant, StockCommand command, Function<Operation, T> work) {
        return stockOperation(tenant, command, Type.ISSUE, work);
    }
    @Override public <T> T confirmAndExecute(TenantId tenant, ReservationCommand command, Function<Operation, T> work) {
        return reservationOperation(tenant, command, Type.CONFIRM, work);
    }

    @Override public Availability availability(TenantId tenant, UUID productId) {
        required(productId);
        return access.execute(tenant, "inventory:stock:read", context -> {
            Stock stock = stock(context, productId);
            return new Availability(productId, stock.unit(), stock.onHand(), stock.reserved(), stock.available());
        });
    }

    @Override public Reservation reservation(TenantId tenant, UUID reservationId) {
        required(reservationId);
        return access.execute(tenant, "inventory:stock:read", context -> {
            StoredOperation saved = reservation(context, reservationId);
            return new Reservation(saved.value(), saved.status(), saved.confirmationId());
        });
    }

    private <T> T stockOperation(TenantId tenant, StockCommand command, Type type, Function<Operation, T> work) {
        required(command); required(work);
        text(command.operationKey(), 256); text(command.sourceReference(), 1024);
        List<Line> lines = validateLines(command.lines());
        String fingerprint = fingerprint(type, command.sourceReference(), null, lines);
        return access.execute(tenant, permission(type), context -> {
            UUID tenantId = context.tenantId().value();
            store.lockTenant(tenantId);
            StoredOperation previous = store.findByKey(tenantId, command.operationKey()).orElse(null);
            if (previous != null) { return work.apply(replay(previous, fingerprint)); }
            Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
            List<Stock> changes = new ArrayList<>();
            for (Line line : lines) {
                Stock current = store.findStock(tenantId, line.productId()).orElse(null);
                if (current == null) {
                    if (type != Type.RECEIPT) { throw new InventoryException(PRODUCT_NOT_FOUND); }
                    current = new Stock(UUID.randomUUID(), tenantId, line.productId(), line.unit(),
                            BigDecimal.ZERO, BigDecimal.ZERO, now, context.actorId().value(), now, context.actorId().value());
                }
                if (!current.unit().equals(line.unit())) { throw new InventoryException(UNIT_MISMATCH); }
                UUID actor = context.actorId().value();
                changes.add(switch (type) {
                    case RECEIPT -> current.receive(line.quantity(), actor, now);
                    case ISSUE -> current.issue(line.quantity(), actor, now);
                    case RESERVE -> current.reserve(line.quantity(), actor, now);
                    default -> throw new InventoryException(INVALID_REQUEST);
                });
            }
            changes.forEach(store::saveStock);
            UUID id = UUID.randomUUID();
            Operation result = new Operation(id, tenantId, context.actorId().value(), type,
                    command.sourceReference(), type == Type.RESERVE ? id : null, lines, now);
            store.saveOperation(new StoredOperation(result, command.operationKey(), fingerprint,
                    type == Type.RESERVE ? Status.ACTIVE : null, null));
            return work.apply(result);
        });
    }

    private <T> T reservationOperation(TenantId tenant, ReservationCommand command, Type type, Function<Operation, T> work) {
        required(command); required(work); required(command.reservationId());
        text(command.operationKey(), 256); text(command.sourceReference(), 1024);
        String fingerprint = fingerprint(type, command.sourceReference(), command.reservationId(), List.of());
        return access.execute(tenant, permission(type), context -> {
            UUID tenantId = context.tenantId().value();
            store.lockTenant(tenantId);
            StoredOperation previous = store.findByKey(tenantId, command.operationKey()).orElse(null);
            if (previous != null) { return work.apply(replay(previous, fingerprint)); }
            StoredOperation original = reservation(context, command.reservationId());
            if (!original.value().sourceReference().equals(command.sourceReference())) {
                throw new InventoryException(SOURCE_REFERENCE_MISMATCH);
            }
            if (original.status() != Status.ACTIVE) { throw new InventoryException(RESERVATION_STATE_CONFLICT); }
            Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
            for (Line line : original.value().lines()) {
                Stock current = stock(context, line.productId());
                store.saveStock(type == Type.CONFIRM
                        ? current.confirm(line.quantity(), context.actorId().value(), now)
                        : current.release(line.quantity(), context.actorId().value(), now));
            }
            UUID id = UUID.randomUUID();
            Operation result = new Operation(id, tenantId, context.actorId().value(), type,
                    command.sourceReference(), command.reservationId(), original.value().lines(), now);
            store.saveOperation(new StoredOperation(result, command.operationKey(), fingerprint, null, null));
            store.transition(tenantId, command.reservationId(),
                    type == Type.CONFIRM ? Status.CONFIRMED : Status.RELEASED,
                    type == Type.CONFIRM ? id : null, context.actorId().value(), now);
            return work.apply(result);
        });
    }

    private Stock stock(TenantContext context, UUID productId) {
        return store.findStock(context.tenantId().value(), productId)
                .orElseThrow(() -> new InventoryException(PRODUCT_NOT_FOUND));
    }

    private StoredOperation reservation(TenantContext context, UUID id) {
        return store.findOperation(context.tenantId().value(), id)
                .filter(saved -> saved.value().type() == Type.RESERVE)
                .orElseThrow(() -> new InventoryException(RESERVATION_NOT_FOUND));
    }

    private static Operation replay(StoredOperation previous, String fingerprint) {
        if (!previous.fingerprint().equals(fingerprint)) { throw new InventoryException(IDEMPOTENCY_CONFLICT); }
        return previous.value();
    }

    private static List<Line> validateLines(List<Line> input) {
        if (input == null || input.isEmpty() || input.size() > 100) { throw new InventoryException(INVALID_REQUEST); }
        HashSet<UUID> seen = new HashSet<>();
        List<Line> lines = new ArrayList<>();
        for (Line line : input) {
            required(line); required(line.productId()); text(line.unit(), 64);
            if (line.quantity() == null || line.quantity().signum() <= 0
                    || line.quantity().precision() > 1000 || Math.abs((long) line.quantity().scale()) > 1000
                    || !seen.add(line.productId())) {
                throw new InventoryException(INVALID_REQUEST);
            }
            lines.add(line);
        }
        lines.sort(Comparator.comparing(line -> line.productId().toString()));
        return List.copyOf(lines);
    }

    private static String permission(Type type) {
        return switch (type) {
            case RECEIPT -> "inventory:stock:receive";
            case ISSUE -> "inventory:stock:issue";
            case RESERVE -> "inventory:stock:reserve";
            case CONFIRM -> "inventory:stock:confirm";
            case RELEASE -> "inventory:stock:release";
        };
    }

    private static void required(Object value) {
        if (value == null) { throw new InventoryException(INVALID_REQUEST); }
    }

    private static void text(String value, int maxBytes) {
        if (value == null || value.isBlank() || value.getBytes(StandardCharsets.UTF_8).length > maxBytes
                || !StandardCharsets.UTF_8.newEncoder().canEncode(value)) {
            throw new InventoryException(INVALID_REQUEST);
        }
    }

    private static String fingerprint(Type type, String source, UUID reservationId, List<Line> lines) {
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            DataOutputStream bytes = new DataOutputStream(buffer);
            field(bytes, type.name()); field(bytes, source);
            field(bytes, reservationId == null ? "" : reservationId.toString());
            bytes.writeInt(lines.size());
            for (Line line : lines) {
                field(bytes, line.productId().toString()); field(bytes, line.unit());
                field(bytes, line.quantity().stripTrailingZeros().toPlainString());
            }
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(buffer.toByteArray()));
        } catch (IOException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Cannot fingerprint inventory operation", exception);
        }
    }

    private static void field(DataOutputStream target, String value) throws IOException {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        target.writeInt(bytes.length); target.write(bytes);
    }
}

