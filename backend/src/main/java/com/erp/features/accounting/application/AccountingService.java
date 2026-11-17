package com.erp.features.accounting.application;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import com.erp.features.accounting.api.AccountingEntries;
import com.erp.features.accounting.api.AccountingException;
import com.erp.features.accounting.domain.model.SaleJournal;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;
import static com.erp.features.accounting.api.AccountingException.Code.*;

//SOLID: SRP — ESTE SERVICIO COORDINA ASIENTOS Y REVERSOS AUTORIZADOS.
@Service
public class AccountingService implements AccountingEntries {
    private final TenantAccess access;
    private final AccountingStore store;
    public AccountingService(TenantAccess access, AccountingStore store) {
        this.access = access; this.store = store;
    }
    @Override public Entry recordSale(TenantId tenant, SaleCommand command) {
        if (tenant == null || command == null || command.saleId() == null) {
            throw new AccountingException(INVALID_REQUEST);
        }
        SaleJournal journal;
        try { journal = SaleJournal.forPayment(command.total(), command.lineTaxes()); }
        catch (IllegalArgumentException | NullPointerException error) { throw new AccountingException(INVALID_REQUEST); }
        List<Movement> movements = journal.entries().stream()
                .map(line -> new Movement(line.account().name(), line.side().name(), line.amount())).toList();
        String fingerprint = fingerprint(movements);
        return access.executeJoined(tenant, "accounting:entry:create", context -> {
            UUID tenantId = context.tenantId().value();
            store.lock(tenantId);
            var existing = store.findSale(tenantId, command.saleId());
            if (existing.isPresent()) {
                if (!existing.get().fingerprint().equals(fingerprint)) { throw new AccountingException(IDEMPOTENCY_CONFLICT); }
                return existing.get().entry();
            }
            Entry result = new Entry(UUID.randomUUID(), command.saleId(), null, null, now(), movements);
            store.save(tenantId, context.actorId().value(), false, fingerprint, result);
            return result;
        });
    }
    @Override public Entry reverse(TenantId tenant, ReversalCommand command) {
        if (tenant == null || command == null || command.saleId() == null || command.reversalId() == null) {
            throw new AccountingException(INVALID_REQUEST);
        }
        return access.execute(tenant, "accounting:entry:reverse", context -> {
            UUID tenantId = context.tenantId().value();
            store.lock(tenantId);
            var sameKey = store.findReversalId(tenantId, command.reversalId());
            if (sameKey.isPresent()) {
                if (!sameKey.get().entry().saleId().equals(command.saleId())) {
                    throw new AccountingException(IDEMPOTENCY_CONFLICT);
                }
                return sameKey.get().entry();
            }
            if (store.findReversal(tenantId, command.saleId()).isPresent()) {
                throw new AccountingException(ALREADY_REVERSED);
            }
            Entry original = store.findSale(tenantId, command.saleId())
                    .orElseThrow(() -> new AccountingException(SALE_NOT_FOUND)).entry();
            SaleJournal originalJournal = new SaleJournal(original.movements().stream()
                    .map(m -> new SaleJournal.Entry(SaleJournal.Account.valueOf(m.account()),
                            SaleJournal.Side.valueOf(m.side()), m.amount())).toList());
            List<Movement> movements = originalJournal.reversed().entries().stream()
                    .map(m -> new Movement(m.account().name(), m.side().name(), m.amount())).toList();
            Entry result = new Entry(UUID.randomUUID(), command.saleId(), command.reversalId(),
                    original.id(), now(), movements);
            store.save(tenantId, context.actorId().value(), true, fingerprint(movements), result);
            return result;
        });
    }
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
    private static String fingerprint(List<Movement> movements) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (Movement movement : movements) {
                String line = movement.account() + "|" + movement.side() + "|"
                        + movement.amount().setScale(2).toPlainString() + "\n";
                digest.update(line.getBytes(StandardCharsets.UTF_8));
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
