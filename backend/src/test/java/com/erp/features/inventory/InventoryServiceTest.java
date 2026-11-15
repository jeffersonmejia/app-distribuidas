package com.erp.features.inventory;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static com.erp.features.inventory.domain.model.InventoryException.Code.*;
import java.math.BigDecimal;
import java.util.*;
import com.erp.features.identity.api.ActorId;
import com.erp.features.inventory.api.InventoryMovements.*;
import com.erp.features.inventory.application.port.out.InventoryStore;
import com.erp.features.inventory.application.port.out.InventoryStore.StoredOperation;
import com.erp.features.inventory.application.usecase.InventoryService;
import com.erp.features.inventory.domain.model.InventoryException;
import com.erp.features.inventory.domain.model.Stock;
import com.erp.features.tenancy.api.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE VERIFICA LOS CASOS DE USO Y LA PROPAGACIÓN DE CONTEXTO.
class InventoryServiceTest {
    private static final TenantId A = new TenantId(UUID.randomUUID());
    private static final TenantId B = new TenantId(UUID.randomUUID());
    private static final UUID ACTOR = UUID.randomUUID();
    private static final UUID PRODUCT = UUID.randomUUID();
    private InventoryStore store;
    private InventoryService service;
    private final Map<String, Stock> stocks = new HashMap<>();
    private final Map<UUID, StoredOperation> operations = new HashMap<>();
    private final List<String> permissions = new ArrayList<>();

    @BeforeEach void setup() {
        store = mock(InventoryStore.class);
        TenantAccess access = new TenantAccess() {
            @Override public <T> T execute(TenantId tenant, String permission, TenantOperation<T> work) {
                permissions.add(permission);
                return work.apply(new TenantContext(tenant, new ActorId(ACTOR)));
            }
        };
        service = new InventoryService(access, store);
        when(store.findStock(any(), any())).thenAnswer(call ->
                Optional.ofNullable(stocks.get(call.getArgument(0) + "/" + call.getArgument(1))));
        doAnswer(call -> {
            Stock value = call.getArgument(0);
            stocks.put(value.tenantId() + "/" + value.productId(), value); return null;
        }).when(store).saveStock(any());
        when(store.findByKey(any(), anyString())).thenAnswer(call -> operations.values().stream()
                .filter(o -> o.value().tenantId().equals(call.getArgument(0)) && o.key().equals(call.getArgument(1)))
                .findFirst());
        when(store.findOperation(any(), any())).thenAnswer(call -> Optional.ofNullable(
                operations.get(call.getArgument(1))).filter(o -> o.value().tenantId().equals(call.getArgument(0))));
        doAnswer(call -> {
            StoredOperation operation = call.getArgument(0);
            operations.put(operation.value().id(), operation); return null;
        }).when(store).saveOperation(any());
        doAnswer(call -> {
            StoredOperation old = operations.get(call.getArgument(1));
            operations.put(old.value().id(), new StoredOperation(old.value(), old.key(), old.fingerprint(),
                    call.getArgument(2), call.getArgument(3))); return null;
        }).when(store).transition(any(), any(), any(), nullable(UUID.class), any(), any());
    }

    @Test void receiveIssueAndAvailabilityUseAuthenticatedActorAndTenant() {
        Operation receipt = service.receive(A, command("r", "10.25"));
        assertEquals(A.value(), receipt.tenantId()); assertEquals(ACTOR, receipt.actorId());
        assertEquals(Type.RECEIPT, receipt.type());
        service.issue(A, command("s", "0.25"));
        assertDecimal("10", service.availability(A, PRODUCT).available());
        assertEquals(List.of("inventory:stock:receive", "inventory:stock:issue", "inventory:stock:read"), permissions);
        verify(store, times(2)).lockTenant(A.value());
    }

    @Test void reserveAndConfirmConsumePhysicalAndReservedExactlyOnce() {
        service.receive(A, command("r", "10"));
        Operation reserve = service.reserve(A, command("v", "3"));
        assertDecimal("7", service.availability(A, PRODUCT).available());
        ReservationCommand confirm = new ReservationCommand("c", "sale", reserve.id());
        Operation result = service.confirmReservation(A, confirm);
        assertEquals(result, service.confirmReservation(A, confirm));
        Availability stock = service.availability(A, PRODUCT);
        assertDecimal("7", stock.onHand()); assertDecimal("0", stock.reserved());
        Reservation view = service.reservation(A, reserve.id());
        assertEquals(Status.CONFIRMED, view.status()); assertEquals(result.id(), view.confirmationId());
        error(RESERVATION_STATE_CONFLICT, () -> service.releaseReservation(A,
                new ReservationCommand("late", "sale", reserve.id())));
    }

    @Test void releaseDoesNotCreatePhysicalStockAndCannotBeConfirmedAfterwards() {
        service.receive(A, command("r", "5"));
        Operation reserve = service.reserve(A, command("v", "2"));
        ReservationCommand release = new ReservationCommand("l", "sale", reserve.id());
        assertEquals(service.releaseReservation(A, release), service.releaseReservation(A, release));
        assertDecimal("5", service.availability(A, PRODUCT).onHand());
        assertDecimal("5", service.availability(A, PRODUCT).available());
        assertEquals(Status.RELEASED, service.reservation(A, reserve.id()).status());
        error(RESERVATION_STATE_CONFLICT, () -> service.confirmReservation(A,
                new ReservationCommand("bad", "sale", reserve.id())));
    }

    @Test void directIssueCannotConsumeReservedUnits() {
        service.receive(A, command("r", "5"));
        service.reserve(A, command("v", "4"));
        error(INSUFFICIENT_AVAILABILITY, () -> service.issue(A, command("bad", "2")));
        error(INSUFFICIENT_AVAILABILITY, () -> service.reserve(A, command("bad2", "2")));
        assertDecimal("5", service.availability(A, PRODUCT).onHand());
    }

    @Test void retryCanonicalizesLineOrderAndDecimalScaleButRejectsChangedPayload() {
        UUID second = UUID.randomUUID();
        StockCommand initial = new StockCommand("r", "sale",
                List.of(line(PRODUCT, "2.0"), line(second, "3")));
        Operation original = service.receive(A, initial);
        assertEquals(original, service.receive(A, new StockCommand("r", "sale",
                List.of(line(second, "3.00"), line(PRODUCT, "2.00")))));
        error(IDEMPOTENCY_CONFLICT, () -> service.receive(A, command("r", "8")));
        error(IDEMPOTENCY_CONFLICT, () -> service.issue(A, command("r", "2")));
        assertEquals(1, operations.size());
    }

    @Test void idempotencyKeysAndProductReferencesAreIsolatedByTenant() {
        service.receive(A, command("r", "2"));
        error(PRODUCT_NOT_FOUND, () -> service.availability(B, PRODUCT));
        error(PRODUCT_NOT_FOUND, () -> service.issue(B, command("i", "1")));
        service.receive(B, command("r", "7"));
        assertDecimal("2", service.availability(A, PRODUCT).onHand());
        assertDecimal("7", service.availability(B, PRODUCT).onHand());
        Operation reserve = service.reserve(A, command("v", "1"));
        error(RESERVATION_NOT_FOUND, () -> service.reservation(B, reserve.id()));
    }

    @Test void reservationMustExistMatchSourceAndHaveReservationType() {
        Operation receipt = service.receive(A, command("r", "3"));
        error(RESERVATION_NOT_FOUND, () -> service.reservation(A, receipt.id()));
        error(RESERVATION_NOT_FOUND, () -> service.confirmReservation(A,
                new ReservationCommand("bad", "sale", UUID.randomUUID())));
        Operation reserve = service.reserve(A, command("v", "1"));
        error(SOURCE_REFERENCE_MISMATCH, () -> service.confirmReservation(A,
                new ReservationCommand("bad", "other-sale", reserve.id())));
    }

    @Test void missingProductAndIncompatibleUnitAreRejected() {
        error(PRODUCT_NOT_FOUND, () -> service.reserve(A, command("v", "1")));
        service.receive(A, command("r", "1"));
        error(UNIT_MISMATCH, () -> service.receive(A, new StockCommand("wrong", "sale",
                List.of(new Line(PRODUCT, "other", BigDecimal.ONE)))));
        assertDecimal("1", service.availability(A, PRODUCT).onHand());
    }

    @Test void validatesAllLinesBeforeSavingAnyBalance() {
        service.receive(A, command("r", "5"));
        clearInvocations(store);
        error(PRODUCT_NOT_FOUND, () -> service.issue(A, new StockCommand("bad", "sale",
                List.of(line(PRODUCT, "1"), line(UUID.randomUUID(), "1")))));
        verify(store, never()).saveStock(any());
    }

    @Test void invalidRequestsAreRejectedBeforeAuthorization() {
        error(INVALID_REQUEST, () -> service.receive(A, null));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand(" ", "sale", List.of(line(PRODUCT, "1")))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", " ", List.of(line(PRODUCT, "1")))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale", null)));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale", List.of())));
        error(INVALID_REQUEST, () -> service.receive(A, command("r", "0")));
        error(INVALID_REQUEST, () -> service.receive(A, command("r", "-1")));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale",
                Arrays.asList((Line) null))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale",
                List.of(new Line(null, "u", BigDecimal.ONE)))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale",
                List.of(new Line(PRODUCT, "", BigDecimal.ONE)))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale",
                List.of(new Line(PRODUCT, "u", null)))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale",
                List.of(line(PRODUCT, "1"), line(PRODUCT, "2")))));
        error(INVALID_REQUEST, () -> service.availability(A, null));
        error(INVALID_REQUEST, () -> service.reservation(A, null));
        error(INVALID_REQUEST, () -> service.confirmReservation(A, null));
        error(INVALID_REQUEST, () -> service.confirmReservation(A, new ReservationCommand("c", "sale", null)));
        error(INVALID_REQUEST, () -> service.issueAndExecute(A, command("i", "1"), null));
        assertTrue(permissions.isEmpty());
        verifyNoInteractions(store);
    }

    @Test void denialPreventsAllPersistenceAndConsumerWork() {
        TenantAccess deny = new TenantAccess() {
            @Override public <T> T execute(TenantId t, String permission, TenantOperation<T> work) {
                throw new SecurityException("denied");
            }
        };
        InventoryService unauthorized = new InventoryService(deny, store);
        assertThrows(SecurityException.class, () -> unauthorized.receive(A, command("r", "1")));
        verifyNoInteractions(store);
    }

    @Test void technicalBoundsRejectExpensiveAndUnrepresentableRequests() {
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("k".repeat(257), "sale", List.of(line(PRODUCT, "1")))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "s".repeat(1025), List.of(line(PRODUCT, "1")))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale", List.of(
                new Line(PRODUCT, "u".repeat(65), BigDecimal.ONE)))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale", List.of(
                new Line(PRODUCT, "u", new BigDecimal("1e1001"))))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale", List.of(
                new Line(PRODUCT, "u", new BigDecimal("9".repeat(1001)))))));
        error(INVALID_REQUEST, () -> service.receive(A, new StockCommand("r", "sale",
                java.util.stream.IntStream.range(0, 101).mapToObj(i -> line(UUID.randomUUID(), "1")).toList())));
        assertTrue(permissions.isEmpty());
    }

    @Test void consumerReceivesOperationAndItsFailureIsPropagatedForRollback() {
        service.receive(A, command("r", "2"));
        String id = service.issueAndExecute(A, command("i", "1"), value -> value.id().toString());
        assertNotNull(id);
        RuntimeException failure = new RuntimeException("consumer failed");
        assertSame(failure, assertThrows(RuntimeException.class, () -> service.issueAndExecute(A,
                command("i2", "1"), value -> { throw failure; })));
        // Rollback real se verifica con PostgreSQL; este puerto simulado no es una base transaccional.
    }

    @Test void publicListsAreSnapshots() {
        List<Line> mutable = new ArrayList<>(List.of(line(PRODUCT, "1")));
        StockCommand command = new StockCommand("r", "sale", mutable);
        mutable.clear();
        assertEquals(1, command.lines().size());
        assertThrows(UnsupportedOperationException.class, () -> command.lines().clear());
        Operation operation = service.receive(A, command);
        assertThrows(UnsupportedOperationException.class, () -> operation.lines().clear());
    }

    private static StockCommand command(String key, String quantity) {
        return new StockCommand(key, "sale", List.of(line(PRODUCT, quantity)));
    }
    private static Line line(UUID product, String quantity) {
        return new Line(product, "u", new BigDecimal(quantity));
    }
    private static void assertDecimal(String expected, BigDecimal value) {
        assertEquals(0, new BigDecimal(expected).compareTo(value));
    }
    private static void error(InventoryException.Code code, org.junit.jupiter.api.function.Executable action) {
        assertEquals(code, assertThrows(InventoryException.class, action).code());
    }
}

